# YouTube RAG Application - Setup Guide

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env
```

### 2. Get Required API Keys

You need to obtain the following API keys and update your `.env` file:

#### OpenRouter API Key (Required for AI Responses)
1. Go to https://openrouter.ai/
2. Sign up or log in
3. Navigate to the "Keys" section
4. Click "Create Key"
5. Copy your API key (starts with `sk-or-v1-...`)
6. Update `.env`: `OPENROUTER_API_KEY=sk-or-v1-your-key-here`

#### Pinecone API Key (Required for Vector Database)
1. Go to https://www.pinecone.io/
2. Sign up or log in
3. Create a new project if you haven't already
4. Go to "API Keys"
5. Copy your API key
6. Update `.env`: `PINECONE_API_KEY=your-pinecone-key-here`
7. Create an index named `youtube-transcripts` with dimension 384

#### Supabase Credentials (Required for User Management)
1. Go to https://supabase.com/
2. Sign up or log in
3. Create a new project
4. Go to Project Settings > API
5. Copy the "Project URL" and "service_role key"
6. Update `.env`:
   - `SUPABASE_URL=your-project-url`
   - `SUPABASE_SERVICE_KEY=your-service-role-key`

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Application

```bash
python run.py
```

## Troubleshooting

### Error: "User not found" (401) from OpenRouter

This error means your OpenRouter API key is invalid or missing. Make sure:
1. You've replaced `your_openrouter_api_key_here` with your actual API key
2. The API key is valid and not expired
3. You've restarted the backend server after updating `.env`

### Error: Service initialization failed

This usually means one or more API keys are missing or invalid. Check:
1. All required API keys are set in `.env`
2. The keys are valid and not expired
3. You've created the required Pinecone index
4. Your Supabase project is set up correctly

## Security Notes

- **NEVER** commit your `.env` file to version control
- The `.env.example` file should only contain placeholder values
- Keep your API keys secure and rotate them regularly
- Use different API keys for development and production
