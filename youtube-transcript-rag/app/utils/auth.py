from functools import wraps
from flask import request, jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from config.settings import Config

def admin_required(fn):
    """Decorator for admin-only endpoints"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        api_key = request.headers.get('X-Admin-API-Key')
        if api_key != Config.ADMIN_API_KEY:
            return jsonify({'error': 'Admin access required'}), 403
        return fn(*args, **kwargs)
    return wrapper

def token_required(fn):
    """Decorator for JWT-protected endpoints"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
            return fn(*args, **kwargs)
        except Exception as e:
            return jsonify({'error': 'Invalid or expired token'}), 401
    return wrapper
