from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import TranscriptsDisabled, NoTranscriptFound, VideoUnavailable
from concurrent.futures import ThreadPoolExecutor, as_completed
from config.settings import Config
from app.utils.logger import log_info, log_error, log_debug


class TranscriptService:
    @staticmethod
    def fetch_transcript(video_id):
        """Fetch transcript for a single video"""
        log_info(f"Starting transcript fetch for video: {video_id}")
        try:
            # Initialize API and get list of available transcripts
            ytt_api = YouTubeTranscriptApi()
            transcript_list = ytt_api.list(video_id)
            log_debug(f"Retrieved transcript list for {video_id}")
            
            # Try to get manually created transcript first
            transcript = None
            try:
                transcript = transcript_list.find_manually_created_transcript(['en', 'hi', 'es', 'de', 'fr', 'ja', 'ko'])
                log_info(f"Using manually created transcript for {video_id}: {transcript.language}")
            except:
                try:
                    # Fall back to auto-generated
                    transcript = transcript_list.find_generated_transcript(['en', 'hi', 'es', 'de', 'fr', 'ja', 'ko'])
                    log_info(f"Using auto-generated transcript for {video_id}: {transcript.language}")
                except:
                    # If specific languages fail, just get first available
                    for t in transcript_list:
                        transcript = t
                        log_info(f"Using first available transcript for {video_id}: {transcript.language}")
                        break
            
            if not transcript:
                raise Exception("No transcript available")
            
            # Fetch the actual transcript data
            log_debug(f"Fetching transcript data for {video_id}")
            fetched_data = transcript.fetch()
            log_info(f"Successfully fetched {len(fetched_data)} segments for {video_id}")
            
            # Convert to our format - USE DOT NOTATION FOR ATTRIBUTES
            segments = []
            for item in fetched_data:
                segments.append({
                    'text': item.text,
                    'start': item.start,
                    'duration': item.duration
                })
            
            return {
                'video_id': video_id,
                'language': transcript.language,
                'language_code': transcript.language_code,
                'segments': segments
            }
            
        except (TranscriptsDisabled, NoTranscriptFound, VideoUnavailable) as e:
            log_error(f"Transcript unavailable for {video_id}: {str(e)}")
            raise Exception(f"Transcript unavailable: {str(e)}")
        except Exception as e:
            log_error(f"Error fetching transcript for {video_id}: {str(e)}")
            raise Exception(f"Failed to fetch transcript: {str(e)}")
    
    @staticmethod
    def fetch_multiple_transcripts(video_ids):
        """Fetch transcripts for multiple videos using multithreading"""
        log_info(f"Starting batch transcript fetch for {len(video_ids)} videos")
        results = []
        errors = []
        
        with ThreadPoolExecutor(max_workers=Config.MAX_THREADS) as executor:
            future_to_video = {
                executor.submit(TranscriptService.fetch_transcript, vid): vid 
                for vid in video_ids
            }
            
            for future in as_completed(future_to_video):
                video_id = future_to_video[future]
                try:
                    result = future.result()
                    results.append(result)
                    log_info(f"✓ Successfully processed video {video_id}")
                except Exception as e:
                    errors.append({'video_id': video_id, 'error': str(e)})
                    log_error(f"✗ Failed to process video {video_id}: {str(e)}")
        
        log_info(f"Batch complete: {len(results)} success, {len(errors)} errors")
        return {'results': results, 'errors': errors}
