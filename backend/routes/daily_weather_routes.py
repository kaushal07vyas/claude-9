from flask import Blueprint, request, jsonify
from db_connection import execute_query, execute_update
from datetime import datetime

daily_weather_bp = Blueprint('daily_weather', __name__)


@daily_weather_bp.route('', methods=['GET'])
def list_daily_weather():
    """List all daily weather records with pagination and search"""
    station_id = request.args.get('station_id', type=str)
    date_str = request.args.get('date', type=str)
    page = request.args.get('page', 1, type=int)
    page_size = request.args.get('page_size', 20, type=int)
    
    offset = (page - 1) * page_size
    
    conditions = []
    params = []
    
    if station_id:
        conditions.append("station_id = %s")
        params.append(station_id)
    if date_str:
        try:
            date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
            conditions.append("date = %s")
            params.append(date_obj)
        except ValueError:
            return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    where_clause = " AND ".join(conditions) if conditions else "1=1"
    
    query = f"""
        SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
               awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
               fog_flag, thunder_flag
        FROM Daily_Weather
        WHERE {where_clause}
        ORDER BY date DESC
        LIMIT %s OFFSET %s
    """
    count_query = f"SELECT COUNT(*) as total FROM Daily_Weather WHERE {where_clause}"
    
    params.extend([page_size, offset])
    count_params = params[:-2]
    
    weather_records = execute_query(query, tuple(params), fetch_all=True)
    total_result = execute_query(count_query, tuple(count_params) if count_params else None, fetch_one=True)
    total = total_result['total'] if total_result else 0
    
    # Add airport info for each record and format dates
    results = []
    for dw in weather_records or []:
        airport_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
        airport = execute_query(airport_query, (dw['station_id'],), fetch_one=True)
        dw['airport'] = airport
        # Convert date to ISO format string if it's a date object
        if dw.get('date') and hasattr(dw['date'], 'isoformat'):
            dw['date'] = dw['date'].isoformat()
        results.append(dw)
    
    return jsonify({
        'data': results,
        'page': page,
        'page_size': page_size,
        'total': total
    })


@daily_weather_bp.route('/<station_id>/<date>', methods=['GET'])
def get_daily_weather(station_id, date):
    """Get a specific daily weather record"""
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    query = """
        SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
               awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
               fog_flag, thunder_flag
        FROM Daily_Weather
        WHERE station_id = %s AND date = %s
    """
    dw = execute_query(query, (station_id, date_obj), fetch_one=True)
    
    if not dw:
        return jsonify({'error': {'code': 'not_found', 'message': 'Daily weather record not found'}}), 404
    
    airport_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
    airport = execute_query(airport_query, (station_id,), fetch_one=True)
    dw['airport'] = airport
    
    # Convert date to ISO format string if it's a date object
    if dw.get('date') and hasattr(dw['date'], 'isoformat'):
        dw['date'] = dw['date'].isoformat()
    
    return jsonify({'data': dw})


