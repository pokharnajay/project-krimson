# YouTube Transcript RAG API

A Flask-based REST API that enables Retrieval-Augmented Generation (RAG) on YouTube video transcripts. Process YouTube videos or entire playlists, store transcript embeddings in a vector database, and query them using natural language powered by AI.

## Features

- **JWT Authentication** - Secure user authentication with access and refresh tokens
- **YouTube Processing** - Extract transcripts from individual videos or entire playlists
- **Vector Search** - Store and search transcript embeddings using Pinecone
- **RAG Queries** - Ask questions about video content using AI-powered retrieval
- **Credit System** - Per-user credit tracking for API usage
- **Multi-language Support** - Automatic language detection and transcript extraction
- **GPU Acceleration** - Optional GPU support for faster embedding generation

## Tech Stack

- **Framework**: Flask 3.0
- **Authentication**: JWT (Flask-JWT-Extended)
- **Database**: Supabase (PostgreSQL)
- **Vector DB**: Pinecone
- **AI/ML**:
  - SentenceTransformers (all-MiniLM-L6-v2) for embeddings
  - OpenRouter API (OpenAI GPT-4) for answer generation
- **YouTube**: youtube-transcript-api, pytube

## Architecture

```
youtube-transcript-rag/
├── app/
│   ├── __init__.py              # Flask app factory
│   ├── models/
│   │   └── schemas.py           # Database models & validation schemas
│   ├── routes/                  # API endpoints (Blueprints)
│   │   ├── auth_routes.py       # Authentication endpoints
│   │   ├── transcript_routes.py # Transcript processing
│   │   ├── query_routes.py      # RAG query endpoints
│   │   └── user_routes.py       # User profile & credits
│   ├── services/                # Business logic layer
│   │   ├── supabase_service.py  # Database operations
│   │   ├── youtube_service.py   # YouTube metadata
│   │   ├── transcript_service.py # Transcript fetching
│   │   ├── pinecone_service.py  # Vector storage & search
│   │   ├── ai_service.py        # LLM integration
│   │   └── embedding_service.py # Embedding generation
│   └── utils/                   # Utilities
│       ├── auth.py              # Auth decorators
│       ├── helpers.py           # Helper functions
│       └── logger.py            # Logging configuration
├── config/
│   └── settings.py              # Configuration management
├── logs/                        # Application logs (gitignored)
├── tests/                       # Unit & integration tests
├── .env                         # Environment variables (gitignored)
├── .env.example                 # Environment template
├── requirements.txt             # Python dependencies
├── Dockerfile                   # Docker container config
├── docker-compose.yml           # Multi-container setup
└── run.py                       # Application entry point
```

## Prerequisites

- Python 3.10+
- PostgreSQL (via Supabase)
- Pinecone account
- OpenRouter API key
- (Optional) CUDA-compatible GPU for faster embeddings

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd youtube-transcript-rag
```

### 2. Create virtual environment

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure environment variables

Copy the example environment file and configure your credentials:

```bash
cp .env.example .env
```

Edit `.env` with your actual credentials (see Configuration section below).

### 5. Set up database

**Supabase Setup:**

1. Create a Supabase project at https://supabase.com
2. Run the following SQL to create tables:

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits INTEGER DEFAULT 1000,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sources table
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_ids TEXT[] NOT NULL,
    title TEXT NOT NULL,
    pinecone_namespace VARCHAR(255),
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'ready', 'failed')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sources_user_id ON sources(user_id);
CREATE INDEX idx_sources_status ON sources(status);
```

**Pinecone Setup:**

1. Create a Pinecone account at https://www.pinecone.io
2. Create an index with:
   - Dimensions: 384
   - Metric: cosine
   - Environment: us-east-1 (or your preferred region)

### 6. Create admin user

```bash
python admin_user_create.py
```

Follow the prompts to create your first admin user.

### 7. Run the application

**Development:**
```bash
python run.py
```

**Production (with Gunicorn):**
```bash
gunicorn -w 4 -b 0.0.0.0:5000 run:app
```

The API will be available at `http://localhost:5000`

## Configuration

All configuration is managed through environment variables. Copy `.env.example` to `.env` and configure:

### Core Settings

```env
# Flask
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key-here
JWT_ACCESS_TOKEN_EXPIRES=3600        # 1 hour
JWT_REFRESH_TOKEN_EXPIRES=2592000    # 30 days
```

### Database

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

### Admin

```env
ADMIN_API_KEY=your-admin-api-key
```

### AI/ML

```env
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=openai/gpt-4-turbo
```

### Vector Database

