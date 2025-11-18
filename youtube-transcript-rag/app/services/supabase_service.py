import uuid
from supabase import create_client, Client
import bcrypt
from config.settings import Config
from app.utils.logger import log_error, log_debug

# Lazy initialization of Supabase client
_supabase_client = None


def get_supabase_client() -> Client:
    """
    Get or create Supabase client instance (singleton pattern).

    Returns:
        Supabase client instance

    Raises:
        ValueError: If Supabase configuration is missing
    """
    global _supabase_client

    if _supabase_client is None:
        if not Config.SUPABASE_URL or not Config.SUPABASE_SERVICE_KEY:
            raise ValueError(
                "Supabase configuration missing. "
                "Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables."
            )

        log_debug("Initializing Supabase client")
        _supabase_client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_KEY)

    return _supabase_client

# User operations
def get_user(username):
    """Get user by username"""
    supabase = get_supabase_client()
    res = supabase.table('users').select('*').eq('username', username).execute()
    if res.data:
        return res.data[0]
    return None


def get_user_by_id(user_id):
    """Get user by ID"""
    supabase = get_supabase_client()
    res = supabase.table('users').select('*').eq('id', user_id).execute()
    if res.data:
        return res.data[0]
    return None


def check_password(password, password_hash):
    """Check if password matches hash"""
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def update_credits(username, delta):
    """Update user credits (atomic operation)"""
    supabase = get_supabase_client()
    user = get_user(username)
    if not user:
        return None
    new_credits = max(user['credits'] + delta, 0)
    supabase.table('users').update({'credits': new_credits}).eq('username', username).execute()
    return new_credits


def create_user(username, password, initial_credits=1000):
    """Create a new user"""
    supabase = get_supabase_client()
    password_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    result = supabase.table('users').insert({
        'username': username,
        'password_hash': password_hash,
        'credits': initial_credits
    }).execute()
    return result.data[0] if result.data else None

# Source operations
def create_source(user_id, video_ids, title=None, pinecone_namespace=None, metadata=None):
    """Create a new source entry"""
    supabase = get_supabase_client()
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
    supabase = get_supabase_client()
    supabase.table('sources').update({
        'status': status
    }).eq('id', source_id).execute()


def get_sources_by_user(user_id, limit=None, offset=None):
    """
    Get all sources for a user with optional pagination

    Args:
        user_id: User ID
        limit: Maximum number of results (optional)
        offset: Number of results to skip (optional)

    Returns:
        List of sources
    """
    supabase = get_supabase_client()
    query = supabase.table('sources').select('*').eq('user_id', user_id).order('created_at', desc=True)

    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)

    result = query.execute()
    return result.data if result.data else []


def get_sources_count_by_user(user_id):
    """Get total count of sources for a user"""
    supabase = get_supabase_client()
    result = supabase.table('sources').select('id', count='exact').eq('user_id', user_id).execute()
    return result.count if result.count is not None else 0


def get_source_by_id(source_id):
    """Get a specific source"""
    supabase = get_supabase_client()
    result = supabase.table('sources').select('*').eq('id', source_id).execute()
    return result.data[0] if result.data else None


def delete_source(source_id):
    """Delete a source"""
    supabase = get_supabase_client()
    supabase.table('sources').delete().eq('id', source_id).execute()


def get_source_by_video_ids(video_ids):
    """
    Find an existing source with the exact same video_ids (for duplicate detection).

    Args:
        video_ids: List of YouTube video IDs

    Returns:
        Source record if found, None otherwise
    """
    supabase = get_supabase_client()

    # Query for sources with matching video_ids array
    # Note: PostgreSQL array comparison requires exact match (order matters)
    # We only want to match sources that are 'ready' status
    result = supabase.table('sources').select('*').eq('video_ids', video_ids).eq('status', 'ready').execute()

    if result.data and len(result.data) > 0:
        # Return the first (oldest) matching source
        return result.data[0]

    return None


def create_user_source_association(user_id, source_id):
    """
    Create an association between a user and a source (for shared sources).

    Args:
        user_id: User ID
        source_id: Source ID

    Returns:
        User-source association record
    """
    supabase = get_supabase_client()

    try:
        result = supabase.table('user_sources').insert({
            'user_id': user_id,
            'source_id': source_id
        }).execute()

        return result.data[0] if result.data else None
    except Exception as e:
        # Handle unique constraint violation (user already has this source)
        if 'duplicate key' in str(e).lower() or 'unique constraint' in str(e).lower():
            log_debug(f"User {user_id} already has access to source {source_id}")
            return {'user_id': user_id, 'source_id': source_id, 'already_exists': True}
        raise


