from sentence_transformers import SentenceTransformer
from config.settings import Config
from app.utils.logger import log_info, log_error, log_debug
import torch

class EmbeddingService:
    def __init__(self):
        log_debug("Initializing EmbeddingService with sentence-transformers")
        
        # Check GPU availability
        device = 'cuda' if torch.cuda.is_available() else 'cpu'
        log_info(f"Using device: {device}")
        if torch.cuda.is_available():
            log_info(f"GPU: {torch.cuda.get_device_name(0)}")
        
        # Load model and move to GPU if available
        self.model = SentenceTransformer('all-MiniLM-L6-v2', device=device)
        self.dimension = 384
    
    def create_embeddings(self, texts):
        """Create embeddings for list of texts using sentence-transformers"""
        log_info(f"Creating embeddings for {len(texts)} texts")
        try:
            # Generate embeddings (automatically uses GPU if available)
            embeddings = self.model.encode(
                texts, 
                convert_to_numpy=True,
                show_progress_bar=False  # Optional: disable progress bar in production
            )
            log_info(f"✓ Successfully created {len(embeddings)} embeddings")
            return embeddings.tolist()
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
