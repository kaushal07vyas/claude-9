from flask import Blueprint, request, jsonify
from db_connection import execute_query, execute_update

airport_bp = Blueprint('airports', __name__)


@airport_bp.route('', methods=['GET'])
def list_airports():
    """List all airports with pagination and search"""
    q = request.args.get('q', '', type=str)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    if q:
        query = """
            SELECT airport_code, airport_name, city, country 
            FROM Airport 
            WHERE LOWER(airport_code) LIKE LOWER(%s)
               OR LOWER(airport_name) LIKE LOWER(%s)
               OR LOWER(city) LIKE LOWER(%s)
            ORDER BY airport_code
            LIMIT %s OFFSET %s
        """
        count_query = """
            SELECT COUNT(*) as total 
            FROM Airport 
            WHERE LOWER(airport_code) LIKE LOWER(%s)
               OR LOWER(airport_name) LIKE LOWER(%s)
               OR LOWER(city) LIKE LOWER(%s)
        """
        search_term = f'%{q}%'
        params = (search_term, search_term, search_term, page_size, offset)
        count_params = (search_term, search_term, search_term)
    else:
        query = """
            SELECT airport_code, airport_name, city, country 
            FROM Airport 
            ORDER BY airport_code
            LIMIT %s OFFSET %s
        """
        count_query = "SELECT COUNT(*) as total FROM Airport"
        params = (page_size, offset)
        count_params = None
    
    airports = execute_query(query, params, fetch_all=True)
    total_result = execute_query(count_query, count_params, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    return jsonify({
        'data': airports or [],
        'page': page,
        'page_size': page_size,
        'total': total
    })


@airport_bp.route('/<airport_code>', methods=['GET'])
def get_airport(airport_code):
    """Get a specific airport"""
    query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
    airport = execute_query(query, (airport_code,), fetch_one=True)
    
    if not airport:
        return jsonify({'error': {'code': 'not_found', 'message': 'Airport not found'}}), 404
    
    return jsonify({'data': airport})


@airport_bp.route('', methods=['POST'])
def create_airport():
    """Create a new airport"""
    data = request.get_json()
    
    required_fields = ['airport_code', 'airport_name', 'city', 'country']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': {'code': 'validation_error', 'message': f'Required fields: {", ".join(required_fields)}'}}), 400
    
    # Check for duplicates
    check_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
    existing = execute_query(check_query, (data['airport_code'],), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'Airport with this code already exists'}}), 409
    
    try:
        insert_query = """
            INSERT INTO Airport (airport_code, airport_name, city, country) 
            VALUES (%s, %s, %s, %s)
        """
        execute_update(insert_query, (
            data['airport_code'],
            data['airport_name'],
            data['city'],
            data['country']
        ))
        
        # Return created airport
        return jsonify({
            'data': {
                'airport_code': data['airport_code'],
                'airport_name': data['airport_name'],
                'city': data['city'],
                'country': data['country']
            }
        }), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@airport_bp.route('/<airport_code>', methods=['PUT'])
def update_airport(airport_code):
    """Update an airport"""
    check_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
    airport = execute_query(check_query, (airport_code,), fetch_one=True)
    
    if not airport:
        return jsonify({'error': {'code': 'not_found', 'message': 'Airport not found'}}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    try:
        updates = []
        params = []
        
        if 'airport_name' in data:
            updates.append("airport_name = %s")
            params.append(data['airport_name'])
        if 'city' in data:
            updates.append("city = %s")
            params.append(data['city'])
        if 'country' in data:
            updates.append("country = %s")
            params.append(data['country'])
        
        if not updates:
            # No updates, return current data
            get_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
            return jsonify({'data': execute_query(get_query, (airport_code,), fetch_one=True)})
        
        params.append(airport_code)
        update_query = f"UPDATE Airport SET {', '.join(updates)} WHERE airport_code = %s"
        execute_update(update_query, tuple(params))
        
        # Return updated airport
        get_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
        return jsonify({'data': execute_query(get_query, (airport_code,), fetch_one=True)})
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@airport_bp.route('/<airport_code>', methods=['DELETE'])
def delete_airport(airport_code):
    """Delete an airport"""
    check_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
    airport = execute_query(check_query, (airport_code,), fetch_one=True)
    
    if not airport:
        return jsonify({'error': {'code': 'not_found', 'message': 'Airport not found'}}), 404
    
    try:
        delete_query = "DELETE FROM Airport WHERE airport_code = %s"
        execute_update(delete_query, (airport_code,))
        return jsonify({'message': 'Airport deleted successfully'}), 200
    except Exception as e:
        if 'foreign key constraint' in str(e).lower() or '1451' in str(e):
            return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Cannot delete airport: flights or other records reference this airport'}}), 400
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
