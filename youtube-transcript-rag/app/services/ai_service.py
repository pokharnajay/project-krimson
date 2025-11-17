from openai import OpenAI
from config.settings import Config
from app.utils.logger import log_info, log_error, log_warning, log_debug
import json
import os
import re

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
        """Generate multi-paragraph answer with timestamp citations"""
        model = model or Config.OPENROUTER_MODEL
        log_info(f"Generating answer using model: {model}")

        try:
            # Format context grouped by video and chronologically ordered
            context_text = self._format_context_grouped(context_chunks)

            # Build sources map for citation resolution
            sources_map = {}
            for chunk in context_chunks:
                video_id = chunk['metadata']['video_id']
                start_time = int(chunk['metadata']['start_time'])
                key = f"{video_id}:{start_time}"

                if key not in sources_map:
                    sources_map[key] = {
                        'video_id': video_id,
                        'start_time': start_time,
                        'text': chunk['metadata']['text'][:200],
                        'youtube_link': f"https://www.youtube.com/watch?v={video_id}&t={start_time}s"
                    }

            # Create prompt using loaded configuration
            user_prompt = self.prompts['user_prompt_template'].format(
                context=context_text,
                query=query
            )

            log_debug(f"Calling AI with max_tokens={self.prompts.get('max_tokens', 1500)}")
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": self.prompts['system_prompt']
                    },
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.prompts.get('max_tokens', 1500),
                temperature=self.prompts.get('temperature', 0.7)
            )

            answer_raw = response.choices[0].message.content
            log_debug(f"Received AI response: {len(answer_raw)} characters")

            # Parse paragraphs with citations
            paragraphs = self._parse_paragraphs_with_citations(answer_raw, sources_map)

            # Also keep plain answer text (with citations converted to readable format)
            answer_text = self._convert_citations_to_text(answer_raw)

            # Collect all unique sources used
            all_sources = list(sources_map.values())

            return {
                'answer': answer_text,
                'paragraphs': paragraphs,
                'sources': all_sources,
                'primary_source': all_sources[0] if all_sources else None,
                'model_used': model
            }

        except Exception as e:
            log_error(f"AI generation failed: {str(e)}")
            raise Exception(f"Failed to generate answer: {str(e)}")

    def _format_context_grouped(self, context_chunks):
        """Format context chunks grouped by video and chronologically ordered"""
        # Group by video_id
        videos = {}
        for chunk in context_chunks:
            video_id = chunk['metadata']['video_id']
            if video_id not in videos:
                videos[video_id] = []
            videos[video_id].append(chunk)

        # Format output
        context_text = ""
        video_num = 1
        for video_id, chunks in videos.items():
            context_text += f"\n=== Video {video_num}: {video_id} ===\n"
            for i, chunk in enumerate(chunks, 1):
                start_time = int(chunk['metadata']['start_time'])
                text = chunk['metadata']['text']
                context_text += f"\n[Timestamp: {start_time}s]\n{text}\n"
            video_num += 1

        return context_text

    def _parse_paragraphs_with_citations(self, answer_text, sources_map):
        """
        Parse AI response into paragraphs with citations.
        Expected format: Each paragraph ends with [CITE:video_id:timestamp]
        """
        paragraphs = []

        # Split by double newlines to get paragraphs
        raw_paragraphs = [p.strip() for p in answer_text.split('\n\n') if p.strip()]

        # Pattern to match citations: [CITE:video_id:timestamp]
        citation_pattern = r'\[CITE:([^:]+):(\d+)\]'

        for para_text in raw_paragraphs:
            # Find citation in this paragraph
            citation_match = re.search(citation_pattern, para_text)

            if citation_match:
                video_id = citation_match.group(1)
                timestamp = int(citation_match.group(2))

                # Remove citation marker from text
                clean_text = re.sub(citation_pattern, '', para_text).strip()

                # Create YouTube link
                youtube_link = f"https://www.youtube.com/watch?v={video_id}&t={timestamp}s"

                # Find source info
                source_key = f"{video_id}:{timestamp}"
                source_info = sources_map.get(source_key, {
                    'video_id': video_id,
                    'start_time': timestamp,
                    'youtube_link': youtube_link
                })

                paragraphs.append({
                    'text': clean_text,
                    'citation': {
                        'video_id': video_id,
                        'timestamp': timestamp,
                        'youtube_link': youtube_link,
                        'display_text': '📺 Watch'
                    },
                    'source': source_info
                })
            else:
                # Paragraph without citation - still include it
                log_warning(f"Paragraph without citation: {para_text[:50]}...")
                paragraphs.append({
                    'text': para_text,
                    'citation': None,
                    'source': None
                })

        log_info(f"Parsed {len(paragraphs)} paragraphs with citations")
        return paragraphs

    def _convert_citations_to_text(self, answer_text):
        """Convert citation markers to readable text format"""
        # Replace [CITE:video_id:timestamp] with "📺 [Watch]"
        citation_pattern = r'\[CITE:([^:]+):(\d+)\]'

        def replace_citation(match):
            video_id = match.group(1)
            timestamp = match.group(2)
            return f" 📺 [Watch]({video_id}@{timestamp}s)"

        return re.sub(citation_pattern, replace_citation, answer_text)
