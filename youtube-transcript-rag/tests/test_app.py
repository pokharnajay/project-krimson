"""
Test Flask application initialization and basic endpoints
"""

import pytest
from flask import json


def test_app_exists(app):
    """Test that the app is created successfully"""
    assert app is not None
    assert app.config['TESTING'] is True


def test_health_check(client):
    """Test the health check endpoint"""
    response = client.get('/health')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert data['status'] == 'healthy'
    assert 'service' in data
    assert 'version' in data


def test_root_endpoint(client):
    """Test the root endpoint"""
    response = client.get('/')
    assert response.status_code == 200

    data = json.loads(response.data)
    assert data['status'] == 'running'
    assert 'service' in data
    assert 'version' in data
    assert 'endpoints' in data


def test_404_error_handler(client):
    """Test 404 error handling"""
    response = client.get('/nonexistent-endpoint')
    assert response.status_code == 404

    data = json.loads(response.data)
    assert data['error'] == 'NotFound'
    assert 'message' in data


def test_cors_headers(client):
    """Test CORS headers are set"""
    response = client.get('/health')
    assert 'Access-Control-Allow-Origin' in response.headers
