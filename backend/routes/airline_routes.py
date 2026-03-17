from flask import Blueprint, request, jsonify
from db_connection import get_db_connection, execute_query, execute_update
import uuid

airline_bp = Blueprint('airlines', __name__)


@airline_bp.route('', methods=['GET'])
def list_airlines():
    """List all airlines with pagination and search"""
    q = request.args.get('q', '', type=str)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    # Build query
    if q:
        query = """
            SELECT airline_id, airline_name 
            FROM Airline_Carrier 
            WHERE LOWER(airline_name) LIKE LOWER(%s)
            ORDER BY airline_name
            LIMIT %s OFFSET %s
        """
        count_query = """
            SELECT COUNT(*) as total 
            FROM Airline_Carrier 
            WHERE LOWER(airline_name) LIKE LOWER(%s)
        """
        params = (f'%{q}%', page_size, offset)
        count_params = (f'%{q}%',)
    else:
        query = """
            SELECT airline_id, airline_name 
            FROM Airline_Carrier 
            ORDER BY airline_name
            LIMIT %s OFFSET %s
        """
        count_query = "SELECT COUNT(*) as total FROM Airline_Carrier"
        params = (page_size, offset)
        count_params = None
    
    # Execute queries
    airlines = execute_query(query, params, fetch_all=True)
    total_result = execute_query(count_query, count_params, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    return jsonify({
        'data': airlines or [],
        'page': page,
        'page_size': page_size,
        'total': total
    })


@airline_bp.route('/<airline_id>', methods=['GET'])
def get_airline(airline_id):
    """Get a specific airline"""
    query = "SELECT airline_id, airline_name FROM Airline_Carrier WHERE airline_id = %s"
    airline = execute_query(query, (airline_id,), fetch_one=True)
    
    if not airline:
        return jsonify({'error': {'code': 'not_found', 'message': 'Airline not found'}}), 404
    
    return jsonify({'data': airline})


@airline_bp.route('', methods=['POST'])
def create_airline():
    """Create a new airline"""
    data = request.get_json()
    
    if not data or 'airline_name' not in data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'airline_name is required'}}), 400
    
    # Check for duplicates
    check_query = "SELECT airline_id FROM Airline_Carrier WHERE airline_name = %s"
    existing = execute_query(check_query, (data['airline_name'],), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'Airline with this name already exists'}}), 409
    
    # Generate airline_id if not provided
    airline_id = data.get('airline_id', '').strip()
    if not airline_id:
        name_words = data['airline_name'].split()
        if len(name_words) >= 2:
            airline_id = (name_words[0][0] + name_words[1][0]).upper()
        else:
            airline_id = data['airline_name'][:3].upper().replace(' ', '')
        
        # Ensure it's unique
        base_id = airline_id
        counter = 1
        while True:
            check_id_query = "SELECT airline_id FROM Airline_Carrier WHERE airline_id = %s"
            existing_id = execute_query(check_id_query, (airline_id,), fetch_one=True)
            if not existing_id:
                break
            airline_id = f"{base_id}{counter:02d}"
            counter += 1
            if counter > 99:
                airline_id = str(uuid.uuid4())[:8].upper()
                break
    
    try:
        insert_query = "INSERT INTO Airline_Carrier (airline_id, airline_name) VALUES (%s, %s)"
        execute_update(insert_query, (airline_id, data['airline_name']))
        
        # Return created airline
        return jsonify({'data': {'airline_id': airline_id, 'airline_name': data['airline_name']}}), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@airline_bp.route('/<airline_id>', methods=['PUT'])
def update_airline(airline_id):
    """Update an airline"""
    # Check if airline exists
    check_query = "SELECT airline_id, airline_name FROM Airline_Carrier WHERE airline_id = %s"
    airline = execute_query(check_query, (airline_id,), fetch_one=True)
    
    if not airline:
        return jsonify({'error': {'code': 'not_found', 'message': 'Airline not found'}}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    try:
        if 'airline_name' in data:
            # Check for duplicates if name is being changed
            duplicate_query = "SELECT airline_id FROM Airline_Carrier WHERE airline_name = %s AND airline_id != %s"
            existing = execute_query(duplicate_query, (data['airline_name'], airline_id), fetch_one=True)
            if existing:
                return jsonify({'error': {'code': 'duplicate_key', 'message': 'Airline with this name already exists'}}), 409
            
            update_query = "UPDATE Airline_Carrier SET airline_name = %s WHERE airline_id = %s"
            execute_update(update_query, (data['airline_name'], airline_id))
            airline['airline_name'] = data['airline_name']
        
        return jsonify({'data': airline})
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@airline_bp.route('/<airline_id>', methods=['DELETE'])
def delete_airline(airline_id):
    """Delete an airline"""
    # Check if airline exists
    check_query = "SELECT airline_id FROM Airline_Carrier WHERE airline_id = %s"
    airline = execute_query(check_query, (airline_id,), fetch_one=True)
    
    if not airline:
        return jsonify({'error': {'code': 'not_found', 'message': 'Airline not found'}}), 404
    
    try:
        delete_query = "DELETE FROM Airline_Carrier WHERE airline_id = %s"
        execute_update(delete_query, (airline_id,))
        return jsonify({'message': 'Airline deleted successfully'}), 200
    except Exception as e:
        # Check if foreign key constraint violation
        if 'foreign key constraint' in str(e).lower() or '1451' in str(e):
            return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Cannot delete airline: flights reference this airline'}}), 400
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
