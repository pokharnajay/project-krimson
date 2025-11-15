import os
import uuid
from supabase import create_client
import bcrypt

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# User operations
def get_user(username):
    res = supabase.table('users').select('*').eq('username', username).execute()
    if res.data:
        return res.data[0]
    return None

def get_user_by_id(user_id):
    res = supabase.table('users').select('*').eq('id', user_id).execute()
    if res.data:
        return res.data[0]
    return None

def check_password(password, password_hash):
    return bcrypt.checkpw(password.encode(), password_hash.encode())

def update_credits(username, delta):
    user = get_user(username)
    if not user:
        return None
    new_credits = max(user['credits'] + delta, 0)
    supabase.table('users').update({'credits': new_credits}).eq('username', username).execute()
    return new_credits

def create_user(username, password):
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    result = supabase.table('users').insert({
        'username': username,
        'password_hash': password_hash,
        'credits': 1000
    }).execute()
    return result.data[0] if result.data else None

# Source operations
def create_source(user_id, video_ids, title=None, pinecone_namespace=None, metadata=None):
    """Create a new source entry"""
    source_id = str(uuid.uuid4())
    
    # Auto-generate title if not provided
    if not title and metadata:
        if len(video_ids) == 1:
            title = metadata[0].get('title', f"Video {video_ids[0][:8]}")
        else:
            title = f"Playlist ({len(video_ids)} videos)"
    elif not title:
        title = f"Source {len(video_ids)} videos"
    
    result = supabase.table('sources').insert({
        'id': source_id,
        'user_id': user_id,
        'video_ids': video_ids,
        'title': title,
        'pinecone_namespace': pinecone_namespace,
        'metadata': metadata,  # Store metadata as JSONB
        'status': 'processing'
    }).execute()
    
    return result.data[0] if result.data else None


def update_source_status(source_id, status):
    """Update source status"""
    supabase.table('sources').update({
        'status': status
    }).eq('id', source_id).execute()

def get_sources_by_user(user_id):
    """Get all sources for a user"""
    result = supabase.table('sources').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
    return result.data if result.data else []

def get_source_by_id(source_id):
    """Get a specific source"""
    result = supabase.table('sources').select('*').eq('id', source_id).execute()
    return result.data[0] if result.data else None

def delete_source(source_id):
    """Delete a source"""
    supabase.table('sources').delete().eq('id', source_id).execute()
