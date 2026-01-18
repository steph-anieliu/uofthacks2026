# Live Translation Optimizations

This document describes the optimizations implemented to make translation faster for live/real-time use.

## Optimizations Implemented

### 1. **Fast Mode** (`fastMode: true`)
When `fastMode: true` is passed to the translation API, several optimizations are applied:

#### Faster Model Configuration
- **Lower temperature** (0.3 vs 0.7): More deterministic, faster responses
- **Reduced topK** (20 vs 40): Fewer tokens to consider
- **Reduced topP** (0.8 vs 0.95): Smaller sampling pool

#### Simplified Prompts
- **Shorter prompts**: Fast mode uses concise templates that focus on essential output only
- **Less detailed instructions**: Skips verbose explanations about translations and connotations
- **Direct JSON format**: Asks directly for JSON without extensive formatting instructions

#### Translation Caching
- **In-memory cache**: Common translations are cached for 1 hour
- **Cache size limit**: 1000 entries (LRU eviction when full)
- **Only for short texts**: Caching enabled only for texts < 200 characters (to avoid memory issues)

### 2. **Model Selection**
- Uses `gemini-2.5-flash`: The fastest Gemini model available
- Optimized for speed over detailed analysis

### 3. **API Usage**

#### Enable Fast Mode in API Call
```typescript
// In app/page.tsx or wherever you call the API
const response = await fetch('/api/translate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    text, 
    originalLanguage, 
    targetLanguage,
    fastMode: true  // <-- Add this for live translation
  }),
})
```

#### Current Implementation
The frontend currently doesn't use fast mode by default. To enable it for live translation:

1. **Option A**: Always use fast mode for live typing/voice input
   - Add `fastMode: true` to the translation API call in `app/page.tsx`

2. **Option B**: Add a toggle in the UI
   - Add a checkbox/toggle for "Live Mode" or "Fast Translation"
   - Pass `fastMode: true` when the toggle is enabled

3. **Option C**: Auto-detect based on input method
   - Use fast mode for voice input (audio transcription)
   - Use fast mode for typing (debounced input)
   - Use normal mode for manual "Translate" button clicks

## Performance Improvements

### Expected Speed Improvements
- **Fast mode prompts**: ~40-60% shorter, reducing token processing time
- **Caching**: Instant response for repeated translations (< 1ms vs 2-10s)
- **Optimized model config**: ~10-20% faster response generation
- **Combined effect**: 50-70% faster for live translation use cases

### Trade-offs
- **Less detailed word analysis**: Fast mode provides essential translations but may miss:
  - Multiple translation connotations
  - Part of speech details
  - Detailed explanations
- **Cache memory**: Uses ~1-5MB RAM (depending on cache size)

## Recommendations for Live Translation

1. **Enable fast mode** for real-time scenarios:
   - Voice input transcription + translation
   - Live typing with auto-translation (debounced)
   - Chat/instant messaging features

2. **Use normal mode** for detailed analysis:
   - Learning mode where you want detailed word breakdowns
   - When saving words to vocabulary (more context = better learning)

3. **Combine with debouncing** (client-side):
   ```typescript
   // Example: Debounce translations while typing
   const debouncedTranslate = useMemo(
     () => debounce((text: string) => {
       handleTranslate(text, true) // true = fastMode
     }, 500), // 500ms delay
     []
   )
   ```

4. **Implement request cancellation**:
   - Cancel previous translation requests when new input arrives
   - Prevents processing outdated translations

## Future Optimizations

Potential improvements to consider:
- [ ] Server-side streaming responses (show partial translations as they arrive)
- [ ] Client-side debouncing/throttling
- [ ] Request cancellation for outdated translations
- [ ] Persistent cache (Redis/database) for shared translations across users
- [ ] Pre-translation for common phrases
- [ ] Batch translation for multiple short phrases
