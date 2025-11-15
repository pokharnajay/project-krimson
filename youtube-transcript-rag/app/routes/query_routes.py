from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.pinecone_service import PineconeService
from app.services.ai_service import AIService
from app.services.supabase_service import update_credits, get_user_by_id, get_source_by_id

query_bp = Blueprint('query', __name__)

@query_bp.route('/ask', methods=['POST'])
@jwt_required()
def ask_question():
    """Ask question about video(s)"""
    data = request.json
    query = data.get('query')
    video_ids = data.get('video_ids')
    source_id = data.get('source_id')
    model = data.get('model')
    top_k = data.get('top_k')
    
    if not query:
        return jsonify({'error': 'Query required'}), 400
    
    user_id = get_jwt_identity()
    
    try:
        # Check if user has enough credits
        user = get_user_by_id(user_id)
        if user['credits'] <= 0:
            return jsonify({'error': 'Insufficient credits'}), 402
        
        # If source_id provided, verify ownership
        if source_id:
            source = get_source_by_id(source_id)
            if not source or source['user_id'] != user_id:
                return jsonify({'error': 'Unauthorized'}), 403
            # Use videos from this source
            video_ids = source['video_ids']
        
        pinecone_service = PineconeService()
        ai_service = AIService()
        
        # Search vector store
        context_chunks = pinecone_service.query_videos(
            query_text=query,
            video_ids=video_ids,
            source_id=source_id,
            top_k=top_k
        )
        
        if not context_chunks:
            return jsonify({'error': 'No relevant content found'}), 404
        
        # Generate answer
        result = ai_service.generate_answer(query, context_chunks, model)
        
        # Deduct credits
        credits_left = update_credits(user['username'], -1)
        
        return jsonify({
            'success': True,
            'query': query,
            'answer': result['answer'],
            'sources': result['sources'],
            'model_used': result.get('model_used'),
            'credits_left': credits_left
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
