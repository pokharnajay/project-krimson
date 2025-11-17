from openai import OpenAI
from config.settings import Config
from app.utils.logger import log_info, log_error, log_warning, log_debug
import json
import os
import re
from datetime import datetime

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

        # Setup AI responses log file
        self._setup_ai_responses_log()

    def _setup_ai_responses_log(self):
        """Ensure logs directory and AI responses log file exist"""
        try:
            # Get the base directory (project root)
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            logs_dir = os.path.join(base_dir, 'logs')

            # Create logs directory if it doesn't exist
            os.makedirs(logs_dir, exist_ok=True)

            # Set the log file path
            self.ai_responses_log = os.path.join(logs_dir, 'ai_responses.json')
            log_info(f"AI responses will be logged to: {self.ai_responses_log}")
        except Exception as e:
            log_error(f"Failed to setup AI responses log: {e}")
            self.ai_responses_log = None

    def _log_ai_response(self, query, raw_response, model, parsed_response=None, error=None):
        """Log AI response to external file"""
        if not self.ai_responses_log:
            return

        try:
            timestamp = datetime.now().isoformat()

            log_entry = {
                'timestamp': timestamp,
                'model': model,
                'query': query,
                'raw_response': raw_response,
                'parsed_response': parsed_response,
                'error': error
            }

            # Append to log file
            with open(self.ai_responses_log, 'a', encoding='utf-8') as f:
                f.write(json.dumps(log_entry, ensure_ascii=False) + '\n')
                f.write('-' * 100 + '\n')
        except Exception as e:
            log_error(f"Failed to write AI response to log file: {e}")
    
    def generate_answer(self, query, context_chunks, model=None):
        """Generate answer with text segments and associated timestamps/video_ids"""
        model = model or Config.OPENROUTER_MODEL
        log_info(f"Generating structured answer using model: {model}")

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
                        'end_time': int(chunk['metadata']['end_time']),
                        'text': chunk['metadata']['text'][:300],
                        'youtube_link': f"https://www.youtube.com/watch?v={video_id}&t={start_time}s"
                    }

            # Create prompt using loaded configuration
            user_prompt = self.prompts['user_prompt_template'].format(
                context=context_text,
                query=query
            )

            log_debug(f"Calling AI with JSON mode, max_tokens={self.prompts.get('max_tokens', 2000)}")

            # Call AI with JSON mode
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": self.prompts['system_prompt']},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=self.prompts.get('max_tokens', 2000),
                temperature=self.prompts.get('temperature', 0.7),
                response_format={"type": "json_object"}
            )

            answer_raw = response.choices[0].message.content
            log_debug(f"Received AI response: {len(answer_raw)} characters")

            # Parse the new response format
            result = self._parse_response_segments(answer_raw, sources_map)

            # Log the AI response to external file
            self._log_ai_response(
                query=query,
                raw_response=answer_raw,
                model=model,
                parsed_response=result
            )

            return {
                'response': result['response'],
                'sources': result['all_sources'],
                'model_used': model
            }

        except Exception as e:
            log_error(f"AI generation failed: {str(e)}")
            # Log the error as well
            self._log_ai_response(
                query=query,
                raw_response=None,
                model=model,
                error=str(e)
            )
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

    def _parse_response_segments(self, ai_response, sources_map):
        """
        Parse AI's JSON response with text segments and metadata.

        Args:
            ai_response: Raw AI response (JSON string)
            sources_map: Dict mapping video_id:timestamp to source metadata

        Returns:
            {
                'response': [{'text': '...', 'timestamp': 120, 'video_id': '...'}],
                'all_sources': [...]
            }
        """
        try:
            # Clean up the response if it's wrapped in markdown code blocks
            cleaned_response = ai_response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith('```'):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()

            # Parse JSON
            response_json = json.loads(cleaned_response)
            response_segments = response_json.get('response', [])

            if not response_segments:
                log_warning("AI returned empty response array")
                # Create fallback response
                response_segments = [{
                    'text': cleaned_response,
                    'timestamp': None,
                    'video_id': None
                }]

            # Process each segment to enrich with full source info
            processed_segments = []
            used_sources = set()

            for segment in response_segments:
                text = segment.get('text', '')
                timestamp = segment.get('timestamp')
                video_id = segment.get('video_id')

                # Validate segment
                if not text:
                    log_warning(f"Skipping segment with empty text: {segment}")
                    continue

                # Create processed segment
                processed_segment = {
                    'text': text,
                    'timestamp': timestamp,
                    'video_id': video_id
                }

                # If we have valid source info, track it
                if video_id and timestamp is not None:
                    key = f"{video_id}:{timestamp}"
                    used_sources.add(key)

                    # Add youtube_link for convenience
                    if key in sources_map:
                        processed_segment['youtube_link'] = sources_map[key]['youtube_link']
                    else:
                        processed_segment['youtube_link'] = f"https://www.youtube.com/watch?v={video_id}&t={timestamp}s"

                processed_segments.append(processed_segment)

            # Get all unique sources used
            all_sources = []
            for key in used_sources:
                if key in sources_map:
                    all_sources.append(sources_map[key])
                else:
                    # Create minimal source if not in map
                    video_id, timestamp = key.split(':')
                    all_sources.append({
                        'video_id': video_id,
                        'start_time': int(timestamp),
                        'youtube_link': f"https://www.youtube.com/watch?v={video_id}&t={timestamp}s"
                    })

            # If no sources were used, add all available sources as fallback
            if not all_sources:
                all_sources = list(sources_map.values())

            log_info(f"Parsed {len(processed_segments)} response segments with {len(all_sources)} unique sources")

            return {
                'response': processed_segments,
                'all_sources': all_sources
            }

        except json.JSONDecodeError as e:
            log_error(f"Failed to parse AI JSON response: {e}")
            log_debug(f"Raw response: {ai_response[:500]}...")

            # Fallback: treat as plain text
            return {
                'response': [{
                    'text': ai_response,
                    'timestamp': None,
                    'video_id': None
                }],
                'all_sources': list(sources_map.values())
            }
        except Exception as e:
            log_error(f"Unexpected error parsing response: {e}")
            return {
                'response': [{
                    'text': ai_response if isinstance(ai_response, str) else str(ai_response),
                    'timestamp': None,
                    'video_id': None
                }],
                'all_sources': list(sources_map.values())
            }