@daily_weather_bp.route('', methods=['POST'])
def create_daily_weather():
    """Create a new daily weather record"""
    data = request.get_json()
    
    required_fields = ['date', 'station_id']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': {'code': 'validation_error', 'message': f'Required fields: {", ".join(required_fields)}'}}), 400
    
    try:
        date_obj = datetime.strptime(data['date'], '%Y-%m-%d').date() if isinstance(data['date'], str) else data['date']
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    # Check for duplicate composite key
    check_query = "SELECT date, station_id FROM Daily_Weather WHERE station_id = %s AND date = %s"
    existing = execute_query(check_query, (data['station_id'], date_obj), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'Daily weather already exists for this station and date'}}), 409
    
    # Validate foreign key
    airport_query = "SELECT airport_code FROM Airport WHERE airport_code = %s"
    airport = execute_query(airport_query, (data['station_id'],), fetch_one=True)
    if not airport:
        return jsonify({'error': {'code': 'foreign_key_error', 'message': 'Invalid station_id'}}), 404
    
    try:
        insert_query = """
            INSERT INTO Daily_Weather (date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
                                      awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
                                      fog_flag, thunder_flag)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        execute_update(insert_query, (
            date_obj,
            data['station_id'],
            data.get('prcp_mm'),
            data.get('snow_mm'),
            data.get('snow_depth_mm'),
            data.get('awwnd_ms'),
            data.get('wsf2_ms'),
            data.get('gust_ms'),
            data.get('tmin_c'),
            data.get('cloud_day_frac'),
            1 if (data.get('fog_flag', False) in (True, 'true', '1', 'yes') or str(data.get('fog_flag', False)).lower() == 'true') else 0,
            1 if (data.get('thunder_flag', False) in (True, 'true', '1', 'yes') or str(data.get('thunder_flag', False)).lower() == 'true') else 0
        ))
        
        # Return created record
        get_query = """
            SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
                   awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
                   fog_flag, thunder_flag
            FROM Daily_Weather
            WHERE station_id = %s AND date = %s
        """
        dw = execute_query(get_query, (data['station_id'], date_obj), fetch_one=True)
        airport_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
        airport = execute_query(airport_query, (data['station_id'],), fetch_one=True)
        dw['airport'] = airport
        # Convert date to ISO format string if it's a date object
        if dw.get('date') and hasattr(dw['date'], 'isoformat'):
            dw['date'] = dw['date'].isoformat()
        return jsonify({'data': dw}), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@daily_weather_bp.route('/<station_id>/<date>', methods=['PUT'])
def update_daily_weather(station_id, date):
    """Update a daily weather record"""
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    check_query = "SELECT * FROM Daily_Weather WHERE station_id = %s AND date = %s"
    dw = execute_query(check_query, (station_id, date_obj), fetch_one=True)
    
    if not dw:
        return jsonify({'error': {'code': 'not_found', 'message': 'Daily weather record not found'}}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'No data provided'}}), 400
    
    try:
        updates = []
        params = []
        
        if 'prcp_mm' in data:
            updates.append("prcp_mm = %s")
            params.append(data['prcp_mm'])
        if 'snow_mm' in data:
            updates.append("snow_mm = %s")
            params.append(data['snow_mm'])
        if 'snow_depth_mm' in data:
            updates.append("snow_depth_mm = %s")
            params.append(data['snow_depth_mm'])
        if 'awwnd_ms' in data:
            updates.append("awwnd_ms = %s")
            params.append(data['awwnd_ms'])
        if 'wsf2_ms' in data:
            updates.append("wsf2_ms = %s")
            params.append(data['wsf2_ms'])
        if 'gust_ms' in data:
            updates.append("gust_ms = %s")
            params.append(data['gust_ms'])
        if 'tmin_c' in data:
            updates.append("tmin_c = %s")
            params.append(data['tmin_c'])
        if 'cloud_day_frac' in data:
            updates.append("cloud_day_frac = %s")
            params.append(data['cloud_day_frac'])
        if 'fog_flag' in data:
            updates.append("fog_flag = %s")
            # Convert to boolean/int: handle string 'true'/'false', boolean True/False, or 1/0
            fog_value = data['fog_flag']
            if isinstance(fog_value, str):
                fog_value = fog_value.lower() in ('true', '1', 'yes')
            params.append(1 if fog_value else 0)
        if 'thunder_flag' in data:
            updates.append("thunder_flag = %s")
            # Convert to boolean/int: handle string 'true'/'false', boolean True/False, or 1/0
            thunder_value = data['thunder_flag']
            if isinstance(thunder_value, str):
                thunder_value = thunder_value.lower() in ('true', '1', 'yes')
            params.append(1 if thunder_value else 0)
        
        if not updates:
            get_query = """
                SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
                       awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
                       fog_flag, thunder_flag
                FROM Daily_Weather WHERE station_id = %s AND date = %s
            """
            dw_data = execute_query(get_query, (station_id, date_obj), fetch_one=True)
            airport_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
            airport = execute_query(airport_query, (station_id,), fetch_one=True)
            dw_data['airport'] = airport
            # Convert date to ISO format string if it's a date object
            if dw_data.get('date') and hasattr(dw_data['date'], 'isoformat'):
                dw_data['date'] = dw_data['date'].isoformat()
            return jsonify({'data': dw_data})
        
        params.extend([station_id, date_obj])
        update_query = f"UPDATE Daily_Weather SET {', '.join(updates)} WHERE station_id = %s AND date = %s"
        execute_update(update_query, tuple(params))
        
        # Return updated record
        get_query = """
            SELECT date, station_id, prcp_mm, snow_mm, snow_depth_mm, 
                   awwnd_ms, wsf2_ms, gust_ms, tmin_c, cloud_day_frac, 
                   fog_flag, thunder_flag
            FROM Daily_Weather WHERE station_id = %s AND date = %s
        """
        dw_data = execute_query(get_query, (station_id, date_obj), fetch_one=True)
        airport_query = "SELECT airport_code, airport_name, city, country FROM Airport WHERE airport_code = %s"
        airport = execute_query(airport_query, (station_id,), fetch_one=True)
        dw_data['airport'] = airport
        # Convert date to ISO format string if it's a date object
        if dw_data.get('date') and hasattr(dw_data['date'], 'isoformat'):
            dw_data['date'] = dw_data['date'].isoformat()
        return jsonify({'data': dw_data})
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400


@daily_weather_bp.route('/<station_id>/<date>', methods=['DELETE'])
def delete_daily_weather(station_id, date):
    """Delete a daily weather record"""
    try:
        date_obj = datetime.strptime(date, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Invalid date format. Use YYYY-MM-DD'}}), 400
    
    check_query = "SELECT date, station_id FROM Daily_Weather WHERE station_id = %s AND date = %s"
    dw = execute_query(check_query, (station_id, date_obj), fetch_one=True)
    
    if not dw:
        return jsonify({'error': {'code': 'not_found', 'message': 'Daily weather record not found'}}), 404
    
    try:
        delete_query = "DELETE FROM Daily_Weather WHERE station_id = %s AND date = %s"
        execute_update(delete_query, (station_id, date_obj))
        return jsonify({'message': 'Daily weather deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
