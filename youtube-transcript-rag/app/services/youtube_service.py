from pytube import YouTube, Playlist
from app.utils.helpers import extract_video_id, extract_playlist_id
import requests
from app.utils.logger import log_info, log_error

class YouTubeService:
    @staticmethod
    def get_video_ids_from_playlist(playlist_url):
        """Extract all video IDs from a playlist"""
        try:
            playlist = Playlist(playlist_url)
            video_ids = [extract_video_id(url) for url in playlist.video_urls]
            return video_ids
        except Exception as e:
            raise Exception(f"Failed to fetch playlist: {str(e)}")
    
    @staticmethod
    def is_playlist(url):
        """Check if URL is a playlist"""
        try:
            extract_playlist_id(url)
            return True
        except:
            return False

    @staticmethod
    def get_video_metadata(video_id):
        """Fetch video metadata from YouTube oEmbed API (no API key needed)"""
        try:
            url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            response = requests.get(url)
            data = response.json()
            
            return {
                'title': data.get('title', 'Unknown'),
                'author': data.get('author_name', 'Unknown'),
                'thumbnail': data.get('thumbnail_url', ''),
            }
        except Exception as e:
            log_error(f"Failed to fetch metadata for {video_id}: {str(e)}")
            return {
                'title': f'Video {video_id[:8]}',
                'author': 'Unknown',
                'thumbnail': f'https://img.youtube.com/vi/{video_id}/maxresdefault.jpg'
            }