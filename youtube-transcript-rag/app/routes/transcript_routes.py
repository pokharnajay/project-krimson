from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.services.youtube_service import YouTubeService
from app.services.transcript_service import TranscriptService
from app.services.pinecone_service import PineconeService
from app.services.supabase_service import (
    create_source, update_source_status,
    get_sources_by_user, get_sources_count_by_user,
    get_source_by_id, delete_source
)
from app.utils.helpers import extract_video_id
from app.utils.logger import log_info, log_error, log_debug, log_warning

transcript_bp = Blueprint('transcript', __name__)

@transcript_bp.route('/process', methods=['POST'])
@jwt_required()
def process_videos():
    """Process video(s) or playlist"""
    user_id = get_jwt_identity()
    source_id = None

    try:
        # Validate request data
        if not request.json:
            log_warning(f"Empty request body from user {user_id}")
            return jsonify({'error': 'Request body required'}), 400

        data = request.json
        url = data.get('url')
        title = data.get('title')

        # Validate URL
        if not url or not url.strip():
            log_error(f"No URL provided by user {user_id}")
            return jsonify({'error': 'YouTube URL is required'}), 400

        url = url.strip()

        # Basic URL validation
        if not ('youtube.com' in url or 'youtu.be' in url):
            log_warning(f"Invalid YouTube URL from user {user_id}: {url}")
            return jsonify({
                'error': 'Invalid URL',
                'message': 'Please provide a valid YouTube video or playlist URL'
            }), 400

        log_info(f"Processing video request from user {user_id}, URL: {url}")

        # Initialize services
        try:
            youtube_service = YouTubeService()
            transcript_service = TranscriptService()
            pinecone_service = PineconeService()
        except Exception as service_error:
            log_error(f"Failed to initialize services: {str(service_error)}", exc_info=True)
            return jsonify({'error': 'Service initialization failed. Please try again later.'}), 503

        # Extract video IDs
        log_debug("Extracting video IDs from URL")
        video_ids = []

        try:
            if youtube_service.is_playlist(url):
                video_ids = youtube_service.get_video_ids_from_playlist(url)
                if not video_ids or len(video_ids) == 0:
                    log_error(f"Playlist URL returned no videos: {url}")
                    return jsonify({
                        'error': 'Empty playlist',
                        'message': 'The playlist appears to be empty or inaccessible'
                    }), 400
                log_info(f"Found playlist with {len(video_ids)} videos")
            else:
                video_id = extract_video_id(url)
                if not video_id:
                    log_error(f"Failed to extract video ID from URL: {url}")
                    return jsonify({
                        'error': 'Invalid video URL',
                        'message': 'Could not extract video ID from the provided URL'
                    }), 400
                video_ids = [video_id]
                log_info(f"Processing single video: {video_ids[0]}")
        except Exception as extract_error:
            log_error(f"Error extracting video IDs: {str(extract_error)}", exc_info=True)
            return jsonify({
                'error': 'Failed to process URL',
                'message': 'Could not extract video information. Please check the URL and try again.'
            }), 400

        # Limit playlist size
        MAX_VIDEOS = 50
        if len(video_ids) > MAX_VIDEOS:
            log_warning(f"Playlist too large ({len(video_ids)} videos), limiting to {MAX_VIDEOS}")
            video_ids = video_ids[:MAX_VIDEOS]
            title = (title or '') + f' (First {MAX_VIDEOS} videos)'

        # Auto-fetch title if not provided
        if not title or not title.strip():
            log_debug("No custom title provided, fetching from YouTube")
            try:
                metadata = youtube_service.get_video_metadata(video_ids[0])
                title = metadata.get('title', f'Video {video_ids[0][:8]}')
                if len(video_ids) > 1:
                    title = f"{title} (+{len(video_ids)-1} more)"
                log_info(f"Auto-fetched title: {title}")
            except Exception as e:
                log_warning(f"Failed to auto-fetch title: {str(e)}")
                title = f'YouTube Source ({len(video_ids)} video{"s" if len(video_ids) > 1 else ""})'
        else:
            title = title.strip()

        # Validate title length
        if len(title) > 200:
            title = title[:197] + '...'

        # Create source entry in Supabase
        log_debug("Creating source entry in Supabase")
        try:
            source = create_source(user_id, video_ids, title)
            source_id = source['id']
            log_info(f"Created source: {source_id}")
        except Exception as db_error:
            log_error(f"Failed to create source in database: {str(db_error)}", exc_info=True)
            return jsonify({
                'error': 'Database error',
                'message': 'Failed to create source record. Please try again.'
            }), 500
        
        # Fetch transcripts
        log_info("Starting transcript fetch")
        transcript_results = {'results': [], 'errors': []}

        try:
            transcript_results = transcript_service.fetch_multiple_transcripts(video_ids)
            log_info(f"Transcript fetch complete: {len(transcript_results['results'])} success, {len(transcript_results['errors'])} errors")
        except Exception as transcript_error:
            log_error(f"Transcript fetch failed: {str(transcript_error)}", exc_info=True)
            if source_id:
                update_source_status(source_id, 'failed')
            return jsonify({
                'error': 'Transcript fetch failed',
                'message': 'Failed to fetch video transcripts. Videos may not have captions available.',
                'source_id': source_id
            }), 500

        # Check if any transcripts were successfully fetched
        if len(transcript_results['results']) == 0:
            log_error(f"No transcripts fetched for any videos in source {source_id}")
            if source_id:
                update_source_status(source_id, 'failed')
            return jsonify({
                'error': 'No transcripts available',
                'message': 'Could not fetch transcripts for any of the videos. They may not have captions available.',
                'source_id': source_id,
                'errors': transcript_results['errors']
            }), 400

        # Store in Pinecone
        log_info("Starting Pinecone storage")
        storage_results = []
        storage_errors = []

        for transcript_data in transcript_results['results']:
            try:
                log_debug(f"Storing transcript for video: {transcript_data['video_id']}")
                result = pinecone_service.store_transcript(
                    transcript_data['video_id'],
                    transcript_data,
                    source_id=source_id,
                    user_id=user_id
                )
                storage_results.append(result)
                log_info(f"Storage result for {transcript_data['video_id']}: {result.get('status', 'unknown')}")
            except Exception as storage_error:
                log_error(f"Failed to store transcript for {transcript_data['video_id']}: {str(storage_error)}")
                storage_errors.append({
                    'video_id': transcript_data['video_id'],
                    'error': str(storage_error)
                })

        # Update status based on results
        try:
            if len(storage_results) == 0:
                # No transcripts were successfully stored
                log_error(f"No transcripts were stored for source {source_id}")
                update_source_status(source_id, 'failed')
                return jsonify({
                    'error': 'Storage failed',
                    'message': 'Failed to store any transcripts in the vector database',
                    'source_id': source_id
                }), 500
            elif storage_errors or transcript_results['errors']:
                # Some errors but some success - mark as ready with warnings
                log_warning(f"Source {source_id} has partial errors but marking as ready")
                update_source_status(source_id, 'ready')
            else:
                # Complete success
                log_info(f"Source {source_id} processed successfully, marking as ready")
                update_source_status(source_id, 'ready')
        except Exception as status_error:
            log_error(f"Failed to update source status: {str(status_error)}")
            # Don't fail the request if status update fails

        response_data = {
            'success': True,
            'source_id': source_id,
            'title': title,
            'processed': len(storage_results),
            'total_videos': len(video_ids),
            'transcript_errors': transcript_results['errors'],
            'storage_errors': storage_errors
        }
        log_info(f"Processing complete: {response_data}")

        return jsonify(response_data), 200

    except ValueError as ve:
        log_error(f"Validation error: {str(ve)}")
        if source_id:
            update_source_status(source_id, 'failed')
        return jsonify({'error': 'Invalid request data', 'message': str(ve)}), 400
    except Exception as e:
        log_error(f"Unexpected error processing videos: {str(e)}", exc_info=True)
        if source_id:
            try:
                update_source_status(source_id, 'failed')
            except:
                pass
        return jsonify({
            'error': 'Processing failed',
            'message': 'An unexpected error occurred. Please try again later.'
        }), 500

@transcript_bp.route('/sources', methods=['GET'])
@jwt_required()
def get_all_sources():
    """Get all sources for current user with pagination"""
    user_id = get_jwt_identity()

    try:
        # Get pagination parameters
        page = request.args.get('page', 1, type=int)
        limit = request.args.get('limit', 20, type=int)

        # Validate pagination parameters
        if page < 1:
            page = 1
        if limit < 1:
            limit = 1
        elif limit > 100:
            limit = 100

        # Calculate offset
        offset = (page - 1) * limit

        # Get paginated sources
        sources = get_sources_by_user(user_id, limit=limit, offset=offset)
        total_count = get_sources_count_by_user(user_id)

        # Calculate total pages
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0

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

        return jsonify({
            'sources': formatted_sources,
            'pagination': {
                'page': page,
                'limit': limit,
                'total': total_count,
                'pages': total_pages
            }
        }), 200

    except Exception as e:
        log_error(f"Error fetching sources: {str(e)}")
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
