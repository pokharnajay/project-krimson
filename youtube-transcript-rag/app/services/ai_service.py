from openai import OpenAI
from config.settings import Config
from app.utils.logger import log_info, log_error, log_warning
import json
import os

def load_prompts():
    """Load prompts from JSON configuration file"""
    prompts_path = os.getenv('PROMPTS_CONFIG_PATH', 'config/prompts.json')

    # Try to load from file
    try:
        # Get the absolute path relative to the project root
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        full_path = os.path.join(base_dir, prompts_path)

        with open(full_path, 'r') as f:
            prompts = json.load(f)
            log_info(f"Loaded prompts from {prompts_path}")
            return prompts
    except Exception as e:
        log_warning(f"Failed to load prompts from {prompts_path}: {e}")
        log_warning("Using default fallback prompts")

        # Fallback to default prompts
        return {
            "system_prompt": "You are a knowledgeable assistant that provides clear, accurate answers based on YouTube video transcripts. Your answers should be natural and conversational, without any source citations, links, or timestamp references in the text itself. Answer questions directly and concisely.",
            "user_prompt_template": "You are answering a question based on YouTube video transcript excerpts provided below.\n\nIMPORTANT INSTRUCTIONS:\n- Provide a clear, natural, and conversational answer based on the context\n- DO NOT include source numbers (like [Source 1]) in your answer\n- DO NOT include YouTube links or timestamps in your answer text\n- DO NOT mention \"in the video\" or reference timestamps explicitly\n- Focus on delivering the information in a helpful, direct way\n- If the context doesn't fully answer the question, acknowledge what you can answer from the available information\n\nContext from video transcripts:\n{context}\n\nQuestion: {query}\n\nProvide a helpful answer based solely on the information in the transcripts above. Keep your answer concise and natural.",
            "max_tokens": 500,
            "temperature": 0.7
        }

class AIService:
    def __init__(self):
        if not Config.OPENROUTER_API_KEY:
            log_error("OPENROUTER_API_KEY is not set in environment variables!")
            raise ValueError("OpenRouter API key is required but not configured")

        # Log masked API key to verify it's being read
        masked_key = Config.OPENROUTER_API_KEY[:10] + "..." + Config.OPENROUTER_API_KEY[-4:] if len(Config.OPENROUTER_API_KEY) > 14 else "***"
        log_info(f"Initializing AIService with API key: {masked_key}")

        # Check if using the invalid example key
        if Config.OPENROUTER_API_KEY.startswith("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"):
            log_error("You are using the example API key from .env.example which is invalid!")
            log_error("Please get a valid API key from https://openrouter.ai/ and update your .env file")
            raise ValueError(
                "Invalid OpenRouter API key detected. "
                "The key in your .env file appears to be the example placeholder. "
                "Please:\n"
                "1. Go to https://openrouter.ai/\n"
                "2. Sign up/login and create a new API key\n"
                "3. Update OPENROUTER_API_KEY in your .env file\n"
                "4. Restart the backend server"
            )

        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=Config.OPENROUTER_API_KEY,
            default_headers={
                "HTTP-Referer": "https://github.com/pokharnajay/project-krimson",
                "X-Title": "YouTube RAG Application"
            }
        )

        # Load prompts from JSON
        self.prompts = load_prompts()
    
    def generate_answer(self, query, context_chunks, model=None):
        """Generate answer using OpenRouter with video timestamps"""
        model = model or Config.OPENROUTER_MODEL
        log_info(f"Generating answer using model: {model}")
        
        try:
            # Format context with timestamps and video IDs
            context_text = ""
            sources = []
            for i, chunk in enumerate(context_chunks):
                video_id = chunk['metadata']['video_id']
                start_time = int(chunk['metadata']['start_time'])
                text = chunk['metadata']['text']
                
                context_text += f"\n[Source {i+1}] Video: {video_id}, Time: {start_time}s\n{text}\n"
                sources.append({
                    'video_id': video_id,
                    'start_time': start_time,
                    'text': text[:200],
                    'youtube_link': f"https://www.youtube.com/watch?v={video_id}&t={start_time}s"
                })
            
            # Create prompt using loaded configuration
            user_prompt = self.prompts['user_prompt_template'].format(
                context=context_text,
                query=query
            )

            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": self.prompts['system_prompt']
                    },
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.prompts.get('max_tokens', 500),
                temperature=self.prompts.get('temperature', 0.7)
            )
            
            answer = response.choices[0].message.content
            
            return {
                'answer': answer,
                'sources': sources,
                'primary_source': sources[0] if sources else None,
                'model_used': model
            }
            
        except Exception as e:
            log_error(f"AI generation failed: {str(e)}")
            raise Exception(f"Failed to generate answer: {str(e)}")
