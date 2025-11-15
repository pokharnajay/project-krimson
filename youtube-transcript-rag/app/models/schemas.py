"""
Database Models and Pydantic Schemas for Request/Response Validation

This module contains:
1. Database schema documentation (Supabase tables)
2. Pydantic models for API request/response validation
3. Data transfer objects (DTOs)
"""

from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, validator, field_validator
from uuid import UUID


# ============================================================================
# DATABASE SCHEMAS (Supabase)
# ============================================================================

"""
Users Table Schema:
-------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW()
);

Sources Table Schema:
--------------------
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_ids TEXT[] NOT NULL,
    title TEXT NOT NULL,
    pinecone_namespace VARCHAR(255),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'processing'
        CHECK (status IN ('processing', 'ready', 'failed')),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_status ON sources(status);

Pinecone Vector Schema:
----------------------
{
    'id': str,  # Format: "{video_id}_{chunk_index}"
    'values': List[float],  # 384 dimensions
    'metadata': {
        'video_id': str,
        'text': str,  # Max 1000 chars
        'start_time': float,
        'end_time': float,
        'language': str,
        'language_code': str,
        'source_id': str,
        'user_id': str
    }
}
"""


# ============================================================================
# REQUEST SCHEMAS (Input Validation)
# ============================================================================

class LoginRequest(BaseModel):
    """User login request"""
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    password: str = Field(..., min_length=6, max_length=100, description="Password")

    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (underscores and hyphens allowed)')
        return v.lower()


class CreateUserRequest(BaseModel):
    """Create new user request"""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    initial_credits: int = Field(default=1000, ge=0, description="Initial credit balance")

    @field_validator('username')
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username must be alphanumeric (underscores and hyphens allowed)')
        return v.lower()

    @field_validator('password')
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        if not any(c.isdigit() for c in v):
            raise ValueError('Password must contain at least one digit')
        if not any(c.isalpha() for c in v):
            raise ValueError('Password must contain at least one letter')
        return v


class ProcessTranscriptRequest(BaseModel):
    """Request to process YouTube video(s) or playlist"""
    url: str = Field(..., description="YouTube video or playlist URL")

    @field_validator('url')
    @classmethod
    def validate_youtube_url(cls, v: str) -> str:
        if not ('youtube.com' in v or 'youtu.be' in v):
            raise ValueError('Must be a valid YouTube URL')
        return v


class QueryRequest(BaseModel):
    """RAG query request"""
    source_id: str = Field(..., description="Source ID to query")
    question: str = Field(..., min_length=3, max_length=500, description="Question to ask")

    @field_validator('source_id')
    @classmethod
    def validate_uuid(cls, v: str) -> str:
        try:
            UUID(v)
        except ValueError:
            raise ValueError('Invalid source_id format')
        return v


class PaginationParams(BaseModel):
    """Pagination parameters"""
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")


# ============================================================================
# RESPONSE SCHEMAS (Output Validation)
# ============================================================================

class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    refresh_token: Optional[str] = None


class UserResponse(BaseModel):
    """User profile response"""
    id: str
    username: str
    credits: int
    created_at: datetime

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class CreditsResponse(BaseModel):
    """User credits response"""
    credits: int


class SourceMetadata(BaseModel):
    """Source metadata"""
    video_count: Optional[int] = None
    language: Optional[str] = None
    duration: Optional[float] = None
    additional_info: Optional[Dict[str, Any]] = None


class SourceResponse(BaseModel):
    """Source response"""
    id: str
    title: str
    video_ids: List[str]
    status: Literal['processing', 'ready', 'failed']
    metadata: Optional[SourceMetadata] = None
    created_at: datetime
    pinecone_namespace: Optional[str] = None

    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class SourceListResponse(BaseModel):
    """Paginated source list response"""
    sources: List[SourceResponse]
    pagination: Dict[str, int]  # {page, limit, total, pages}


class ProcessTranscriptResponse(BaseModel):
    """Response when starting transcript processing"""
    source_id: str
    status: Literal['processing', 'ready', 'failed']
    message: str


class RelevantChunk(BaseModel):
    """Relevant transcript chunk from RAG search"""
    video_id: str
    text: str
    start_time: float
    end_time: float
    relevance_score: float
    language: Optional[str] = None


class QueryResponse(BaseModel):
    """RAG query response"""
    answer: str
    sources: List[RelevantChunk]
    credits_remaining: int


class ErrorResponse(BaseModel):
    """Standard error response"""
    error: str
    message: str
    details: Optional[Dict[str, Any]] = None


class SuccessResponse(BaseModel):
    """Standard success response"""
    message: str
    data: Optional[Dict[str, Any]] = None


# ============================================================================
# INTERNAL DATA MODELS
# ============================================================================

class VideoMetadata(BaseModel):
    """Video metadata from YouTube"""
    video_id: str
    title: str
    duration: Optional[float] = None
    thumbnail: Optional[str] = None
    channel: Optional[str] = None


class TranscriptChunk(BaseModel):
    """Transcript chunk for processing"""
    text: str
    start_time: float
    duration: float

    @property
    def end_time(self) -> float:
        return self.start_time + self.duration


class EmbeddingVector(BaseModel):
    """Embedding vector with metadata"""
    id: str
    values: List[float]
    metadata: Dict[str, Any]

    @field_validator('values')
    @classmethod
    def validate_dimensions(cls, v: List[float]) -> List[float]:
        if len(v) != 384:
            raise ValueError('Embedding must have 384 dimensions')
        return v


class ProcessingStatus(BaseModel):
    """Video processing status"""
    video_id: str
    status: Literal['pending', 'processing', 'completed', 'failed']
    error: Optional[str] = None


# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def validate_request(model: type[BaseModel], data: dict) -> BaseModel:
    """
    Validate request data against Pydantic model

    Args:
        model: Pydantic model class
        data: Request data dictionary

    Returns:
        Validated model instance

    Raises:
        ValueError: If validation fails
    """
    try:
        return model(**data)
    except Exception as e:
        raise ValueError(f"Validation error: {str(e)}")


def create_error_response(error: str, message: str, details: Optional[Dict] = None) -> Dict:
    """Create standardized error response"""
    return ErrorResponse(
        error=error,
        message=message,
        details=details
    ).model_dump()


def create_success_response(message: str, data: Optional[Dict] = None) -> Dict:
    """Create standardized success response"""
    return SuccessResponse(
        message=message,
        data=data
    ).model_dump()