def get_user_source_association(user_id, source_id):
    """
    Check if a user-source association exists.

    Args:
        user_id: User ID
        source_id: Source ID

    Returns:
        Association record if exists, None otherwise
    """
    supabase = get_supabase_client()
    result = supabase.table('user_sources').select('*').eq('user_id', user_id).eq('source_id', source_id).execute()
    return result.data[0] if result.data else None


def get_sources_by_user_with_associations(user_id, limit=None, offset=None):
    """
    Get all sources for a user, including shared sources from user_sources table.
    This replaces get_sources_by_user() for the new multi-user sharing model.

    Args:
        user_id: User ID
        limit: Maximum number of results (optional)
        offset: Number of results to skip (optional)

    Returns:
        List of sources
    """
    supabase = get_supabase_client()

    # Query user_sources table with join to get source details
    query = supabase.table('user_sources').select('source_id, sources(*)').eq('user_id', user_id).order('created_at', desc=True)

    if limit:
        query = query.limit(limit)
    if offset:
        query = query.offset(offset)

    result = query.execute()

    # Extract source objects from the joined data
    sources = []
    if result.data:
        for item in result.data:
            if item.get('sources'):
                sources.append(item['sources'])

    # Fall back to old sources table for backward compatibility
    # (sources created before migration that might not be in user_sources yet)
    if not sources or len(sources) == 0:
        sources = get_sources_by_user(user_id, limit, offset)

    return sources


def get_sources_count_by_user_with_associations(user_id):
    """
    Get total count of sources for a user, including shared sources.

    Args:
        user_id: User ID

    Returns:
        Total count of sources
    """
    supabase = get_supabase_client()
    result = supabase.table('user_sources').select('id', count='exact').eq('user_id', user_id).execute()

    count = result.count if result.count is not None else 0

    # Fall back to old sources table if no associations found
    if count == 0:
        count = get_sources_count_by_user(user_id)

    return count


# Chat operations
def create_chat(user_id, source_id, title, chat_id=None):
    """
    Create a new chat session

    Args:
        user_id: User ID
        source_id: Source ID
        title: Chat title
        chat_id: Optional pre-generated chat ID (if not provided, will generate new UUID)

    Returns:
        Chat record
    """
    supabase = get_supabase_client()

    # Use provided chat_id or generate new one
    if not chat_id:
        chat_id = str(uuid.uuid4())

    result = supabase.table('chats').insert({
        'id': chat_id,
        'user_id': user_id,
        'source_id': source_id,
        'title': title
    }).execute()

    return result.data[0] if result.data else None


def get_chat_by_id(chat_id):
    """Get specific chat details"""
    supabase = get_supabase_client()
    result = supabase.table('chats').select('*, sources(*)').eq('id', chat_id).execute()
    return result.data[0] if result.data else None


def get_chats_by_user(user_id, limit=50, offset=0, search=None):
    """
    Get all chats for a user with optional search
    - Orders by updated_at DESC (most recent first)
    - Supports text search on title
    - Returns pagination info
    """
    supabase = get_supabase_client()
    query = supabase.table('chats').select('*, sources(title)', count='exact').eq('user_id', user_id)

    if search:
        query = query.ilike('title', f'%{search}%')

    query = query.order('updated_at', desc=True).limit(limit).offset(offset)
    result = query.execute()

    return {
        'chats': result.data if result.data else [],
        'total': result.count if result.count is not None else 0
    }


def update_chat_title(chat_id, title):
    """Update chat title"""
    supabase = get_supabase_client()
    supabase.table('chats').update({'title': title}).eq('id', chat_id).execute()


def delete_chat(chat_id):
    """Delete chat and all messages (cascade)"""
    supabase = get_supabase_client()
    supabase.table('chats').delete().eq('id', chat_id).execute()


# Message operations
def create_message(chat_id, role, content, model_used=None, primary_source=None, metadata=None):
    """Create a new message in a chat"""
    supabase = get_supabase_client()
    message_id = str(uuid.uuid4())

    result = supabase.table('messages').insert({
        'id': message_id,
        'chat_id': chat_id,
        'role': role,
        'content': content,
        'model_used': model_used,
        'primary_source': primary_source,
        'metadata': metadata
    }).execute()

    return result.data[0] if result.data else None


def get_messages_by_chat(chat_id, limit=100, offset=0):
    """Get all messages for a chat, ordered by created_at"""
    supabase = get_supabase_client()
    result = supabase.table('messages').select('*').eq('chat_id', chat_id).order('created_at').limit(limit).offset(offset).execute()
    return result.data if result.data else []


def get_chat_with_messages(chat_id):
    """Get chat details and all messages in one call"""
    chat = get_chat_by_id(chat_id)
    if not chat:
        return None

    messages = get_messages_by_chat(chat_id)
    chat['messages'] = messages

    return chat
