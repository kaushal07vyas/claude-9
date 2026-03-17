from flask import Blueprint, request, jsonify
from db_connection import execute_query, execute_update
from datetime import datetime

fare_history_bp = Blueprint('fare_history', __name__)


@fare_history_bp.route('', methods=['GET'])
def list_fare_history():
    """List all fare history records with pagination and search"""
    flight_id = request.args.get('flight_id', type=str)
    year = request.args.get('year', type=int)
    quarter = request.args.get('quarter', type=int)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    conditions = []
    params = []
    
    if flight_id:
        conditions.append("flight_id = %s")
        params.append(flight_id)
    if year:
        conditions.append("year = %s")
        params.append(year)
    if quarter:
        conditions.append("quarter = %s")
        params.append(quarter)
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    query = f"""
        SELECT flight_id, year, quarter, mean_fare, num_passenger
        FROM Fare_History
        WHERE {where_clause}
        ORDER BY year DESC, quarter DESC, flight_id
        LIMIT %s OFFSET %s
    """
    count_query = f"SELECT COUNT(*) as total FROM Fare_History WHERE {where_clause}"
    
    params.extend([page_size, offset])
    count_params = params[:-2]
    
    fare_records = execute_query(query, tuple(params), fetch_all=True)
    total_result = execute_query(count_query, tuple(count_params) if count_params else None, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    # Format results
    results = []
    for fh in fare_records or []:
        # Convert Decimal to float for JSON serialization
        if fh.get('mean_fare'):
            fh['mean_fare'] = float(fh['mean_fare'])
        # Ensure year and quarter are integers
        if fh.get('year'):
            fh['year'] = int(fh['year'])
        if fh.get('quarter'):
            fh['quarter'] = int(fh['quarter'])
        results.append(fh)
    
    return jsonify({
        'data': results,
        'page': page,
        'page_size': page_size,
        'total': total
    })


@fare_history_bp.route('/<path:flight_id>/<int:year>/<int:quarter>', methods=['GET'])
def get_fare_history(flight_id, year, quarter):
    """Get a specific fare history record"""
    # URL decode flight_id in case it has spaces
    from urllib.parse import unquote
    flight_id = unquote(flight_id)
    
    # Validate quarter
    if quarter < 1 or quarter > 4:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Quarter must be between 1 and 4'}}), 400
    
    query = """
        SELECT flight_id, year, quarter, mean_fare, num_passenger
        FROM Fare_History
        WHERE flight_id = %s AND year = %s AND quarter = %s
    """
    fh = execute_query(query, (flight_id, year, quarter), fetch_one=True)
    
    if not fh:
        return jsonify({'error': {'code': 'not_found', 'message': 'Fare history record not found'}}), 404
    
    # Convert Decimal to float
    if fh.get('mean_fare'):
        fh['mean_fare'] = float(fh['mean_fare'])
    
    # Ensure year and quarter are integers
    if fh.get('year'):
        fh['year'] = int(fh['year'])
    if fh.get('quarter'):
        fh['quarter'] = int(fh['quarter'])
    
    return jsonify({'data': fh})


@fare_history_bp.route('', methods=['POST'])
def create_fare_history():
    """Create a new fare history record"""
    data = request.get_json()
    
    required_fields = ['flight_id', 'year', 'quarter', 'mean_fare', 'num_passenger']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': {'code': 'validation_error', 'message': f'Required fields: {", ".join(required_fields)}'}}), 400
    
    # Validate quarter
    if data['quarter'] < 1 or data['quarter'] > 4:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Quarter must be between 1 and 4'}}), 400
    
    # Check for duplicate composite key
    check_query = """
        SELECT flight_id, year, quarter 
        FROM Fare_History
        WHERE flight_id = %s AND year = %s AND quarter = %s
    """
    existing = execute_query(check_query, (data['flight_id'], data['year'], data['quarter']), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'Fare history already exists for this flight, year, and quarter'}}), 409
    
    # Validate foreign key - check if flight exists
    flight_query = "SELECT flight_id FROM Flight WHERE flight_id = %s"
    flight = execute_query(flight_query, (data['flight_id'],), fetch_one=True)
    if not flight:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid flight_id'}}), 404
    
    try:
        # Calculate fare_date from year and quarter (first day of the quarter)
        # Q1=Jan (month 1), Q2=Apr (month 4), Q3=Jul (month 7), Q4=Oct (month 10)
        quarter_start_months = {1: 1, 2: 4, 3: 7, 4: 10}
        fare_date = datetime(int(data['year']), quarter_start_months[int(data['quarter'])], 1).date()
        
        insert_query = """
            INSERT INTO Fare_History (flight_id, year, quarter, fare_date, mean_fare, num_passenger)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        execute_update(insert_query, (
            data['flight_id'],
            int(data['year']),
            int(data['quarter']),
            fare_date,
            float(data['mean_fare']),
            int(data['num_passenger'])
        ))
        
        # Return created record
        get_query = """
            SELECT flight_id, year, quarter, mean_fare, num_passenger
            FROM Fare_History
            WHERE flight_id = %s AND year = %s AND quarter = %s
        """
        fh = execute_query(get_query, (data['flight_id'], data['year'], data['quarter']), fetch_one=True)
        
        if fh.get('mean_fare'):
            fh['mean_fare'] = float(fh['mean_fare'])
        
        # Ensure year and quarter are integers
        if fh.get('year'):
            fh['year'] = int(fh['year'])
        if fh.get('quarter'):
            fh['quarter'] = int(fh['quarter'])
        
        return jsonify({'data': fh}), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@fare_history_bp.route('/<path:flight_id>/<int:year>/<int:quarter>', methods=['PUT'])
def update_fare_history(flight_id, year, quarter):
    """Update a fare history record"""
    # URL decode flight_id
    from urllib.parse import unquote
    flight_id = unquote(flight_id)
    
    # Validate quarter
    if quarter < 1 or quarter > 4:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Quarter must be between 1 and 4'}}), 400
    
    check_query = """
        SELECT flight_id, year, quarter, mean_fare, num_passenger
        FROM Fare_History
        WHERE flight_id = %s AND year = %s AND quarter = %s
    """
    fh = execute_query(check_query, (flight_id, year, quarter), fetch_one=True)
    
    if not fh:
        return jsonify({'error': {'code': 'not_found', 'message': 'Fare history record not found'}}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    try:
        updates = []
        params = []
        
        if 'mean_fare' in data:
            updates.append("mean_fare = %s")
            params.append(float(data['mean_fare']))
        if 'num_passenger' in data:
            updates.append("num_passenger = %s")
            params.append(int(data['num_passenger']))
        
        if not updates:
            # No updates, return current record
            if fh.get('mean_fare'):
                fh['mean_fare'] = float(fh['mean_fare'])
            if fh.get('year'):
                fh['year'] = int(fh['year'])
            if fh.get('quarter'):
                fh['quarter'] = int(fh['quarter'])
            return jsonify({'data': fh})
        
        params.extend([flight_id, year, quarter])
        update_query = f"UPDATE Fare_History SET {', '.join(updates)} WHERE flight_id = %s AND year = %s AND quarter = %s"
        
        # Log the update for debugging
        print(f"DEBUG: Updating fare history")
        print(f"  flight_id: {flight_id}")
        print(f"  year: {year}")
        print(f"  quarter: {quarter}")
        print(f"  update_query: {update_query}")
        print(f"  params: {params}")
        
        affected_rows = execute_update(update_query, tuple(params))
        print(f"DEBUG: Update affected {affected_rows} rows")
        
        if affected_rows == 0:
            print(f"DEBUG: WARNING - No rows updated! Record may not exist with flight_id={flight_id}, year={year}, quarter={quarter}")
            return jsonify({'error': {'code': 'not_found', 'message': f'No rows were updated. Record may not exist with flight_id={flight_id}, year={year}, quarter={quarter}'}}), 404
        
        # Return updated record
        get_query = """
            SELECT flight_id, year, quarter, mean_fare, num_passenger
            FROM Fare_History
            WHERE flight_id = %s AND year = %s AND quarter = %s
        """
        fh = execute_query(get_query, (flight_id, year, quarter), fetch_one=True)
        
        if fh.get('mean_fare'):
            fh['mean_fare'] = float(fh['mean_fare'])
        
        # Ensure year and quarter are integers
        if fh.get('year'):
            fh['year'] = int(fh['year'])
        if fh.get('quarter'):
            fh['quarter'] = int(fh['quarter'])
        
        return jsonify({'data': fh})
    except Exception as e:
        print(f"DEBUG: Error updating fare history: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@fare_history_bp.route('/<path:flight_id>/<int:year>/<int:quarter>', methods=['DELETE'])
def delete_fare_history(flight_id, year, quarter):
    """Delete a fare history record"""
    # URL decode flight_id
    from urllib.parse import unquote
    flight_id = unquote(flight_id)
    
    # Validate quarter
    if quarter < 1 or quarter > 4:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Quarter must be between 1 and 4'}}), 400
    
    # Check if record exists
    check_query = """
        SELECT flight_id, year, quarter 
        FROM Fare_History
        WHERE flight_id = %s AND year = %s AND quarter = %s
    """
    existing = execute_query(check_query, (flight_id, year, quarter), fetch_one=True)
    
    if not existing:
        return jsonify({'error': {'code': 'not_found', 'message': 'Fare history record not found'}}), 404
    
    try:
        delete_query = """
            DELETE FROM Fare_History
            WHERE flight_id = %s AND year = %s AND quarter = %s
        """
        execute_update(delete_query, (flight_id, year, quarter))
        return jsonify({'message': 'Fare history record deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
