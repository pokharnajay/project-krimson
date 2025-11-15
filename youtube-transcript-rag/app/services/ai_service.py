from openai import OpenAI
from config.settings import Config
from app.utils.logger import log_info, log_error

class AIService:
    def __init__(self):
        self.client = OpenAI(
            base_url="https://openrouter.ai/api/v1",
            api_key=Config.OPENROUTER_API_KEY
        )
    
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
            
            # Create prompt that encourages citing sources
            prompt = f"""Based on the following video transcripts, answer the question. 
When referencing information, cite the source number and provide the YouTube link with timestamp.

Context:
{context_text}

Question: {query}

Answer the question and provide the YouTube link with timestamp for the most relevant source."""
            
            response = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that answers questions based on YouTube video transcripts. Always cite sources with timestamps."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=500,
                temperature=0.7
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
