# RAG Query System Improvement Plan

## Current Implementation Analysis

### What We Have Now:
1. **Vector Search**: Retrieves top_k=5 chunks from Pinecone
2. **Simple Context**: Chunks formatted as "[Source 1] Video: ID, Time: Xs\nText"
3. **Single Answer**: AI generates one paragraph without citations
4. **No Deduplication**: Overlapping timestamps may appear multiple times
5. **No Grouping**: Results not organized by video or time
6. **No Citations**: AI explicitly told NOT to include timestamps

### Problems:
- Limited context (only 5 chunks)
- Overlapping chunks waste tokens
- Can't track which part of answer comes from which timestamp
- Can't navigate to specific video moments
- Answers lack depth and organization

---

## Proposed Improvements

### 1. **Enhanced Vector Search** (pinecone_service.py)
- Increase top_k from 5 to 15 (get more context)
- Add chunk deduplication logic
  - Remove chunks with >80% timestamp overlap
  - Keep the most relevant chunk (higher similarity score)
- Group results by video_id
- Sort chronologically within each video

### 2. **Better Context Organization** (ai_service.py)
- Format context by video, then by timestamp
- Include similarity scores for AI to prioritize
- Provide richer metadata (video title if available)

### 3. **Updated Prompts** (prompts.json)
- NEW: Multi-paragraph instruction (2-4 paragraphs)
- NEW: Require timestamp citations at paragraph end
- NEW: Encourage direct quotes from transcript
- NEW: Format citations as: "📺 [Watch at 1:23]"
- Remove old "no citations" instruction

### 4. **Enhanced Response Format** (ai_service.py)
- Parse AI response to extract paragraphs
- Attach metadata to each paragraph
- Generate clickable YouTube timestamp links
- Format final response with embedded citations

---

## Implementation Steps

### Phase 1: Pinecone Service Enhancements
**File**: `app/services/pinecone_service.py`

**Changes**:
```python
def query_videos_enhanced(query_text, video_ids, source_id, top_k=15):
    # 1. Get initial results (top_k=15)
    # 2. Deduplicate overlapping chunks
    # 3. Group by video_id
    # 4. Sort chronologically
    # 5. Return structured result
```

**New Functions**:
- `deduplicate_chunks(chunks)` - Remove overlapping timestamps
- `group_by_video(chunks)` - Organize by video_id
- `calculate_overlap(chunk1, chunk2)` - Check timestamp overlap

### Phase 2: AI Service Enhancements
**File**: `app/services/ai_service.py`

**Changes**:
```python
def generate_answer_with_citations(query, context_chunks, model):
    # 1. Format enhanced context (grouped by video/time)
    # 2. Use new prompts with citation requirements
    # 3. Call AI with more tokens (increase to 1000)
    # 4. Parse response for paragraphs
    # 5. Attach source metadata to each paragraph
    # 6. Generate YouTube links
```

**New Functions**:
- `format_enhanced_context(chunks)` - Better context formatting
- `parse_paragraphs_with_sources(answer, chunks)` - Extract citations
- `generate_youtube_link(video_id, timestamp)` - Create watch links

### Phase 3: Prompt Updates
**File**: `config/prompts.json`

**New Structure**:
```json
{
  "system_prompt": "Enhanced with citation instructions",
  "user_prompt_template": "Multi-paragraph with timestamp requirements",
  "citation_format": "📺 [Watch at HH:MM:SS]",
  "max_paragraphs": 4,
  "require_quotes": true
}
```

### Phase 4: Response Format Enhancement
**File**: `app/routes/query_routes.py`

**Changes**:
- Update response to include paragraphs array
- Each paragraph has: text, citations[], video_id
- Citations have: timestamp, youtube_link, text_snippet

---

## Detailed Implementation

### 1. Chunk Deduplication Logic

**Algorithm**:
```python
def deduplicate_chunks(chunks):
    result = []
    for chunk in sorted(chunks, key=lambda x: x['score'], reverse=True):
        # Check if overlaps with any existing chunk
        overlaps = False
        for existing in result:
            if same_video(chunk, existing):
                overlap_pct = calculate_overlap(chunk, existing)
                if overlap_pct > 0.8:  # 80% overlap threshold
                    overlaps = True
                    break
        if not overlaps:
            result.append(chunk)
    return result

def calculate_overlap(chunk1, chunk2):
    # Calculate percentage of timestamp overlap
    start1, end1 = chunk1['start_time'], chunk1['end_time']
    start2, end2 = chunk2['start_time'], chunk2['end_time']

    overlap_start = max(start1, start2)
    overlap_end = min(end1, end2)

    if overlap_start >= overlap_end:
        return 0.0

    overlap = overlap_end - overlap_start
    duration1 = end1 - start1
    duration2 = end2 - start2

    return overlap / min(duration1, duration2)
```

