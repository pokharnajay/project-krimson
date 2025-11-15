from openai import OpenAI
from config.settings import Config
from app.utils.logger import log_info, log_error, log_debug

class EmbeddingService:
    def __init__(self):
        log_debug("Initializing EmbeddingService")
        self.client = OpenAI(api_key=Config.OPENROUTER_API_KEY)
    
    def create_embeddings(self, texts):
        """Create embeddings for list of texts"""
        log_info(f"Creating embeddings for {len(texts)} texts")
        try:
            response = self.client.embeddings.create(
                model=Config.EMBEDDING_MODEL,
                input=texts
            )
            embeddings = [item.embedding for item in response.data]
            log_info(f"✓ Successfully created {len(embeddings)} embeddings")
            return embeddings
        except Exception as e:
            log_error(f"Embedding creation failed: {str(e)}")
            raise Exception(f"Embedding creation failed: {str(e)}")
    
    @staticmethod
    def chunk_transcript(segments, chunk_size=Config.CHUNK_SIZE):
        """Split transcript into chunks with metadata"""
        log_debug(f"Chunking {len(segments)} segments with chunk_size={chunk_size}")
        chunks = []
        current_chunk = {
            'text': '',
            'start_time': segments[0]['start'],
            'end_time': 0,
            'segments': []
        }
        current_length = 0
        
        for segment in segments:
            text = segment['text']
            if current_length + len(text) > chunk_size and current_chunk['text']:
                chunks.append(current_chunk)
                current_chunk = {
                    'text': text,
                    'start_time': segment['start'],
                    'end_time': segment['start'] + segment['duration'],
                    'segments': [segment]
                }
                current_length = len(text)
            else:
                current_chunk['text'] += ' ' + text
                current_chunk['end_time'] = segment['start'] + segment['duration']
                current_chunk['segments'].append(segment)
                current_length += len(text)
        
        if current_chunk['text']:
            chunks.append(current_chunk)
        
        log_debug(f"Created {len(chunks)} chunks")
        return chunks
