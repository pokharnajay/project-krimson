from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.pinecone_service import PineconeService
from app.services.ai_service import AIService
from app.services.supabase_service import (
    update_credits,
    get_user_by_id,
    get_source_by_id,
    create_chat,
    create_message,
    update_chat_title
)
from app.utils.logger import log_info, log_error, log_warning, log_debug
from config.settings import Config
import os
import json

query_bp = Blueprint('query', __name__)

@query_bp.route('/ask', methods=['POST'])
@jwt_required()
def ask_question():
    """Ask question about video(s) using RAG"""
    user_id = get_jwt_identity()

    try:
        # Validate request data
        if not request.json:
            log_warning(f"Empty request body from user {user_id}")
            return jsonify({'error': 'Request body required'}), 400

        data = request.json
        question = data.get('question') or data.get('query')  # Support both field names
        video_ids = data.get('video_ids')
        source_id = data.get('source_id')
        chat_id = data.get('chat_id')  # Optional: existing chat ID
        model = data.get('model', 'openrouter/auto')
        # Use Config.TOP_K_RESULTS as default instead of hardcoded 5
        top_k = data.get('top_k') or Config.TOP_K_RESULTS

        # Validate question
        if not question or not question.strip():
            log_warning(f"Empty question from user {user_id}")
            return jsonify({'error': 'Question is required'}), 400

        if len(question) > 500:
            log_warning(f"Question too long from user {user_id}: {len(question)} chars")
            return jsonify({'error': 'Question must be less than 500 characters'}), 400

        # Validate top_k parameter
        if not isinstance(top_k, int) or top_k < 1 or top_k > 50:
            log_debug(f"Invalid top_k value {top_k}, using config default: {Config.TOP_K_RESULTS}")
            top_k = Config.TOP_K_RESULTS

        log_info(f"Query request from user {user_id}: '{question[:50]}...'")

        # Check if user exists and has credits
        user = get_user_by_id(user_id)
        if not user:
            log_error(f"User {user_id} not found in database")
            return jsonify({'error': 'User not found'}), 404

        if user.get('credits', 0) <= 0:
            log_warning(f"User {user_id} has insufficient credits")
            return jsonify({
                'error': 'Insufficient credits',
                'message': 'You need credits to ask questions. Please contact support.'
            }), 402

        # Handle source_id or video_ids
        if source_id:
            log_debug(f"Using source_id: {source_id}")
            source = get_source_by_id(source_id)

            if not source:
                log_error(f"Source {source_id} not found")
                return jsonify({'error': 'Source not found'}), 404

            if source.get('user_id') != user_id:
                log_warning(f"User {user_id} attempted to access unauthorized source {source_id}")
                return jsonify({'error': 'You do not have access to this source'}), 403

            if source.get('status') != 'ready':
                log_warning(f"Source {source_id} is not ready (status: {source.get('status')})")
                return jsonify({
                    'error': 'Source not ready',
                    'message': f"This source is {source.get('status')}. Please wait until processing is complete.",
                    'status': source.get('status')
                }), 400

            video_ids = source.get('video_ids', [])
            log_debug(f"Retrieved {len(video_ids)} video IDs from source")

            # Note: Chat will be created after successful AI response if chat_id is not provided
            if chat_id:
                log_debug(f"Using existing chat {chat_id}")

        elif video_ids:
            if not isinstance(video_ids, list) or len(video_ids) == 0:
                log_warning(f"Invalid video_ids format from user {user_id}")
                return jsonify({'error': 'video_ids must be a non-empty list'}), 400
            log_debug(f"Using provided video_ids: {len(video_ids)} videos")
        else:
            log_warning(f"Neither source_id nor video_ids provided by user {user_id}")
            return jsonify({'error': 'Either source_id or video_ids is required'}), 400

        # Initialize services
        try:
            pinecone_service = PineconeService()
            ai_service = AIService()
        except Exception as service_error:
            log_error(f"Failed to initialize services: {str(service_error)}", exc_info=True)
            return jsonify({'error': 'Service initialization failed. Please try again later.'}), 503

        # Search vector store
        log_info(f"Querying vector store with top_k={top_k}")
        try:
            context_chunks = pinecone_service.query_videos(
                query_text=question,
                video_ids=video_ids,
                source_id=source_id,
                top_k=top_k
            )
        except Exception as query_error:
            log_error(f"Vector search failed: {str(query_error)}", exc_info=True)
            return jsonify({'error': 'Failed to search video content. Please try again.'}), 500

        if not context_chunks or len(context_chunks) == 0:
            log_warning(f"No relevant content found for query from user {user_id}")
            return jsonify({
                'error': 'No relevant content found',
                'message': 'Could not find relevant information in the video transcripts for your question.',
                'response': [{
                    'text': "I couldn't find relevant information in the video transcripts to answer your question. Try rephrasing or asking something more specific.",
                    'timestamp': None,
                    'video_id': None
                }],
                'sources': []
            }), 200  # Return 200 with explanation instead of 404

        log_info(f"Found {len(context_chunks)} relevant chunks")

        # Generate answer BEFORE creating chat (if needed)
        try:
            log_debug(f"Generating answer with model: {model}")
            result = ai_service.generate_answer(question, context_chunks, model)
        except Exception as ai_error:
            log_error(f"AI generation failed: {str(ai_error)}", exc_info=True)
            return jsonify({'error': 'Failed to generate answer. Please try again.'}), 500

        # Create chat AFTER successful AI response (only if chat_id not provided)
        if not chat_id and source_id:
            try:
                # Use first few words of question as title
                title = question[:50] + ("..." if len(question) > 50 else "")
                log_info(f"Creating new chat for source {source_id} after successful AI response")
                chat = create_chat(user_id, source_id, title)
                chat_id = chat['id']
                log_debug(f"Created chat {chat_id}")
            except Exception as chat_error:
                log_error(f"Failed to create chat: {str(chat_error)}")
                # Continue without saving messages if chat creation fails

        # Save user message and assistant message to chat history
        if chat_id:
            try:
                # Save user message
                create_message(chat_id, 'user', question)
                log_debug(f"Saved user message to chat {chat_id}")

                # Store the full response array as JSON for proper frontend rendering
                response_json = json.dumps({
                    'response': result.get('response', [])
                }, ensure_ascii=False)

                # Save assistant message with full response array
                create_message(
                    chat_id,
                    'assistant',
                    response_json,
                    model_used=result.get('model_used', model),
                    primary_source=result.get('sources', [{}])[0] if result.get('sources') else None
                )
                log_debug(f"Saved assistant message to chat {chat_id}")
            except Exception as msg_error:
                log_error(f"Failed to save messages: {str(msg_error)}")
                # Continue even if message save fails

        # Deduct credits using ENV variable
        try:
            credits_cost = int(os.getenv('CREDITS_PER_QUERY', 1))
            credits_left = update_credits(user['username'], -credits_cost)
            log_info(f"Credits deducted ({credits_cost}). User {user_id} has {credits_left} credits remaining")
        except Exception as credit_error:
            log_error(f"Failed to update credits for user {user_id}: {str(credit_error)}")
            # Don't fail the request if credit update fails, but log it
            credits_left = user.get('credits', 0) - int(os.getenv('CREDITS_PER_QUERY', 1))

        # Return response in JSON format that frontend can parse
        answer_json = json.dumps({
            'response': result.get('response', [])
        }, ensure_ascii=False)

        return jsonify({
            'chat_id': chat_id,
            'answer': answer_json,  # Frontend expects 'answer' field with JSON string
            'response': result.get('response', []),  # Keep for backward compatibility
            'sources': result.get('sources', []),
            'model_used': result.get('model_used', model),
            'credits_remaining': credits_left,
            'primary_source': result.get('sources', [{}])[0] if result.get('sources') else None
        }), 200

    except ValueError as ve:
        log_error(f"Validation error in query: {str(ve)}")
        return jsonify({'error': 'Invalid request data', 'message': str(ve)}), 400
    except KeyError as ke:
        log_error(f"Missing required field: {str(ke)}")
        return jsonify({'error': 'Missing required field', 'message': str(ke)}), 400
    except Exception as e:
        log_error(f"Unexpected error in query endpoint: {str(e)}", exc_info=True)
        return jsonify({'error': 'An unexpected error occurred. Please try again later.'}), 500
