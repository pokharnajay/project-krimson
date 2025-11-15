import re
from urllib.parse import urlparse, parse_qs

def extract_video_id(url_or_id):
    """Extract video ID from YouTube URL or return ID"""
    url_or_id = url_or_id.strip()
    
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    
    raise ValueError("Invalid YouTube URL or Video ID")

def extract_playlist_id(url):
    """Extract playlist ID from YouTube URL"""
    parsed = urlparse(url)
    if 'list' in parse_qs(parsed.query):
        return parse_qs(parsed.query)['list'][0]
    raise ValueError("Invalid playlist URL")

def format_timestamp_link(video_id, start_time):
    """Create YouTube link with timestamp"""
    return f"https://www.youtube.com/watch?v={video_id}&t={int(start_time)}s"
