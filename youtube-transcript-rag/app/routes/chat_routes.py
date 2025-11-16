from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.supabase_service import (
    create_chat,
    get_chat_by_id,
    get_chats_by_user,
    update_chat_title,
    delete_chat,
    get_messages_by_chat,
    get_chat_with_messages,
    get_user_by_id,
    get_source_by_id
)
from app.utils.logger import log_info, log_error, log_warning, log_debug

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('', methods=['GET'])
@jwt_required()
def get_chats():
    """
    Get all chats for current user
    Query params: ?search=keyword&limit=50&offset=0
    """
    user_id = get_jwt_identity()

    try:
        # Get query parameters
        search = request.args.get('search', '')
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))

        # Validate limit
        if limit < 1 or limit > 100:
            limit = 50

        log_debug(f"Fetching chats for user {user_id} (search={search}, limit={limit}, offset={offset})")

        # Get chats from database
        result = get_chats_by_user(user_id, limit=limit, offset=offset, search=search)

        return jsonify({
            'chats': result['chats'],
            'total': result['total'],
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        log_error(f"Failed to fetch chats: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch chats'}), 500


@chat_bp.route('/<chat_id>', methods=['GET'])
@jwt_required()
def get_chat(chat_id):
    """Get specific chat with all messages"""
    user_id = get_jwt_identity()

    try:
        log_debug(f"Fetching chat {chat_id} for user {user_id}")

        # Get chat with messages
        chat = get_chat_with_messages(chat_id)

        if not chat:
            log_warning(f"Chat {chat_id} not found")
            return jsonify({'error': 'Chat not found'}), 404

        # Verify ownership
        if chat['user_id'] != user_id:
            log_warning(f"User {user_id} attempted to access unauthorized chat {chat_id}")
            return jsonify({'error': 'You do not have access to this chat'}), 403

        return jsonify(chat), 200

    except Exception as e:
        log_error(f"Failed to fetch chat: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch chat'}), 500


@chat_bp.route('', methods=['POST'])
@jwt_required()
def create_new_chat():
    """
    Create new chat
    Body: { source_id: uuid, title: string (optional) }
    """
    user_id = get_jwt_identity()

    try:
        if not request.json:
            return jsonify({'error': 'Request body required'}), 400

        data = request.json
        source_id = data.get('source_id')

        if not source_id:
            return jsonify({'error': 'source_id is required'}), 400

        # Verify source exists and user owns it
        source = get_source_by_id(source_id)
        if not source:
            return jsonify({'error': 'Source not found'}), 404

        if source['user_id'] != user_id:
            return jsonify({'error': 'You do not have access to this source'}), 403

        # Create chat with default title (will be updated with first message)
        title = data.get('title', 'New Chat')

        log_info(f"Creating new chat for user {user_id} with source {source_id}")
        chat = create_chat(user_id, source_id, title)

        return jsonify(chat), 201

    except Exception as e:
        log_error(f"Failed to create chat: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to create chat'}), 500


@chat_bp.route('/<chat_id>', methods=['DELETE'])
@jwt_required()
def delete_chat_endpoint(chat_id):
    """Delete a chat"""
    user_id = get_jwt_identity()

    try:
        # Verify chat exists and user owns it
        chat = get_chat_by_id(chat_id)
        if not chat:
            return jsonify({'error': 'Chat not found'}), 404

        if chat['user_id'] != user_id:
            return jsonify({'error': 'You do not have access to this chat'}), 403

        log_info(f"Deleting chat {chat_id} for user {user_id}")
        delete_chat(chat_id)

        return jsonify({'message': 'Chat deleted successfully'}), 200

    except Exception as e:
        log_error(f"Failed to delete chat: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to delete chat'}), 500


@chat_bp.route('/<chat_id>/messages', methods=['GET'])
@jwt_required()
def get_chat_messages_endpoint(chat_id):
    """Get messages for a chat (with pagination)"""
    user_id = get_jwt_identity()

    try:
        # Verify chat exists and user owns it
        chat = get_chat_by_id(chat_id)
        if not chat:
            return jsonify({'error': 'Chat not found'}), 404

        if chat['user_id'] != user_id:
            return jsonify({'error': 'You do not have access to this chat'}), 403

        # Get pagination parameters
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))

        # Validate limit
        if limit < 1 or limit > 200:
            limit = 100

        messages = get_messages_by_chat(chat_id, limit=limit, offset=offset)

        return jsonify({
            'messages': messages,
            'chat_id': chat_id,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        log_error(f"Failed to fetch messages: {str(e)}", exc_info=True)
        return jsonify({'error': 'Failed to fetch messages'}), 500