### 2. Context Formatting

**Enhanced Format**:
```
Video 1 (ID: xyz123):
  [0:15 - 0:45] (Relevance: 95%)
  "Direct quote from transcript..."

  [2:30 - 3:00] (Relevance: 88%)
  "Another quote..."

Video 2 (ID: abc456):
  [1:05 - 1:35] (Relevance: 82%)
  "Quote from second video..."
```

### 3. Prompt Updates

**New System Prompt**:
```
You are an expert video analyst providing comprehensive answers from YouTube transcripts.

RESPONSE FORMAT REQUIREMENTS:
1. Write 2-4 distinct paragraphs
2. Each paragraph addresses a different aspect or timestamp
3. End EVERY paragraph with a timestamp citation
4. Citation format: 📺 [Watch at MM:SS or HH:MM:SS]
5. Include direct quotes from transcripts when relevant

PARAGRAPH STRUCTURE:
- Paragraph 1: Main answer with primary source citation
- Paragraph 2-3: Supporting details with different timestamp citations
- Paragraph 4: Additional context or summary (if needed)

Each paragraph MUST cite a specific timestamp.
```

**New User Prompt Template**:
```
Answer this question using the video transcript excerpts below.

IMPORTANT REQUIREMENTS:
✓ Write 2-4 clear paragraphs
✓ Each paragraph covers different time segments
✓ End each paragraph with: 📺 [Watch at MM:SS]
✓ Include direct quotes using "quotation marks"
✓ Cite the most relevant timestamp for each paragraph
✓ Organize chronologically when possible

Context (organized by video and timestamp):
{context}

Question: {query}

Provide a comprehensive, well-organized answer with proper citations.
```

### 4. Response Structure

**New Response Format**:
```json
{
  "answer": "Full answer text with embedded citations",
  "paragraphs": [
    {
      "text": "Paragraph 1 text...",
      "citation": {
        "video_id": "xyz123",
        "timestamp": 125,
        "formatted_time": "2:05",
        "youtube_link": "https://www.youtube.com/watch?v=xyz123&t=125s",
        "text_snippet": "Direct quote from transcript"
      }
    }
  ],
  "sources": [...], // All unique sources used
  "videos_referenced": 2,
  "total_paragraphs": 3
}
```

---

## Edge Cases & Error Handling

### Edge Case 1: No Results
- **Issue**: Query returns 0 chunks
- **Solution**: Return friendly message, suggest rephrasing

### Edge Case 2: Single Video
- **Issue**: All chunks from one video
- **Solution**: Still format with timestamps, group chronologically

### Edge Case 3: Very Short Transcript
- **Issue**: Not enough content for multiple paragraphs
- **Solution**: Generate 1-2 paragraphs with available citations

### Edge Case 4: Overlapping All Chunks
- **Issue**: Deduplication removes most results
- **Solution**: Keep at least 3 chunks even if overlap >80%

### Edge Case 5: AI Doesn't Follow Format
- **Issue**: AI doesn't include citations
- **Solution**: Post-process to add citations based on context

### Edge Case 6: Invalid Timestamps
- **Issue**: Timestamp extraction fails
- **Solution**: Fallback to showing all sources at end

---

## Testing Checklist

- [ ] Vector search returns 10-15 chunks
- [ ] Deduplication removes overlapping chunks
- [ ] Chunks grouped by video_id
- [ ] Chunks sorted chronologically
- [ ] AI generates 2-4 paragraphs
- [ ] Each paragraph has timestamp citation
- [ ] Citations are clickable YouTube links
- [ ] Direct quotes included when relevant
- [ ] Works with single video source
- [ ] Works with multi-video playlist
- [ ] Handles no results gracefully
- [ ] Handles short transcripts
- [ ] Response time <5 seconds

---

## Performance Considerations

1. **Token Usage**: Increased from ~500 to ~1000 max_tokens
2. **Processing Time**: +100-200ms for deduplication/grouping
3. **API Costs**: Slightly higher due to more tokens
4. **Benefits**: Much better user experience, easier video navigation

---

## Rollout Plan

1. **Phase 1**: Implement deduplication (backward compatible)
2. **Phase 2**: Update prompts and test responses
3. **Phase 3**: Update frontend to render citations
4. **Phase 4**: Monitor and tune parameters (top_k, overlap threshold)

---

## Success Metrics

- User can click timestamp and jump to exact video moment
- Answers cover multiple aspects of the question
- Answers reference multiple video timestamps
- Direct quotes make answers more credible
- Users spend less time searching for relevant parts
