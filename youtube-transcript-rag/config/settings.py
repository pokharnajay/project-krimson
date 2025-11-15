import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Flask
    SECRET_KEY = os.getenv('SECRET_KEY')
    
    # JWT
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600)))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(seconds=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000)))
    
    # Admin
    ADMIN_API_KEY = os.getenv('ADMIN_API_KEY')
    
    # OpenRouter
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openai/gpt-4-turbo')
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    
    # Pinecone
    PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
    PINECONE_ENVIRONMENT = os.getenv('PINECONE_ENVIRONMENT', 'us-east-1')
    PINECONE_INDEX_NAME = os.getenv('PINECONE_INDEX_NAME', 'youtube-transcripts')
    
    # Processing
    MAX_THREADS = int(os.getenv('MAX_THREADS', 5))
    VECTOR_SEARCH_TYPE = os.getenv('VECTOR_SEARCH_TYPE', 'similarity')
    TOP_K_RESULTS = int(os.getenv('TOP_K_RESULTS', 5))
    EMBEDDING_MODEL = "text-embedding-3-small"
    CHUNK_SIZE = 1000
