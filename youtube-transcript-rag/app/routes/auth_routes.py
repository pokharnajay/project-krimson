from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from app.services.supabase_service import get_user, check_password

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """Login and get access + refresh tokens"""
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    
    user = get_user(username)
    if not user or not check_password(password, user['password_hash']):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    # Create tokens with user ID as identity
    access_token = create_access_token(identity=str(user['id']))
    refresh_token = create_refresh_token(identity=str(user['id']))
    
    return jsonify({
        'access_token': access_token,
        'refresh_token': refresh_token,
        'expires_in': 3600,
        'user': {
            'id': user['id'],
            'username': user['username']
        }
    }), 200

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    current_user_id = get_jwt_identity()
    new_access_token = create_access_token(identity=current_user_id)
    
    return jsonify({
        'access_token': new_access_token,
        'expires_in': 3600
    }), 200
