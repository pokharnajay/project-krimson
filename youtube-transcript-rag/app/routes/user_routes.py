from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import get_user_by_id, update_credits

user_bp = Blueprint('user', __name__)

@user_bp.route('/credits', methods=['GET'])
@jwt_required()
def get_credits():
    """Get user credits"""
    user_id = get_jwt_identity()
    user = get_user_by_id(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'credits': user['credits'],
        'username': user['username']
    }), 200

@user_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get user profile"""
    user_id = get_jwt_identity()
    user = get_user_by_id(user_id)
    
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'id': user['id'],
        'username': user['username'],
        'credits': user['credits'],
        'created_at': user['created_at']
    }), 200
