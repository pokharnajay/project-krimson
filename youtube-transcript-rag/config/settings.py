import os
import sys
from datetime import timedelta
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from .env file
load_dotenv()


class ConfigurationError(Exception):
    """Raised when required configuration is missing or invalid"""
    pass


class Config:
    """
    Application configuration loaded from environment variables.

    Required environment variables:
    - SECRET_KEY: Flask secret key
    - JWT_SECRET_KEY: JWT signing key
    - SUPABASE_URL: Supabase project URL
    - SUPABASE_SERVICE_KEY: Supabase service role key
    - OPENROUTER_API_KEY: OpenRouter API key
    - PINECONE_API_KEY: Pinecone API key

    Optional environment variables have defaults.
    """

    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY')
    DEBUG = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    TESTING = os.getenv('FLASK_TESTING', 'False').lower() == 'true'

    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv('JWT_ACCESS_TOKEN_EXPIRES', 3600))
    )
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(
        seconds=int(os.getenv('JWT_REFRESH_TOKEN_EXPIRES', 2592000))
    )
    JWT_TOKEN_LOCATION = ['headers']
    JWT_HEADER_NAME = 'Authorization'
    JWT_HEADER_TYPE = 'Bearer'

    # Supabase Configuration
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

    # Admin Configuration
    ADMIN_API_KEY = os.getenv('ADMIN_API_KEY')

    # OpenRouter/LLM Configuration
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openai/gpt-4-turbo')
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

    # Pinecone Configuration
    PINECONE_API_KEY = os.getenv('PINECONE_API_KEY')
    PINECONE_ENVIRONMENT = os.getenv('PINECONE_ENVIRONMENT', 'us-east-1')
    PINECONE_INDEX_NAME = os.getenv('PINECONE_INDEX_NAME', 'youtube-transcripts')

    # Processing Configuration
    MAX_THREADS = int(os.getenv('MAX_THREADS', 5))
    VECTOR_SEARCH_TYPE = os.getenv('VECTOR_SEARCH_TYPE', 'similarity')
    TOP_K_RESULTS = int(os.getenv('TOP_K_RESULTS', 5))
    EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
    EMBEDDING_DIMENSIONS = 384
    CHUNK_SIZE = 1000

    # Rate Limiting Configuration
    RATELIMIT_ENABLED = os.getenv('RATELIMIT_ENABLED', 'True').lower() == 'true'
    RATELIMIT_STORAGE_URL = os.getenv('RATELIMIT_STORAGE_URL', 'memory://')
    RATELIMIT_DEFAULT = os.getenv('RATELIMIT_DEFAULT', '100/hour')

    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')

    # Logging Configuration
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'logs/logging.txt')

    @classmethod
    def validate(cls) -> None:
        """
        Validate that all required configuration values are present.

        Raises:
            ConfigurationError: If any required configuration is missing
        """
        required_vars = {
            'SECRET_KEY': cls.SECRET_KEY,
            'JWT_SECRET_KEY': cls.JWT_SECRET_KEY,
            'SUPABASE_URL': cls.SUPABASE_URL,
            'SUPABASE_SERVICE_KEY': cls.SUPABASE_SERVICE_KEY,
            'OPENROUTER_API_KEY': cls.OPENROUTER_API_KEY,
            'PINECONE_API_KEY': cls.PINECONE_API_KEY,
        }

        missing_vars = [key for key, value in required_vars.items() if not value]

        if missing_vars:
            error_msg = (
                f"Missing required environment variables: {', '.join(missing_vars)}\n"
                f"Please set these variables in your .env file or environment."
            )
            raise ConfigurationError(error_msg)

        # Validate SECRET_KEY strength
        if cls.SECRET_KEY and len(cls.SECRET_KEY) < 32:
            print(
                "WARNING: SECRET_KEY should be at least 32 characters long for production use.",
                file=sys.stderr
            )

        # Validate JWT_SECRET_KEY strength
        if cls.JWT_SECRET_KEY and len(cls.JWT_SECRET_KEY) < 32:
            print(
                "WARNING: JWT_SECRET_KEY should be at least 32 characters long for production use.",
                file=sys.stderr
            )

        # Validate URLs
        if cls.SUPABASE_URL and not cls.SUPABASE_URL.startswith('https://'):
            print(
                "WARNING: SUPABASE_URL should use HTTPS for production.",
                file=sys.stderr
            )

    @classmethod
    def display_config(cls, hide_secrets: bool = True) -> dict:
        """
        Display current configuration (with secrets masked).

        Args:
            hide_secrets: If True, mask sensitive values

        Returns:
            Dictionary of configuration values
        """
        config_dict = {}
        secret_keys = [
            'SECRET_KEY', 'JWT_SECRET_KEY', 'SUPABASE_SERVICE_KEY',
            'ADMIN_API_KEY', 'OPENROUTER_API_KEY', 'PINECONE_API_KEY'
        ]

        for key, value in vars(cls).items():
            if key.startswith('_') or callable(value):
                continue

            if hide_secrets and key in secret_keys:
                if value:
                    config_dict[key] = f"{value[:4]}...{value[-4:]}" if len(value) > 8 else "****"
                else:
                    config_dict[key] = None
            else:
                config_dict[key] = value

        return config_dict


# Validate configuration on import (except during testing)
if not Config.TESTING:
    try:
        Config.validate()
    except ConfigurationError as e:
        print(f"Configuration Error: {e}", file=sys.stderr)
        if not os.getenv('SKIP_CONFIG_VALIDATION'):
            sys.exit(1)
