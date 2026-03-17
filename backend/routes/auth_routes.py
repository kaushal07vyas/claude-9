from flask import Blueprint, request, jsonify
from db_connection import execute_query, execute_update

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/login', methods=['POST'])
def login():
    """Login endpoint - simple email/password check"""
    data = request.get_json()
    
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({'error': {'code': 'validation_error', 'message': 'Email and password are required'}}), 400
    
    query = """
        SELECT id, user_name, user_email, password, dob, phone_number, 
               state, country, role
        FROM User 
        WHERE user_email = %s
    """
    user = execute_query(query, (data['email'],), fetch_one=True)
    
    if not user:
        return jsonify({'error': {'code': 'invalid_credentials', 'message': 'Invalid email or password'}}), 401
    
    # Simple password check (in production, use proper hashing)
    if user['password'] != data['password']:
        return jsonify({'error': {'code': 'invalid_credentials', 'message': 'Invalid email or password'}}), 401
    
    # Return user data without password
    user_safe = {
        'id': user['id'],
        'user_name': user['user_name'],
        'user_email': user['user_email'],
        'dob': str(user['dob']) if user['dob'] else None,
        'phone_number': user['phone_number'],
        'state': user['state'],
        'country': user['country'],
        'role': user['role']
    }
    
    return jsonify({
        'data': {
            'user': user_safe,
            'message': 'Login successful'
        }
    })


@auth_bp.route('/signup', methods=['POST'])
def signup():
    """Sign up endpoint - create new user"""
    data = request.get_json()
    
    required_fields = ['user_name', 'user_email', 'password', 'dob', 'country']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': {'code': 'validation_error', 'message': f'Required fields: {", ".join(required_fields)}'}}), 400
    
    # Check if user already exists
    check_query = "SELECT id FROM User WHERE user_email = %s"
    existing = execute_query(check_query, (data['user_email'],), fetch_one=True)
    if existing:
        return jsonify({'error': {'code': 'duplicate_key', 'message': 'User with this email already exists'}}), 409
    
    try:
        insert_query = """
            INSERT INTO User (user_name, user_email, password, dob, phone_number, state, country, role)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        execute_update(insert_query, (
            data['user_name'],
            data['user_email'],
            data['password'],
            data['dob'],
            data.get('phone_number'),
            data.get('state'),
            data['country'],
            'User'  # Default role
        ))
        
        # Get created user
        get_query = """
            SELECT id, user_name, user_email, dob, phone_number, state, country, role
            FROM User 
            WHERE user_email = %s
        """
        user = execute_query(get_query, (data['user_email'],), fetch_one=True)
        
        user_safe = {
            'id': user['id'],
            'user_name': user['user_name'],
            'user_email': user['user_email'],
            'dob': str(user['dob']) if user['dob'] else None,
            'phone_number': user['phone_number'],
            'state': user['state'],
            'country': user['country'],
            'role': user['role']
        }
        
        return jsonify({
            'data': {
                'user': user_safe,
                'message': 'User created successfully'
            }
        }), 201
    except Exception as e:
        return jsonify({'error': {'code': 'database_error', 'message': str(e)}}), 400
