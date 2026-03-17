from flask import Blueprint, request, jsonify
from db_connection import execute_query, execute_update
from urllib.parse import unquote

checks_bp = Blueprint('checks', __name__)

@checks_bp.route('', methods=['GET'])
def list_checks():
    """List all check-ins with pagination"""
    user_id = request.args.get('user_id', type=int)
    flight_id = request.args.get('flight_id', type=str)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    # Build query
    base_query = """
        SELECT c.user_id, c.flight_id,
               u.user_name, u.user_email,
               f.flight_no, f.origin_airport, f.destination_airport
        FROM Checks c
        LEFT JOIN User u ON c.user_id = u.id
        LEFT JOIN Flight f ON c.flight_id = f.flight_id
    """
    count_query = "SELECT COUNT(*) as total FROM Checks"
    params = []
    conditions = []
    
    if user_id:
        conditions.append("c.user_id = %s")
        params.append(user_id)
    if flight_id:
        flight_id = unquote(flight_id)  # Handle URL encoding
        conditions.append("c.flight_id = %s")
        params.append(flight_id)
    
    if conditions:
        where_clause = " WHERE " + " AND ".join(conditions)
        base_query += where_clause
        count_query += where_clause
    
    # Get total count
    total_result = execute_query(count_query, params, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    # Get paginated results
    base_query += " ORDER BY c.user_id, c.flight_id LIMIT %s OFFSET %s"
    query_params = params + [page_size, offset]
    checks = execute_query(base_query, query_params, fetch_all=True)
    
    # Format results
    results = []
    for check in checks:
        result = {
            'user_id': check['user_id'],
            'flight_id': check['flight_id']
        }
        if check['user_name']:
            result['user'] = {
                'id': check['user_id'],
                'user_name': check['user_name'],
                'user_email': check['user_email']
            }
        if check['flight_no']:
            result['flight'] = {
                'flight_id': check['flight_id'],
                'flight_no': check['flight_no'],
                'origin_airport': check['origin_airport'],
                'destination_airport': check['destination_airport']
            }
        results.append(result)
    
    return jsonify({
        'data': results,
        'page': page,
        'page_size': page_size,
        'total': total
    })

@checks_bp.route('/<int:user_id>/<path:flight_id>', methods=['GET'])
def get_check(user_id, flight_id):
    """Get a specific check-in"""
    flight_id = unquote(flight_id)  # Handle URL encoding
    
    query = """
        SELECT c.user_id, c.flight_id,
               u.user_name, u.user_email,
               f.flight_no, f.origin_airport, f.destination_airport
        FROM Checks c
        LEFT JOIN User u ON c.user_id = u.id
        LEFT JOIN Flight f ON c.flight_id = f.flight_id
        WHERE c.user_id = %s AND c.flight_id = %s
    """
    check = execute_query(query, (user_id, flight_id), fetch_one=True)
    
    if not check:
        return jsonify({'error': {'code': 'not_found', 'message': 'Check-in not found'}}), 404
    
    result = {
        'user_id': check['user_id'],
        'flight_id': check['flight_id']
    }
    if check['user_name']:
        result['user'] = {
            'id': check['user_id'],
            'user_name': check['user_name'],
            'user_email': check['user_email']
        }
    if check['flight_no']:
        result['flight'] = {
            'flight_id': check['flight_id'],
            'flight_no': check['flight_no'],
            'origin_airport': check['origin_airport'],
            'destination_airport': check['destination_airport']
        }
    
    return jsonify({'data': result})

@checks_bp.route('', methods=['POST'])
def create_check():
    """Create a new check-in"""
    data = request.get_json()
    
    required_fields = ['user_id', 'flight_id']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': {'code': 'validation_error', 'message': f'Required fields: {", ".join(required_fields)}'}}), 400
    
    user_id = data['user_id']
    flight_id = data['flight_id']
    
    # Check for duplicate
    check_duplicate_query = "SELECT user_id, flight_id FROM Checks WHERE user_id = %s AND flight_id = %s"
    existing = execute_query(check_duplicate_query, (user_id, flight_id), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'User already checked into this flight'}}), 409
    
    # Validate foreign keys
    user_query = "SELECT id FROM User WHERE id = %s"
    user = execute_query(user_query, (user_id,), fetch_one=True)
    if not user:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid user_id'}}), 404
    
    flight_query = "SELECT flight_id FROM Flight WHERE flight_id = %s"
    flight = execute_query(flight_query, (flight_id,), fetch_one=True)
    if not flight:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid flight_id'}}), 404
    
    try:
        insert_query = "INSERT INTO Checks (user_id, flight_id) VALUES (%s, %s)"
        execute_update(insert_query, (user_id, flight_id))
        
        # Get the created check-in with related data
        get_query = """
            SELECT c.user_id, c.flight_id,
                   u.user_name, u.user_email,
                   f.flight_no, f.origin_airport, f.destination_airport
            FROM Checks c
            LEFT JOIN User u ON c.user_id = u.id
            LEFT JOIN Flight f ON c.flight_id = f.flight_id
            WHERE c.user_id = %s AND c.flight_id = %s
        """
        check = execute_query(get_query, (user_id, flight_id), fetch_one=True)
        
        result = {
            'user_id': check['user_id'],
            'flight_id': check['flight_id']
        }
        if check['user_name']:
            result['user'] = {
                'id': check['user_id'],
                'user_name': check['user_name'],
                'user_email': check['user_email']
            }
        if check['flight_no']:
            result['flight'] = {
                'flight_id': check['flight_id'],
                'flight_no': check['flight_no'],
                'origin_airport': check['origin_airport'],
                'destination_airport': check['destination_airport']
            }
        
        return jsonify({'data': result}), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400

@checks_bp.route('/<int:user_id>/<path:flight_id>', methods=['DELETE'])
def delete_check(user_id, flight_id):
    """Delete a check-in"""
    flight_id = unquote(flight_id)  # Handle URL encoding
    
    # Check if check-in exists
    check_query = "SELECT user_id, flight_id FROM Checks WHERE user_id = %s AND flight_id = %s"
    check = execute_query(check_query, (user_id, flight_id), fetch_one=True)
    if not check:
        return jsonify({'error': {'code': 'not_found', 'message': 'Check-in not found'}}), 404
    
    try:
        delete_query = "DELETE FROM Checks WHERE user_id = %s AND flight_id = %s"
        execute_update(delete_query, (user_id, flight_id))
        return jsonify({'message': 'Check-in deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
