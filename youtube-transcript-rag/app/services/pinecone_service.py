from pinecone import Pinecone, ServerlessSpec
from config.settings import Config
from app.services.embedding_service import EmbeddingService
from app.utils.logger import log_info, log_error, log_debug
import time

class PineconeService:
    def __init__(self):
        log_info("Initializing PineconeService")
        self.pc = Pinecone(api_key=Config.PINECONE_API_KEY)
        self.index_name = Config.PINECONE_INDEX_NAME
        self.embedding_service = EmbeddingService()
        self._ensure_index_exists()
    
    def _ensure_index_exists(self):
        """Create index if it doesn't exist"""
        try:
            if self.index_name not in self.pc.list_indexes().names():
                log_info(f"Creating new Pinecone index: {self.index_name}")
                self.pc.create_index(
                    name=self.index_name,
                    dimension=384,  # Changed from 1536 to 384 for sentence-transformers
                    metric='cosine',
                    spec=ServerlessSpec(cloud='aws', region=Config.PINECONE_ENVIRONMENT)
                )
                time.sleep(1)
            else:
                log_info(f"Pinecone index {self.index_name} already exists")
        except Exception as e:
            log_error(f"Error ensuring Pinecone index exists: {str(e)}")
            raise

    
    def get_index(self):
        """Get Pinecone index"""
        return self.pc.Index(self.index_name)
    
    def video_exists(self, video_id):
        """Check if video already exists in vector store"""
        try:
            index = self.get_index()
            results = index.query(
                vector=[0] * 384,  # Changed from 1536 to 384
                filter={'video_id': {'$eq': video_id}},
                top_k=1
            )
            exists = len(results['matches']) > 0
            log_debug(f"Video {video_id} exists in Pinecone: {exists}")
            return exists
        except Exception as e:
            log_error(f"Error checking if video exists: {str(e)}")
            return False
    
    def store_transcript(self, video_id, transcript_data, source_id=None, user_id=None):
        """Store transcript chunks as vectors with source and user metadata"""
        log_info(f"Starting to store transcript for video {video_id}")
        try:
            if self.video_exists(video_id):
                log_info(f"Video {video_id} already exists in Pinecone, skipping")
                return {'status': 'exists', 'video_id': video_id}
            
            # Chunk transcript
            log_debug(f"Chunking transcript with {len(transcript_data['segments'])} segments")
            chunks = EmbeddingService.chunk_transcript(transcript_data['segments'])
            log_info(f"Created {len(chunks)} chunks for video {video_id}")
            
            # Create embeddings
            texts = [chunk['text'] for chunk in chunks]
            log_debug(f"Creating embeddings for {len(texts)} text chunks")
            embeddings = self.embedding_service.create_embeddings(texts)
            log_info(f"Created {len(embeddings)} embeddings")
            
            # Prepare vectors for upsert
            vectors = []
            for idx, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
                metadata = {
                    'video_id': video_id,
                    'text': chunk['text'][:1000],  # Limit text length
                    'start_time': chunk['start_time'],
                    'end_time': chunk['end_time'],
                    'language': transcript_data['language'],
                    'language_code': transcript_data['language_code']
                }
                
                # Add source and user IDs if provided
                if source_id:
                    metadata['source_id'] = source_id
                if user_id:
                    metadata['user_id'] = user_id
                
                vectors.append({
                    'id': f"{video_id}_{idx}",
                    'values': embedding,
                    'metadata': metadata
                })
            
            log_debug(f"Prepared {len(vectors)} vectors for upsert")
            
            # Upsert to Pinecone
            index = self.get_index()
            index.upsert(vectors=vectors)
            log_info(f"✓ Successfully stored {len(vectors)} vectors for video {video_id}")
            
            return {'status': 'stored', 'video_id': video_id, 'chunks': len(vectors)}
            
        except Exception as e:
            log_error(f"Error storing transcript for video {video_id}: {str(e)}")
            raise
    
    def query_videos(self, query_text, video_ids=None, source_id=None, top_k=None):
        """Query vector store with optional filters"""
        log_info(f"Querying videos with: video_ids={video_ids}, source_id={source_id}")
        top_k = top_k or Config.TOP_K_RESULTS
        
        try:
            # Create query embedding
            query_embedding = self.embedding_service.create_embeddings([query_text])[0]
            
            # Build filter
            filter_dict = {}
            if video_ids:
                filter_dict['video_id'] = {'$in': video_ids}
            elif source_id:
                filter_dict['source_id'] = {'$eq': source_id}
            
            log_debug(f"Using filter: {filter_dict}")
            
            # Query
            index = self.get_index()
            results = index.query(
                vector=query_embedding,
                filter=filter_dict if filter_dict else None,
                top_k=top_k,
                include_metadata=True
            )
            
            log_info(f"Query returned {len(results['matches'])} results")
            return results['matches']
            
        except Exception as e:
            log_error(f"Error querying videos: {str(e)}")
            raise
