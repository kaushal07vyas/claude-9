from flask import Blueprint, Flask, request, jsonify
from db_connection import execute_query, execute_update, get_db_connection
from datetime import datetime

user_bp = Blueprint('users', __name__)

@user_bp.route('', methods=['GET'])
def list_users():
    """List all users with pagination and search"""
    q = request.args.get('q', '', type=str)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    # Build query
    base_query = "SELECT id, user_name, user_email, dob, phone_number, state, country, role FROM User"
    count_query = "SELECT COUNT(*) as total FROM User"
    params = []
    
    if q:
        where_clause = " WHERE (user_name LIKE %s OR user_email LIKE %s)"
        base_query += where_clause
        count_query += where_clause
        search_term = f'%{q}%'
        params = [search_term, search_term]
    
    # Get total count
    total_result = execute_query(count_query, params, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    # Get paginated results
    base_query += " ORDER BY id LIMIT %s OFFSET %s"
    query_params = params + [page_size, offset]
    users = execute_query(base_query, query_params, fetch_all=True)
    
    # Format results (exclude password)
    results = []
    for user in users:
        results.append({
            'id': user['id'],
            'user_name': user['user_name'],
            'user_email': user['user_email'],
            'dob': user['dob'].isoformat() if user['dob'] else None,
            'phone_number': user['phone_number'],
            'state': user['state'],
            'country': user['country'],
            'role': user['role']
        })
    
    return jsonify({
        'data': results,
        'page': page,
        'page_size': page_size,
        'total': total
    })

@user_bp.route('/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get a specific user"""
    query = """
        SELECT id, user_name, user_email, dob, phone_number, state, country, role
        FROM User
        WHERE id = %s
    """
    user = execute_query(query, (user_id,), fetch_one=True)
    
    if not user:
        return jsonify({'error': {'code': 'not_found', 'message': 'User not found'}}), 404
    
    # Get check-ins for this user
    checks_query = """
        SELECT user_id, flight_id
        FROM Checks
        WHERE user_id = %s
    """
    checks = execute_query(checks_query, (user_id,), fetch_all=True)
    
    user_dict = {
        'id': user['id'],
        'user_name': user['user_name'],
        'user_email': user['user_email'],
        'dob': user['dob'].isoformat() if user['dob'] else None,
        'phone_number': user['phone_number'],
        'state': user['state'],
        'country': user['country'],
        'role': user['role'],
        'check_ins': checks
    }
    
    return jsonify({'data': user_dict})

@user_bp.route('', methods=['POST'])
def create_user():
    """Create a new user"""
    data = request.get_json()
    
    required_fields = ['user_name', 'user_email', 'dob', 'country']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': {'code': 'validation_error', 'message': f'Required fields: {", ".join(required_fields)}'}}), 400
    
    # Check for duplicate email
    check_query = "SELECT id FROM User WHERE user_email = %s"
    existing = execute_query(check_query, (data['user_email'],), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'User with this email already exists'}}), 409
    
    try:
        # Parse date
        dob = data['dob']
        if isinstance(dob, str):
            dob = datetime.strptime(dob, '%Y-%m-%d').date()
        
        # Insert user
        insert_query = """
            INSERT INTO User (user_name, user_email, password, dob, phone_number, state, country, role)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        password = data.get('password', '')
        role = data.get('role', 'User')
        
        execute_update(insert_query, (
            data['user_name'],
            data['user_email'],
            password,
            dob,
            data.get('phone_number'),
            data.get('state'),
            data['country'],
            role
        ))
        
        # Get the created user
        get_query = """
            SELECT id, user_name, user_email, dob, phone_number, state, country, role
            FROM User
            WHERE user_email = %s
        """
        new_user = execute_query(get_query, (data['user_email'],), fetch_one=True)
        
        result = {
            'id': new_user['id'],
            'user_name': new_user['user_name'],
            'user_email': new_user['user_email'],
            'dob': new_user['dob'].isoformat() if new_user['dob'] else None,
            'phone_number': new_user['phone_number'],
            'state': new_user['state'],
            'country': new_user['country'],
            'role': new_user['role']
        }
        
        return jsonify({'data': result}), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400

@user_bp.route('/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update a user"""
    # Check if user exists
    check_query = "SELECT id FROM User WHERE id = %s"
    user = execute_query(check_query, (user_id,), fetch_one=True)
    if not user:
        return jsonify({'error': {'code': 'not_found', 'message': 'User not found'}}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    # Check for duplicate email if being changed
    if 'user_email' in data:
        check_email_query = "SELECT id FROM User WHERE user_email = %s AND id != %s"
        existing = execute_query(check_email_query, (data['user_email'], user_id), fetch_one=True)
        if existing:
            return jsonify({'error': {'code': 'duplicate_key', 'message': 'User with this email already exists'}}), 409
    
    try:
        # Build update query dynamically
        updates = []
        params = []
        
        if 'user_name' in data:
            updates.append("user_name = %s")
            params.append(data['user_name'])
        if 'user_email' in data:
            updates.append("user_email = %s")
            params.append(data['user_email'])
        if 'password' in data:
            updates.append("password = %s")
            params.append(data['password'])
        if 'dob' in data:
            dob = data['dob']
            if isinstance(dob, str):
                dob = datetime.strptime(dob, '%Y-%m-%d').date()
            updates.append("dob = %s")
            params.append(dob)
        if 'phone_number' in data:
            updates.append("phone_number = %s")
            params.append(data['phone_number'])
        if 'state' in data:
            updates.append("state = %s")
            params.append(data['state'])
        if 'country' in data:
            updates.append("country = %s")
            params.append(data['country'])
        if 'role' in data:
            updates.append("role = %s")
            params.append(data['role'])
        
        if not updates:
            return jsonify({'error': {'code': 'validation_error', 'message': 'No valid fields to update'}}), 400
        
        update_query = f"UPDATE User SET {', '.join(updates)} WHERE id = %s"
        params.append(user_id)
        
        execute_update(update_query, tuple(params))
        
        # Get updated user
        get_query = """
            SELECT id, user_name, user_email, dob, phone_number, state, country, role
            FROM User
            WHERE id = %s
        """
        updated_user = execute_query(get_query, (user_id,), fetch_one=True)
        
        result = {
            'id': updated_user['id'],
            'user_name': updated_user['user_name'],
            'user_email': updated_user['user_email'],
            'dob': updated_user['dob'].isoformat() if updated_user['dob'] else None,
            'phone_number': updated_user['phone_number'],
            'state': updated_user['state'],
            'country': updated_user['country'],
            'role': updated_user['role']
        }
        
        return jsonify({'data': result})
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400

@user_bp.route('/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a user"""
    # Check if user exists
    check_query = "SELECT id FROM User WHERE id = %s"
    user = execute_query(check_query, (user_id,), fetch_one=True)
    if not user:
        return jsonify({'error': {'code': 'not_found', 'message': 'User not found'}}), 404
    
    try:
        delete_query = "DELETE FROM User WHERE id = %s"
        execute_update(delete_query, (user_id,))
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400

@user_bp.get('/fareDrop-report')
def run_fare_drop_report():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("CALL GenerateFareDropReport()")

            results_query1 = []
            results_query2 = []
            
            result_count = 0
            
            while True:
                try:
                    if cursor.description:
                        rows = cursor.fetchall()
                        
                        if rows and len(rows) > 0:
                            # Rows are already dictionaries - don't convert!
                            if result_count == 0:
                                results_query1 = rows  # ✅ Use directly
                            elif result_count == 1:
                                results_query2 = rows  # ✅ Use directly
                            
                            result_count += 1
                    
                    if not cursor.nextset():
                        break
                        
                except Exception as e:
                    print(f"Error: {e}")
                    break

            cursor.close()

            # Convert Decimal and date objects to JSON-serializable types
            import json
            from decimal import Decimal
            import datetime
            
            def convert_types(obj):
                if isinstance(obj, Decimal):
                    return float(obj)
                elif isinstance(obj, datetime.date):
                    return obj.isoformat()
                return obj
            
            # Convert any Decimal/date types
            results_query1 = json.loads(json.dumps(results_query1, default=convert_types))
            results_query2 = json.loads(json.dumps(results_query2, default=convert_types))

            return jsonify({
                "status": "success",
                "message": "Fare drop report generated.",
                "result1": results_query1,
                "result2": results_query2
            })

    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return jsonify({"status": "error", "message": str(e)}), 500    