```env
PINECONE_API_KEY=your-pinecone-api-key
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=youtube-transcripts
```

### Processing

```env
MAX_THREADS=5                # Concurrent video processing threads
VECTOR_SEARCH_TYPE=similarity
TOP_K_RESULTS=5             # Number of chunks returned in RAG queries
```

## Docker Deployment

### Build and run with Docker Compose

```bash
docker-compose up -d
```

This will start the Flask API on port 5000.

### Build standalone Docker image

```bash
docker build -t youtube-transcript-rag .
docker run -p 5000:5000 --env-file .env youtube-transcript-rag
```

## API Documentation

### Authentication

All endpoints (except login) require JWT authentication. Include the access token in the Authorization header:

```
Authorization: Bearer <access_token>
```

### Endpoints

#### **POST** `/api/auth/login`
Authenticate user and receive JWT tokens.

**Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### **POST** `/api/auth/refresh`
Refresh access token using refresh token.

**Headers:**
```
Authorization: Bearer <refresh_token>
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### **POST** `/api/transcripts/process`
Process YouTube video(s) or playlist.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```
or
```json
{
  "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
}
```

**Response:**
```json
{
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Processing started for 1 video(s)"
}
```

#### **GET** `/api/transcripts/sources`
Get all sources for the authenticated user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)

**Response:**
```json
{
  "sources": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Rick Astley - Never Gonna Give You Up",
      "video_ids": ["dQw4w9WgXcQ"],
      "status": "ready",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

#### **GET** `/api/transcripts/sources/<source_id>`
Get specific source details.

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Rick Astley - Never Gonna Give You Up",
  "video_ids": ["dQw4w9WgXcQ"],
  "status": "ready",
  "metadata": {
    "video_count": 1,
    "language": "en"
  },
  "created_at": "2025-01-15T10:30:00Z"
}
```

#### **DELETE** `/api/transcripts/sources/<source_id>`
Delete a source and its embeddings.

**Response:**
```json
{
  "message": "Source deleted successfully"
}
```

#### **POST** `/api/query/ask`
Ask a question about processed videos using RAG.

**Request:**
```json
{
  "source_id": "550e8400-e29b-41d4-a716-446655440000",
  "question": "What is the main topic of this video?"
}
```

**Response:**
```json
{
  "answer": "The video is about...",
  "sources": [
    {
      "video_id": "dQw4w9WgXcQ",
      "text": "Relevant transcript chunk...",
      "start_time": 10.5,
      "end_time": 15.2,
      "relevance_score": 0.87
    }
  ],
  "credits_remaining": 950
}
```

#### **GET** `/api/user/credits`
Get user's remaining credits.

**Response:**
```json
{
  "credits": 1000
}
```

#### **GET** `/api/user/profile`
Get user profile information.

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "username": "admin",
  "credits": 1000,
  "created_at": "2025-01-01T00:00:00Z"
}
```

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth_routes.py
```

## Development

### Code Formatting

```bash
# Format code
black .

# Lint
flake8 app/

# Type checking
mypy app/
```

### Adding New Endpoints

1. Create route in appropriate blueprint (`app/routes/`)
2. Implement business logic in service layer (`app/services/`)
3. Add request/response models in `app/models/schemas.py`
4. Add tests in `tests/`
5. Update API documentation

## Security Best Practices

- ✅ JWT tokens with expiration
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on all endpoints
- ✅ Input validation with Pydantic
- ✅ CORS configuration
- ✅ Environment-based secrets management
- ⚠️  Use HTTPS in production
- ⚠️  Regularly rotate JWT secrets
- ⚠️  Monitor API usage and set up alerts

## Performance Optimization

- **Caching**: Consider adding Redis for frequently accessed data
- **Async Processing**: Use Celery/RQ for long-running video processing
- **Connection Pooling**: Database connection pooling is handled by Supabase client
- **GPU**: Enable GPU acceleration for faster embedding generation (requires CUDA)

## Troubleshooting

### Common Issues

**"No module named 'app'"**
- Ensure you're in the project root directory
- Activate virtual environment: `source venv/bin/activate`

**"Invalid JWT token"**
- Token may be expired, refresh using `/api/auth/refresh`
- Check `JWT_SECRET_KEY` is consistent across restarts

**"Pinecone index not found"**
- Verify `PINECONE_INDEX_NAME` matches your Pinecone dashboard
- Ensure index dimensions = 384

**"YouTube transcript unavailable"**
- Video may not have transcripts/captions
- Try different language code or manually uploaded captions

**"Supabase connection failed"**
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
- Verify network connectivity to Supabase

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add new feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a Pull Request

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review API logs in `logs/logging.txt`
