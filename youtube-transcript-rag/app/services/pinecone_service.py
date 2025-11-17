from pinecone import Pinecone, ServerlessSpec
from config.settings import Config
from app.services.embedding_service import EmbeddingService
from app.utils.logger import log_info, log_error, log_debug, log_warning
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
            # Log error but don't fail silently - we'll handle this in store_transcript
            log_error(f"Error checking if video exists in Pinecone for {video_id}: {str(e)}")
            # Return False to attempt storage - Pinecone will handle duplicate prevention
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
        """Query vector store with enhanced deduplication and grouping"""
        log_info(f"Querying videos with: video_ids={video_ids}, source_id={source_id}")
        # Use provided top_k or config value (respect env variable)
        if top_k is None:
            top_k = Config.TOP_K_RESULTS

        log_info(f"Using top_k={top_k} for vector search (Config.TOP_K_RESULTS={Config.TOP_K_RESULTS})")

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

            log_info(f"Query returned {len(results['matches'])} raw results")

            # Enhanced processing: deduplicate and group
            chunks = results['matches']
            chunks = self._deduplicate_chunks(chunks)
            chunks = self._group_and_sort_chunks(chunks)

            log_info(f"After deduplication and sorting: {len(chunks)} results")
            return chunks

        except Exception as e:
            log_error(f"Error querying videos: {str(e)}")
            raise

    def _calculate_overlap(self, chunk1, chunk2):
        """
        Calculate percentage of timestamp overlap between two chunks.

        Args:
            chunk1: First chunk with metadata containing start_time and end_time
            chunk2: Second chunk with metadata containing start_time and end_time

        Returns:
            float: Overlap percentage (0.0 to 1.0)
        """
        start1 = chunk1['metadata']['start_time']
        end1 = chunk1['metadata']['end_time']
        start2 = chunk2['metadata']['start_time']
        end2 = chunk2['metadata']['end_time']

        # Calculate overlap duration
        overlap_start = max(start1, start2)
        overlap_end = min(end1, end2)

        # No overlap
        if overlap_start >= overlap_end:
            return 0.0

        overlap_duration = overlap_end - overlap_start

        # Calculate overlap as percentage of shorter chunk
        duration1 = end1 - start1
        duration2 = end2 - start2
        min_duration = min(duration1, duration2)

        if min_duration == 0:
            return 0.0

        return overlap_duration / min_duration

    def _deduplicate_chunks(self, chunks):
        """
        Remove chunks with overlapping timestamps (>80% overlap).
        Keeps chunks with higher similarity scores.

        Args:
            chunks: List of chunk matches from Pinecone

        Returns:
            List of deduplicated chunks
        """
        if not chunks:
            return []

        # Sort by score (highest first)
        sorted_chunks = sorted(chunks, key=lambda x: x.get('score', 0), reverse=True)

        deduplicated = []
        overlap_threshold = 0.8  # 80% overlap threshold

        for chunk in sorted_chunks:
            # Check if this chunk overlaps significantly with any kept chunk
            has_significant_overlap = False

            for kept_chunk in deduplicated:
                # Only check overlap for chunks from the same video
                if chunk['metadata']['video_id'] == kept_chunk['metadata']['video_id']:
                    overlap = self._calculate_overlap(chunk, kept_chunk)

                    if overlap > overlap_threshold:
                        log_debug(f"Removing chunk due to {overlap:.0%} overlap with higher-scored chunk")
                        has_significant_overlap = True
                        break

            if not has_significant_overlap:
                deduplicated.append(chunk)

        # Ensure we keep at least 3 chunks even if there's high overlap
        # This handles edge cases where deduplication is too aggressive
        if len(deduplicated) < 3 and len(sorted_chunks) >= 3:
            log_warning("Deduplication too aggressive, keeping top 3 chunks")
            deduplicated = sorted_chunks[:3]

        log_info(f"Deduplicated {len(chunks)} chunks to {len(deduplicated)} chunks")
        return deduplicated

    def _group_and_sort_chunks(self, chunks):
        """
        Group chunks by video_id and sort chronologically within each video.
        Then flatten back to a single list while maintaining video grouping.

        Args:
            chunks: List of deduplicated chunks

        Returns:
            List of chunks grouped by video and sorted chronologically
        """
        if not chunks:
            return []

        # Group by video_id
        videos_dict = {}
        for chunk in chunks:
            video_id = chunk['metadata']['video_id']
            if video_id not in videos_dict:
                videos_dict[video_id] = []
            videos_dict[video_id].append(chunk)

        # Sort each video's chunks chronologically
        for video_id in videos_dict:
            videos_dict[video_id].sort(key=lambda x: x['metadata']['start_time'])

        # Flatten back to single list (maintains video grouping)
        # Videos are ordered by relevance (first chunk's score)
        sorted_videos = sorted(
            videos_dict.items(),
            key=lambda x: max(chunk.get('score', 0) for chunk in x[1]),
            reverse=True
        )

        result = []
        for video_id, video_chunks in sorted_videos:
            result.extend(video_chunks)
            log_debug(f"Video {video_id}: {len(video_chunks)} chunks sorted chronologically")

        return result
