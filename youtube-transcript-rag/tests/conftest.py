"""
Pytest configuration and fixtures for testing
"""

import pytest
import os
from app import create_app


@pytest.fixture
def app():
    """Create and configure a test Flask application instance"""
    # Set testing configuration
    os.environ['FLASK_TESTING'] = 'True'
    os.environ['SKIP_CONFIG_VALIDATION'] = '1'

    app = create_app()
    app.config['TESTING'] = True

    yield app


@pytest.fixture
def client(app):
    """Create a test client for the Flask application"""
    return app.test_client()


@pytest.fixture
def runner(app):
    """Create a test CLI runner for the Flask application"""
    return app.test_cli_runner()


@pytest.fixture
def auth_headers():
    """Mock authentication headers"""
    return {
        'Authorization': 'Bearer mock_token'
    }


@pytest.fixture
def mock_user():
    """Mock user data"""
    return {
        'id': 'test-user-id-123',
        'username': 'testuser',
        'password_hash': 'hashed_password',
        'credits': 1000,
        'created_at': '2025-01-01T00:00:00Z'
    }


@pytest.fixture
def mock_source():
    """Mock source data"""
    return {
        'id': 'test-source-id-123',
        'user_id': 'test-user-id-123',
        'video_ids': ['dQw4w9WgXcQ'],
        'title': 'Test Video',
        'status': 'ready',
        'created_at': '2025-01-01T00:00:00Z',
        'metadata': {'video_count': 1}
    }
