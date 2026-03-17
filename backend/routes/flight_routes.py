from flask import Blueprint, request, jsonify
from urllib.parse import unquote
from db_connection import execute_query, execute_update

flight_bp = Blueprint('flights', __name__)


@flight_bp.route('', methods=['GET'])
def list_flights():
    """List all flights with pagination and search"""
    q = request.args.get('q', '', type=str)
    origin = request.args.get('origin', '', type=str)
    destination = request.args.get('destination', '', type=str)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    # Build WHERE conditions
    conditions = []
    params = []
    
    if q:
        conditions.append("flight_no LIKE %s")
        params.append(f'%{q}%')
    if origin:
        conditions.append("origin_airport = %s")
        params.append(origin)
    if destination:
        conditions.append("destination_airport = %s")
        params.append(destination)
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    query = f"""
        SELECT flight_id, flight_no, airline_id, origin_airport, 
               destination_airport, total_ops, percent_cancelled
        FROM Flight 
        WHERE {where_clause}
        ORDER BY flight_no
        LIMIT %s OFFSET %s
    """
    count_query = f"SELECT COUNT(*) as total FROM Flight WHERE {where_clause}"
    
    params.extend([page_size, offset])
    count_params = params[:-2]  # Remove LIMIT and OFFSET params
    
    flights = execute_query(query, tuple(params), fetch_all=True)
    total_result = execute_query(count_query, tuple(count_params) if count_params else None, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    # Calculate num_cancelled as actual count from percent_cancelled and total_ops
    # Also keep percent_cancelled in response for frontend to use directly
    for flight in flights or []:
        percent_cancelled = flight.get('percent_cancelled', 0) or 0
        total_ops = flight.get('total_ops', 0) or 0
        # Calculate actual number of cancelled flights
        if total_ops > 0:
            flight['num_cancelled'] = round((percent_cancelled / 100) * total_ops)
        else:
            flight['num_cancelled'] = 0
        flight['percent_cancelled'] = percent_cancelled  # Keep original for frontend
    
    return jsonify({
        'data': flights or [],
        'page': page,
        'page_size': page_size,
        'total': total
    })


@flight_bp.route('/<path:flight_id>', methods=['GET'])
def get_flight(flight_id):
    """Get a specific flight"""
    flight_id = unquote(flight_id)
    
    query = """
        SELECT flight_id, flight_no, airline_id, origin_airport, 
               destination_airport, total_ops, percent_cancelled
        FROM Flight 
        WHERE flight_id = %s
    """
    flight = execute_query(query, (flight_id,), fetch_one=True)
    
    if not flight:
        return jsonify({'error': {'code': 'not_found', 'message': 'Flight not found'}}), 404
    
    # Calculate num_cancelled as actual count from percent_cancelled and total_ops
    percent_cancelled = flight.get('percent_cancelled', 0) or 0
    total_ops = flight.get('total_ops', 0) or 0
    if total_ops > 0:
        flight['num_cancelled'] = round((percent_cancelled / 100) * total_ops)
    else:
        flight['num_cancelled'] = 0
    
    # Get related data
    airline_query = "SELECT airline_id, airline_name FROM Airline_Carrier WHERE airline_id = %s"
    origin_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
    dest_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
    
    airline = execute_query(airline_query, (flight['airline_id'],), fetch_one=True)
    origin = execute_query(origin_query, (flight['origin_airport'],), fetch_one=True)
    destination = execute_query(dest_query, (flight['destination_airport'],), fetch_one=True)
    
    flight['airline'] = airline
    flight['origin'] = origin
    flight['destination'] = destination
    
    return jsonify({'data': flight})


@flight_bp.route('', methods=['POST'])
def create_flight():
    """Create a new flight"""
    data = request.get_json()
    
    print(f"DEBUG: Creating flight with data: {data}")
    
    required_fields = ['flight_no', 'airline_id', 'origin_airport', 'destination_airport']
    if not data or not all(field in data for field in required_fields):
        missing = [f for f in required_fields if f not in data or not data[f]]
        error_msg = f'Missing required fields: {", ".join(missing)}'
        print(f"DEBUG: Validation error - {error_msg}")
        return jsonify({'error': {'code': 'validation_error', 'message': error_msg}}), 400
    
    # Validate origin != destination
    if data['origin_airport'] == data['destination_airport']:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Origin and destination must be different'}}), 400
    
    # Validate foreign keys
    airline_query = "SELECT airline_id FROM Airline_Carrier WHERE airline_id = %s"
    airline = execute_query(airline_query, (data['airline_id'],), fetch_one=True)
    if not airline:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid airline_id'}}), 404
    
    origin_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
    origin = execute_query(origin_query, (data['origin_airport'],), fetch_one=True)
    if not origin:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid origin_airport'}}), 404
    
    dest_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
    destination = execute_query(dest_query, (data['destination_airport'],), fetch_one=True)
    if not destination:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid destination_airport'}}), 404
    
    # Generate flight_id if not provided (format: airline_id + flight_no)
    flight_id = data.get('flight_id', '').strip()
    if not flight_id:
        flight_id = f"{data['airline_id']} {data['flight_no']}"
    
    # Check if flight_id already exists
    check_query = "SELECT flight_id FROM Flight WHERE flight_id = %s"
    existing_flight = execute_query(check_query, (flight_id,), fetch_one=True)
    if existing_flight:
        error_msg = f"Flight with ID '{flight_id}' already exists. Please use a different flight number or airline."
        print(f"DEBUG: Duplicate flight_id detected: {flight_id}")
        return jsonify({'error': {'code': 'duplicate_key', 'message': error_msg}}), 409
    
    try:
        insert_query = """
            INSERT INTO Flight (flight_id, flight_no, airline_id, origin_airport, 
                              destination_airport, total_ops, percent_cancelled)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        insert_params = (
            flight_id,
            data['flight_no'],
            data['airline_id'],
            data['origin_airport'],
            data['destination_airport'],
            data.get('total_ops', 0),
            data.get('num_cancelled', data.get('percent_cancelled', 0))
        )
        print(f"DEBUG: Executing INSERT with params: {insert_params}")
        
        execute_update(insert_query, insert_params)
        print(f"DEBUG: Flight created successfully: {flight_id}")
        
        # Return created flight
        return jsonify({
            'data': {
                'flight_id': flight_id,
                'flight_no': data['flight_no'],
                'airline_id': data['airline_id'],
                'origin_airport': data['origin_airport'],
                'destination_airport': data['destination_airport'],
                'total_ops': data.get('total_ops', 0),
                'num_cancelled': data.get('num_cancelled', data.get('percent_cancelled', 0))
            }
        }), 201
    except Exception as e:
        error_str = str(e)
        print(f"DEBUG: Database error creating flight: {error_str}")
        import traceback
        traceback.print_exc()
        
        # Handle duplicate key error specifically
        if '1062' in error_str or 'Duplicate entry' in error_str:
            # Extract the duplicate value from error message
            import re
            match = re.search(r"Duplicate entry '([^']+)'", error_str)
            duplicate_value = match.group(1) if match else flight_id
            error_msg = f"Flight with ID '{duplicate_value}' already exists. Please use a different flight number or airline."
            return jsonify({'error': {'code': 'duplicate_key', 'message': error_msg}}), 409
        
        return jsonify({'error': {'code': 'database_error', 'message': error_str}}), 400


@flight_bp.route('/<path:flight_id>', methods=['PUT'])
def update_flight(flight_id):
    """Update a flight"""
    flight_id = unquote(flight_id)
    
    # Check if flight exists
    check_query = "SELECT * FROM Flight WHERE flight_id = %s"
    flight = execute_query(check_query, (flight_id,), fetch_one=True)
    
    if not flight:
        return jsonify({'error': {'code': 'not_found', 'message': 'Flight not found'}}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    # Validate origin != destination if being updated
    origin = data.get('origin_airport', flight['origin_airport'])
    destination = data.get('destination_airport', flight['destination_airport'])
    if origin == destination:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Origin and destination must be different'}}), 400
    
    # Validate foreign keys if being updated
    if 'airline_id' in data:
        airline_query = "SELECT airline_id FROM Airline_Carrier WHERE airline_id = %s"
        airline = execute_query(airline_query, (data['airline_id'],), fetch_one=True)
        if not airline:
            return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid airline_id'}}), 404
    
    if 'origin_airport' in data:
        origin_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
        origin_check = execute_query(origin_query, (data['origin_airport'],), fetch_one=True)
        if not origin_check:
            return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid origin_airport'}}), 404
    
    if 'destination_airport' in data:
        dest_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
        dest_check = execute_query(dest_query, (data['destination_airport'],), fetch_one=True)
        if not dest_check:
            return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid destination_airport'}}), 404
    
    try:
        updates = []
        params = []
        
        if 'flight_no' in data:
            updates.append("flight_no = %s")
            params.append(data['flight_no'])
        if 'airline_id' in data:
            updates.append("airline_id = %s")
            params.append(data['airline_id'])
        if 'origin_airport' in data:
            updates.append("origin_airport = %s")
            params.append(data['origin_airport'])
        if 'destination_airport' in data:
            updates.append("destination_airport = %s")
            params.append(data['destination_airport'])
        if 'total_ops' in data:
            updates.append("total_ops = %s")
            params.append(data['total_ops'])
        if 'num_cancelled' in data or 'percent_cancelled' in data:
            updates.append("percent_cancelled = %s")
            params.append(data.get('num_cancelled', data.get('percent_cancelled', 0)))
        
        if not updates:
            # Return current flight data
            get_query = """
                SELECT flight_id, flight_no, airline_id, origin_airport, 
                       destination_airport, total_ops, percent_cancelled
                FROM Flight WHERE flight_id = %s
            """
            flight_data = execute_query(get_query, (flight_id,), fetch_one=True)
            flight_data['num_cancelled'] = flight_data.get('percent_cancelled', 0) or 0
            return jsonify({'data': flight_data})
        
        params.append(flight_id)
        update_query = f"UPDATE Flight SET {', '.join(updates)} WHERE flight_id = %s"
        execute_update(update_query, tuple(params))
        
        # Return updated flight
        get_query = """
            SELECT flight_id, flight_no, airline_id, origin_airport, 
                   destination_airport, total_ops, percent_cancelled
            FROM Flight WHERE flight_id = %s
        """
        flight_data = execute_query(get_query, (flight_id,), fetch_one=True)
        flight_data['num_cancelled'] = flight_data.get('percent_cancelled', 0) or 0
        return jsonify({'data': flight_data})
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@flight_bp.route('/<path:flight_id>', methods=['DELETE'])
def delete_flight(flight_id):
    """Delete a flight"""
    flight_id = unquote(flight_id)
    
    check_query = "SELECT flight_id FROM Flight WHERE flight_id = %s"
    flight = execute_query(check_query, (flight_id,), fetch_one=True)
    
    if not flight:
        return jsonify({'error': {'code': 'not_found', 'message': 'Flight not found'}}), 404
    
    try:
        delete_query = "DELETE FROM Flight WHERE flight_id = %s"
        execute_update(delete_query, (flight_id,))
        return jsonify({'message': 'Flight deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
