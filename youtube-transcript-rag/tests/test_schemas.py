"""
Test Pydantic schema validation
"""

import pytest
from pydantic import ValidationError
from app.models.schemas import (
    LoginRequest,
    CreateUserRequest,
    ProcessTranscriptRequest,
    QueryRequest,
    PaginationParams,
)


class TestLoginRequest:
    """Test LoginRequest schema validation"""

    def test_valid_login_request(self):
        """Test valid login request"""
        data = {
            'username': 'testuser',
            'password': 'password123'
        }
        request = LoginRequest(**data)
        assert request.username == 'testuser'
        assert request.password == 'password123'

    def test_username_too_short(self):
        """Test username minimum length validation"""
        with pytest.raises(ValidationError):
            LoginRequest(username='ab', password='password123')

    def test_password_too_short(self):
        """Test password minimum length validation"""
        with pytest.raises(ValidationError):
            LoginRequest(username='testuser', password='12345')

    def test_username_lowercase(self):
        """Test username is converted to lowercase"""
        request = LoginRequest(username='TestUser', password='password123')
        assert request.username == 'testuser'


class TestCreateUserRequest:
    """Test CreateUserRequest schema validation"""

    def test_valid_create_user(self):
        """Test valid user creation request"""
        data = {
            'username': 'newuser',
            'password': 'SecurePass123'
        }
        request = CreateUserRequest(**data)
        assert request.username == 'newuser'
        assert request.initial_credits == 1000

    def test_password_strength_no_digit(self):
        """Test password must contain digit"""
        with pytest.raises(ValidationError) as exc_info:
            CreateUserRequest(username='testuser', password='NoDigitsHere')
        assert 'at least one digit' in str(exc_info.value)

    def test_password_strength_no_letter(self):
        """Test password must contain letter"""
        with pytest.raises(ValidationError) as exc_info:
            CreateUserRequest(username='testuser', password='12345678')
        assert 'at least one letter' in str(exc_info.value)

    def test_password_minimum_length(self):
        """Test password minimum 8 characters"""
        with pytest.raises(ValidationError) as exc_info:
            CreateUserRequest(username='testuser', password='Pass1')
        assert 'at least 8 characters' in str(exc_info.value)


class TestProcessTranscriptRequest:
    """Test ProcessTranscriptRequest schema validation"""

    def test_valid_youtube_url(self):
        """Test valid YouTube URL"""
        request = ProcessTranscriptRequest(url='https://www.youtube.com/watch?v=dQw4w9WgXcQ')
        assert 'youtube.com' in request.url

    def test_valid_youtu_be_url(self):
        """Test valid youtu.be short URL"""
        request = ProcessTranscriptRequest(url='https://youtu.be/dQw4w9WgXcQ')
        assert 'youtu.be' in request.url

    def test_invalid_url(self):
        """Test non-YouTube URL is rejected"""
        with pytest.raises(ValidationError) as exc_info:
            ProcessTranscriptRequest(url='https://vimeo.com/123456')
        assert 'valid YouTube URL' in str(exc_info.value)


class TestQueryRequest:
    """Test QueryRequest schema validation"""

    def test_valid_query(self):
        """Test valid query request"""
        request = QueryRequest(
            source_id='550e8400-e29b-41d4-a716-446655440000',
            question='What is this video about?'
        )
        assert request.question == 'What is this video about?'

    def test_question_too_short(self):
        """Test question minimum length"""
        with pytest.raises(ValidationError):
            QueryRequest(
                source_id='550e8400-e29b-41d4-a716-446655440000',
                question='Hi'
            )

    def test_invalid_uuid(self):
        """Test invalid source_id format"""
        with pytest.raises(ValidationError) as exc_info:
            QueryRequest(source_id='not-a-uuid', question='What is this?')
        assert 'Invalid source_id format' in str(exc_info.value)


class TestPaginationParams:
    """Test PaginationParams schema validation"""

    def test_default_pagination(self):
        """Test default pagination values"""
        params = PaginationParams()
        assert params.page == 1
        assert params.limit == 20

    def test_custom_pagination(self):
        """Test custom pagination values"""
        params = PaginationParams(page=5, limit=50)
        assert params.page == 5
        assert params.limit == 50

    def test_page_minimum(self):
        """Test page must be >= 1"""
        with pytest.raises(ValidationError):
            PaginationParams(page=0)

    def test_limit_minimum(self):
        """Test limit must be >= 1"""
        with pytest.raises(ValidationError):
            PaginationParams(limit=0)

    def test_limit_maximum(self):
        """Test limit must be <= 100"""
        with pytest.raises(ValidationError):
            PaginationParams(limit=101)
