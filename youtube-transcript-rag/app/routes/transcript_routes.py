from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.youtube_service import YouTubeService
from app.services.transcript_service import TranscriptService
from app.services.pinecone_service import PineconeService
from app.services.supabase_service import (
    create_source, update_source_status, 
    get_sources_by_user, get_source_by_id, delete_source
)
from app.utils.helpers import extract_video_id
from app.utils.logger import log_info, log_error, log_debug, log_warning

transcript_bp = Blueprint('transcript', __name__)

@transcript_bp.route('/process', methods=['POST'])
@jwt_required()
def process_videos():
    """Process video(s) or playlist"""
    data = request.json
    url = data.get('url')
    title = data.get('title')
    
    if not url:
        log_error("No URL provided in request")
        return jsonify({'error': 'URL required'}), 400
    
    user_id = get_jwt_identity()
    log_info(f"Processing video request from user: {user_id}, URL: {url}")
    
    source_id = None
    
    try:
        youtube_service = YouTubeService()
        transcript_service = TranscriptService()
        pinecone_service = PineconeService()
        
        # Extract video IDs
        log_debug("Extracting video IDs from URL")
        if youtube_service.is_playlist(url):
            video_ids = youtube_service.get_video_ids_from_playlist(url)
            log_info(f"Found playlist with {len(video_ids)} videos")
        else:
            video_ids = [extract_video_id(url)]
            log_info(f"Processing single video: {video_ids[0]}")
        
        # Create source entry in Supabase
        log_debug("Creating source entry in Supabase")
        source = create_source(user_id, video_ids, title)
        source_id = source['id']
        log_info(f"Created source: {source_id}")
        
        # Fetch transcripts
        log_info("Starting transcript fetch")
        transcript_results = transcript_service.fetch_multiple_transcripts(video_ids)
        log_info(f"Transcript fetch complete: {len(transcript_results['results'])} success, {len(transcript_results['errors'])} errors")
        
        # Store in Pinecone
        log_info("Starting Pinecone storage")
        storage_results = []
        for transcript_data in transcript_results['results']:
            log_debug(f"Storing transcript for video: {transcript_data['video_id']}")
            result = pinecone_service.store_transcript(
                transcript_data['video_id'],
                transcript_data,
                source_id=source_id,
                user_id=user_id
            )
            storage_results.append(result)
            log_info(f"Storage result for {transcript_data['video_id']}: {result['status']}")
        
        # Update status
        if transcript_results['errors']:
            log_warning(f"Source {source_id} has errors, marking as failed")
            update_source_status(source_id, 'failed')
        else:
            log_info(f"Source {source_id} processed successfully, marking as ready")
            update_source_status(source_id, 'ready')
        
        response_data = {
            'success': True,
            'source_id': source_id,
            'processed': len(transcript_results['results']),
            'errors': transcript_results['errors'],
            'storage_results': storage_results
        }
        log_info(f"Processing complete: {response_data}")
        
        return jsonify(response_data), 200
        
    except Exception as e:
        log_error(f"Error processing videos: {str(e)}")
        if source_id:
            update_source_status(source_id, 'failed')
        return jsonify({'error': str(e)}), 500

@transcript_bp.route('/sources', methods=['GET'])
@jwt_required()
def get_all_sources():
    """Get all sources for current user"""
    user_id = get_jwt_identity()
    
    try:
        sources = get_sources_by_user(user_id)
        
        # Format for frontend
        formatted_sources = []
        for source in sources:
            formatted_sources.append({
                'id': source['id'],
                'title': source['title'],
                'video_ids': source['video_ids'],
                'status': source['status'],
                'created_at': source['created_at']
            })
        
        return jsonify({'sources': formatted_sources}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transcript_bp.route('/sources/<source_id>', methods=['GET'])
@jwt_required()
def get_source(source_id):
    """Get a specific source - THIS IS THE MISSING ROUTE!"""
    user_id = get_jwt_identity()
    
    try:
        log_info(f"Fetching source {source_id} for user {user_id}")
        source = get_source_by_id(source_id)
        
        if not source:
            log_error(f"Source {source_id} not found")
            return jsonify({'error': 'Source not found'}), 404
        
        # Check ownership
        if source['user_id'] != user_id:
            log_error(f"User {user_id} unauthorized to access source {source_id}")
            return jsonify({'error': 'Unauthorized'}), 403
        
        log_info(f"Successfully fetched source {source_id}")
        return jsonify(source), 200
        
    except Exception as e:
        log_error(f"Error fetching source {source_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@transcript_bp.route('/sources/<source_id>', methods=['DELETE'])
@jwt_required()
def delete_source_route(source_id):
    """Delete a source"""
    user_id = get_jwt_identity()
    
    try:
        source = get_source_by_id(source_id)
        
        if not source:
            return jsonify({'error': 'Source not found'}), 404
        
        # Check ownership
        if source['user_id'] != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        delete_source(source_id)
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@transcript_bp.route('/sources/<source_id>/retry', methods=['POST'])
@jwt_required()
def retry_source(source_id):
    """Retry processing a failed source"""
    user_id = get_jwt_identity()
    
    try:
        source = get_source_by_id(source_id)
        
        if not source:
            return jsonify({'error': 'Source not found'}), 404
        
        if source['user_id'] != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        if source['status'] != 'failed':
            return jsonify({'error': 'Only failed sources can be retried'}), 400
        
        # Update status to processing
        update_source_status(source_id, 'processing')
        
        # Re-process videos
        video_ids = source['video_ids']
        
        transcript_service = TranscriptService()
        pinecone_service = PineconeService()
        
        transcript_results = transcript_service.fetch_multiple_transcripts(video_ids)
        
        storage_results = []
        for transcript_data in transcript_results['results']:
            result = pinecone_service.store_transcript(
                transcript_data['video_id'],
                transcript_data,
                source_id=source_id,
                user_id=user_id
            )
            storage_results.append(result)
        
        # Update status
        if transcript_results['errors']:
            update_source_status(source_id, 'failed')
        else:
            update_source_status(source_id, 'ready')
        
        return jsonify({
            'success': True,
            'processed': len(transcript_results['results']),
            'errors': transcript_results['errors']
        }), 200
        
    except Exception as e:
        log_error(f"Error retrying source: {str(e)}")
        update_source_status(source_id, 'failed')
        return jsonify({'error': str(e)}), 500
