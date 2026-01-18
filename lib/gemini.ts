import { GoogleGenerativeAI } from '@google/generative-ai'
import { Word, TranslationResponse, TranscriptionResult } from '@/types'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Please add your GEMINI_API_KEY to .env.local')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Simple in-memory cache for translations (for live/fast mode)
interface CacheEntry {
  response: TranslationResponse
  timestamp: number
}

const translationCache = new Map<string, CacheEntry>()
const CACHE_SIZE_LIMIT = 2000 // Increased cache size for better hit rate
const CACHE_TTL = 1000 * 60 * 60 // 1 hour TTL

// Helper to create cache key
function getCacheKey(text: string, originalLang: string, targetLang: string): string {
  return `${originalLang}:${targetLang}:${text.toLowerCase().trim()}`
}

// Clean old cache entries
function cleanCache() {
  const now = Date.now()
  const entries = Array.from(translationCache.entries())
  entries.forEach(([key, entry]) => {
    if (now - entry.timestamp > CACHE_TTL) {
      translationCache.delete(key)
    }
  })
  
  // If still over limit, remove oldest entries
  if (translationCache.size > CACHE_SIZE_LIMIT) {
    const sorted = entries.sort((a, b) => a[1].timestamp - b[1].timestamp)
    const toRemove = sorted.slice(0, translationCache.size - CACHE_SIZE_LIMIT)
    toRemove.forEach(([key]) => translationCache.delete(key))
  }
}

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    // Validate audio size
    if (audioBlob.size === 0) {
      throw new Error('Audio file is empty')
    }
    
    // Convert Blob to Buffer for Gemini API
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)
    
    // Determine file MIME type (Gemini supports audio/webm, audio/mp3, audio/wav, etc.)
    const mimeType = audioBlob.type || 'audio/webm'
    
    // Use Gemini 2.0 Flash Lite for both transcription and language tagging in one step
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' })
    
    // Upload the audio file to Gemini
    const fileData = {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType: mimeType,
      },
    }
    
    const prompt = `Transcribe this audio and tag each word/phrase by language (Chinese 'zh', English 'en', or French 'fr'). For mixed words/phrases, use 'mixed'. Tag each word or phrase separately.

Return ONLY a valid JSON object in this exact format (no additional text, no markdown):
{
  "transcription": "the full transcribed text",
  "words": [
    {"text": "word or phrase", "language": "zh"},
    {"text": "word or phrase", "language": "en"}
  ]
}

The words array should contain each word or phrase from the transcription with its language tag. The transcription field should be the complete transcribed text.`
    
    const result = await model.generateContent([prompt, fileData])
    const response = await result.response
    const text = response.text()
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract JSON if wrapped in other text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedText = jsonMatch[0]
    }
    
    const parsed: TranscriptionResult = JSON.parse(cleanedText)
    
    // Validate response structure
    if (!parsed.transcription || !Array.isArray(parsed.words)) {
      throw new Error('Invalid response format from Gemini API')
    }
    
    return parsed
  } catch (error) {
    console.error('Audio transcription error:', error)
    
    // Provide more specific error messages
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse transcription response. The API may have returned invalid JSON.')
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to transcribe audio: ${errorMessage}`)
  }
}

export async function translateWithCodeswitching(
  text: string,
  originalLanguage: 'zh' | 'en' | 'fr' = 'zh',
  targetLanguage: 'zh' | 'en' | 'fr' = 'en',
  options?: { fastMode?: boolean }
): Promise<TranslationResponse> {
  // Using gemini-2.0-flash-lite for translation
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-lite',
    generationConfig: {
      temperature: options?.fastMode ? 0.1 : 0.7, // Very low temperature for fastest, most deterministic responses
      topK: options?.fastMode ? 10 : 40, // Reduced for faster sampling
      topP: options?.fastMode ? 0.7 : 0.95, // Reduced for faster sampling
      maxOutputTokens: options?.fastMode ? 2048 : 2048, // Increased limit to avoid truncation
    }
  })

  const langNames: Record<string, string> = {
    zh: 'Chinese (Mandarin)',
    en: 'English',
    fr: 'French'
  }

  const originalLangName = langNames[originalLanguage] || 'Chinese (Mandarin)'
  const targetLangName = langNames[targetLanguage] || 'English'
  const isTargetChinese = targetLanguage === 'zh'
  const isOriginalChinese = originalLanguage === 'zh'
  
  // Fast mode: Check cache first (increased limit for faster caching)
  const fastMode = options?.fastMode ?? false
  if (fastMode && text.length < 300) { // Increased from 200 to cache more
    cleanCache()
    const cacheKey = getCacheKey(text, originalLanguage, targetLanguage)
    const cached = translationCache.get(cacheKey)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:145',message:'translateWithCodeswitching: cache check',data:{cacheKey,hasCached:!!cached,originalLanguage,targetLanguage,expectedDirection:`${originalLanguage}->${targetLanguage}`,cachedTranslated:cached?.response.translated?.substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
    // #endregion
    if (cached) {
      return cached.response
    }
  }
  
  // Template for Pattern A: Non-Chinese → Chinese (extract Chinese translations with pinyin)
  const translateToChineseTemplate = (sourceLang: string, fast: boolean) => fast 
    ? `Translate "${text}" to Chinese. Return COMPLETE valid JSON only: {"translated": "Chinese text", "words": [{"word": "字", "pinyin": "zì", "english": "${sourceLang} word", "explanation": "brief"}], "pinyin": "full pinyin"}. No null values, use "N/A" for missing pinyin.`
    : `Given this ${sourceLang} text (may contain some Chinese): "${text}"

Your task:
1. Identify each ${sourceLang} word/phrase that needs to be translated to Chinese
2. Translate each ${sourceLang} word/phrase to Chinese, keeping any Chinese words unchanged
3. Create a natural Chinese translation that combines everything
4. For each ${sourceLang} word that was translated to Chinese, extract the translation with:
   - The original ${sourceLang} word
   - Its part of speech (adj, noun, verb, etc.)
   - If the word can be translated in multiple ways with different connotations, provide ALL Chinese translations grouped by connotation
   - For each connotation, provide: the connotation description, the Chinese translation(s) with pinyin, and the part of speech

Return a JSON object in this exact format:
{
  "translated": "the full Chinese translation",
  "words": [
    {
      "word": "primary Chinese translation (characters)",
      "pinyin": "pinyin with tone marks",
      "english": "original ${sourceLang} word that was translated",
      "explanation": "brief context or usage explanation",
      "partOfSpeech": "adj",
      "translations": [
        {
          "connotation": "connotation description",
          "translations": ["Chinese translation 1", "Chinese translation 2"],
          "partOfSpeech": "adj"
        }
      ]
    }
  ],
  "pinyin": "pinyin for the entire translated sentence"
}

IMPORTANT: For Chinese translations in the translations array, provide the Chinese characters. The pinyin for each translation variant should be included if available, but the main pinyin field contains the pinyin for the primary translation. If a word has only ONE translation, still include it in the translations array with a single entry.
Only include translated Chinese words (that came from ${sourceLang}) in the words array. Do not include words that were already in Chinese.
Return ONLY valid JSON, no additional text.`

  // Template for Pattern B: Chinese → Non-Chinese (extract original Chinese words)
  const translateFromChineseTemplate = (targetLang: string, fast: boolean) => fast
    ? `Translate "${text}" to ${targetLang}. Return COMPLETE valid JSON only: {"translated": "${targetLang} text", "words": [{"word": "字", "pinyin": "zì", "english": "${targetLang} word", "explanation": "brief"}], "pinyin": "full pinyin"}. No null values.`
    : `Given this Chinese text (may contain some ${targetLang}): "${text}"

Your task:
1. Identify each Chinese word/phrase that needs to be translated to ${targetLang}
2. Translate each Chinese word/phrase to ${targetLang}, keeping any ${targetLang} words unchanged
3. Create a natural ${targetLang} translation that combines everything
4. Extract all Chinese words with:
   - The Chinese characters
   - Pinyin with tone marks
   - Part of speech
   - If the word can be translated in multiple ways with different connotations, provide ALL translations grouped by connotation
   - For each connotation, provide: the connotation description, the ${targetLang} translation(s), and the part of speech

Return a JSON object in this exact format:
{
  "translated": "the full ${targetLang} translation",
  "words": [
    {
      "word": "Chinese characters",
      "pinyin": "pinyin with tone marks",
      "english": "primary ${targetLang} translation",
      "explanation": "brief context or usage explanation",
      "partOfSpeech": "noun",
      "translations": [
        {
          "connotation": "connotation description",
          "translations": ["translation1", "translation2"],
          "partOfSpeech": "noun"
        }
      ]
    }
  ],
  "pinyin": "pinyin for the entire translated sentence"
}

IMPORTANT: If a word has only ONE translation, still include it in the translations array with a single entry. If a word has MULTIPLE translations with different connotations, include ALL of them.
Only include Chinese words in the words array. Do not include ${targetLang} words that were translated from Chinese.
Return ONLY valid JSON, no additional text.`

  // Template for Pattern C: Non-Chinese → Non-Chinese (extract translated words, no pinyin)
  const translateBetweenNonChineseTemplate = (sourceLang: string, targetLang: string, fast: boolean) => fast
    ? `Translate "${text}" from ${sourceLang} to ${targetLang}. Return COMPLETE valid JSON only: {"translated": "${targetLang} text", "words": [{"word": "translated", "pinyin": "N/A", "english": "${sourceLang} word", "explanation": "brief"}], "pinyin": "N/A"}. No null values.`
    : `Given this ${sourceLang} text (may contain some ${targetLang}): "${text}"

Your task:
1. Identify each ${sourceLang} word/phrase that needs to be translated to ${targetLang}
2. Translate each ${sourceLang} word/phrase to ${targetLang}, keeping any ${targetLang} words unchanged
3. Create a natural ${targetLang} translation that combines everything
4. For each ${sourceLang} word that was translated to ${targetLang}, extract it with:
   - The original ${sourceLang} word
   - Its part of speech (adj, noun, verb, etc.)
   - If the word can be translated in multiple ways with different connotations, provide ALL translations grouped by connotation
   - For each connotation, provide: the connotation description, the ${targetLang} translation(s), and the part of speech

Return a JSON object in this exact format:
{
  "translated": "the full ${targetLang} translation",
  "words": [
    {
      "word": "original ${sourceLang} word",
      "pinyin": "N/A",
      "english": "original ${sourceLang} word (same as word field)",
      "explanation": "brief context or usage explanation",
      "partOfSpeech": "adj",
      "translations": [
        {
          "connotation": "connotation description (e.g., 'full of joy', 'satisfied')",
          "translations": ["translation1", "translation2"],
          "partOfSpeech": "adj"
        }
      ]
    }
  ],
  "pinyin": "N/A"
}

IMPORTANT: If a word has only ONE translation, still include it in the translations array with a single entry. If a word has MULTIPLE translations with different connotations, include ALL of them. For example, "happy" might have:
- translations: [{"connotation": "full of joy", "translations": ["heureux", "heureuse"], "partOfSpeech": "adj"}, {"connotation": "satisfied", "translations": ["content", "contente"], "partOfSpeech": "adj"}]

Only include translated ${targetLang} words (that came from ${sourceLang}) in the words array. Do not include words that were already in ${targetLang}.
Return ONLY valid JSON, no additional text.`

  // Determine which pattern to use and generate the prompt
  const prompt = isTargetChinese && !isOriginalChinese
    ? translateToChineseTemplate(originalLangName, fastMode)
    : isOriginalChinese && !isTargetChinese
    ? translateFromChineseTemplate(targetLangName, fastMode)
    : !isOriginalChinese && !isTargetChinese
    ? translateBetweenNonChineseTemplate(originalLangName, targetLangName, fastMode)
    : `Given this mixed ${originalLangName}-${targetLangName} text: "${text}"

Your task:
1. Identify each word/phrase and determine if it's ${originalLangName} or ${targetLangName}
2. For ${targetLangName} words/phrases ONLY, translate them to ${originalLangName}. Leave ${originalLangName} words/phrases unchanged.
3. For ${originalLangName} words, provide pinyin (if ${originalLangName} is Chinese) and ${targetLangName} meaning
4. Create a natural ${originalLangName} translation that combines everything - translate ${targetLangName} parts to ${originalLangName}, keep ${originalLangName} parts as-is
5. Extract all ${originalLangName} words with their pinyin (if applicable) and ${targetLangName} translation, and a brief explanation

Return a JSON object in this exact format:
{
  "translated": "the full ${originalLangName} translation (with ${targetLangName} words translated, ${originalLangName} words unchanged)",
  "words": [
    {
      "word": "${originalLangName} word or phrase",
      "pinyin": "${isOriginalChinese ? 'pinyin with tone marks' : 'N/A'}",
      "english": "${isOriginalChinese ? targetLangName + ' translation' : 'same as word'}",
      "explanation": "brief context or usage explanation"
    }
  ],
  "pinyin": "${isOriginalChinese ? 'pinyin for the entire translated sentence' : 'N/A'}"
}

Only include ${originalLangName} words in the words array. Do not include ${targetLangName} words that were translated.
Return ONLY valid JSON, no additional text.`

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:315',message:'Before generateContent',data:{textLength:text.length,fastMode,promptLength:prompt.length,promptPreview:prompt.substring(0,150)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion

    // Generate content (streaming not available in this SDK version, but fast mode uses optimized settings)
    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text() // Renamed from 'text' to avoid shadowing function parameter
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:320',message:'Gemini response received',data:{responseLength:responseText.length,responsePreview:responseText.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,E'})}).catch(()=>{});
    // #endregion
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract JSON if response is truncated or has extra text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedText = jsonMatch[0];
      // Try to close any incomplete JSON strings/arrays/objects
      let openBraces = (cleanedText.match(/\{/g) || []).length - (cleanedText.match(/\}/g) || []).length;
      let openBrackets = (cleanedText.match(/\[/g) || []).length - (cleanedText.match(/\]/g) || []).length;
      // Fix unterminated strings
      if (cleanedText.endsWith('"') || cleanedText.match(/"\s*$/)) {
        // String might be incomplete, try to close it
        cleanedText = cleanedText.replace(/"\s*$/, '"');
      }
      // Close any open structures
      while (openBrackets > 0) {
        cleanedText += ']';
        openBrackets--;
      }
      while (openBraces > 0) {
        cleanedText += '}';
        openBraces--;
      }
    }
    
    // Replace null with "N/A" for pinyin fields before parsing
    cleanedText = cleanedText.replace(/:\s*null(?=[,\}])/g, ': "N/A"');
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:344',message:'After cleaning and fixing response',data:{cleanedLength:cleanedText.length,cleanedPreview:cleanedText.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    
    let parsed: TranslationResponse;
    try {
      parsed = JSON.parse(cleanedText);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:327',message:'JSON parse success',data:{hasTranslated:!!parsed.translated,wordsCount:parsed.words?.length||0,hasPinyin:!!parsed.pinyin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
    } catch (parseError) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:330',message:'JSON parse error',data:{error:parseError instanceof Error?parseError.message:String(parseError),cleanedText:cleanedText.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      throw parseError;
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:334',message:'Before word validation',data:{wordsCount:parsed.words?.length||0,wordsIsArray:Array.isArray(parsed.words),hasTranslated:!!parsed.translated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Ensure all words have required fields
    if (!Array.isArray(parsed.words)) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:339',message:'Words is not array',data:{wordsType:typeof parsed.words,wordsValue:parsed.words},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      parsed.words = [];
    }
    parsed.words = parsed.words.map(word => ({
      ...word,
      learnedAt: new Date(),
      reviewCount: 0,
      lastReviewed: new Date(),
      mastery: 0,
    }))
    
    // If original language is not Chinese, pinyin should be empty string
    if (originalLanguage !== 'zh' && !parsed.pinyin) {
      parsed.pinyin = ''
    }
    
    // Cache the result in fast mode
    if (fastMode && text.length < 300) {
      const cacheKey = getCacheKey(text, originalLanguage, targetLanguage)
      translationCache.set(cacheKey, {
        response: { ...parsed, words: [...parsed.words] },
        timestamp: Date.now()
      })
    }
    
    return parsed
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:355',message:'Gemini API error',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack?.substring(0,300):undefined,fastMode},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    
    console.error('Gemini API error:', error)
    throw new Error('Failed to translate text. Please try again.')
  }
}

// Streaming translation for live updates
export async function translateWithStreaming(
  text: string,
  originalLanguage: 'zh' | 'en' | 'fr' = 'zh',
  targetLanguage: 'zh' | 'en' | 'fr' = 'en',
  onChunk: (chunk: string) => void
): Promise<TranslationResponse> {
  // Using gemini-2.0-flash-lite for streaming translation
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-lite',
    generationConfig: {
      temperature: 0.1, // Low temperature for fast, deterministic responses
      topK: 10,
      topP: 0.7,
      maxOutputTokens: 2048,
    }
  })

  const langNames: Record<string, string> = {
    zh: 'Chinese (Mandarin)',
    en: 'English',
    fr: 'French'
  }

  const originalLangName = langNames[originalLanguage] || 'Chinese (Mandarin)'
  const targetLangName = langNames[targetLanguage] || 'English'
  const isTargetChinese = targetLanguage === 'zh'
  const isOriginalChinese = originalLanguage === 'zh'
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:447',message:'translateWithStreaming: language mapping',data:{originalLanguage,targetLanguage,originalLangName,targetLangName,isTargetChinese,isOriginalChinese,expectedDirection:`${originalLanguage}->${targetLanguage}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,G'})}).catch(()=>{});
  // #endregion

  // Use fast mode prompt template
  const fastPrompt = isTargetChinese && !isOriginalChinese
    ? `Translate "${text}" to Chinese. Return COMPLETE valid JSON only: {"translated": "Chinese text", "words": [{"word": "字", "pinyin": "zì", "english": "${originalLangName} word", "explanation": "brief"}], "pinyin": "full pinyin"}. No null values, use "N/A" for missing pinyin.`
    : isOriginalChinese && !isTargetChinese
    ? `Translate "${text}" to ${targetLangName}. Return COMPLETE valid JSON only: {"translated": "${targetLangName} text", "words": [{"word": "字", "pinyin": "zì", "english": "${targetLangName} word", "explanation": "brief"}], "pinyin": "full pinyin"}. No null values.`
    : !isOriginalChinese && !isTargetChinese
    ? `Translate "${text}" from ${originalLangName} to ${targetLangName}. Return COMPLETE valid JSON only: {"translated": "${targetLangName} text", "words": [{"word": "translated", "pinyin": "N/A", "english": "${originalLangName} word", "explanation": "brief"}], "pinyin": "N/A"}. No null values.`
    : `Translate "${text}" from ${originalLangName} to ${targetLangName}. Return COMPLETE valid JSON only: {"translated": "translation", "words": [{"word": "word", "pinyin": "${isOriginalChinese ? 'pinyin' : 'N/A'}", "english": "meaning", "explanation": "brief"}], "pinyin": "${isOriginalChinese ? 'full pinyin' : 'N/A'}"}. No null values.`
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:453',message:'translateWithStreaming: prompt generated',data:{promptPreview:fastPrompt.substring(0,200),promptLength:fastPrompt.length,originalLanguage,targetLanguage,originalLangName,targetLangName,expectedDirection:`${originalLanguage}->${targetLanguage}`,promptBranch:isTargetChinese&&!isOriginalChinese?'toChinese':isOriginalChinese&&!isTargetChinese?'fromChinese':!isOriginalChinese&&!isTargetChinese?'nonChineseToNonChinese':'mixed'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,D'})}).catch(()=>{});
  // #endregion

  try {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:456',message:'translateWithStreaming: entry',data:{textLength:text.length,originalLanguage,targetLanguage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
    // Try streaming if available, otherwise fall back to regular generateContent
    let responseText = ''
    
    // Check if streaming is available - try different method names
    let streamResult: any = null
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:464',message:'translateWithStreaming: checking for stream methods',data:{hasGenerateContentStream:typeof (model as any).generateContentStream==='function',hasStreamGenerateContent:typeof (model as any).streamGenerateContent==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (typeof (model as any).generateContentStream === 'function') {
      streamResult = (model as any).generateContentStream(fastPrompt)
    } else if (typeof (model as any).streamGenerateContent === 'function') {
      streamResult = (model as any).streamGenerateContent(fastPrompt)
    }
    
    if (streamResult) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:473',message:'translateWithStreaming: using streaming',data:{hasStreamProp:!!(streamResult as any).stream,hasResponseProp:!!(streamResult as any).response,isPromise:streamResult instanceof Promise},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      // generateContentStream returns an object with .stream (async iterable) and .response (promise)
      // Handle both Promise-wrapped and direct return values
      let streamObj = streamResult
      if (streamResult instanceof Promise) {
        streamObj = await streamResult
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:480',message:'translateWithStreaming: awaited promise',data:{hasStreamProp:!!(streamObj as any).stream},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
      }
      
      // Extract the stream property which is the async iterable
      const stream = (streamObj as any).stream
      if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:487',message:'translateWithStreaming: stream is not async iterable',data:{hasStream:!!stream,streamType:typeof stream,isAsyncIterable:stream && typeof stream[Symbol.asyncIterator]==='function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        throw new Error('Stream is not async iterable. Falling back to non-streaming mode.')
      }
      
      let chunkCount = 0
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:493',message:'translateWithStreaming: starting stream iteration',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
        // #endregion
        for await (const chunk of stream) {
          chunkCount++
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:497',message:'translateWithStreaming: raw chunk received',data:{chunkCount,hasText:typeof chunk.text==='function',hasTextProp:!!chunk.text,hasCandidates:!!chunk.candidates,chunkKeys:Object.keys(chunk)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
          // #endregion
          // Handle different chunk formats - chunks may have .text() method or .text property or candidates
          let chunkText = ''
          if (typeof chunk.text === 'function') {
            chunkText = chunk.text()
          } else if (chunk.text) {
            chunkText = chunk.text
          } else if (chunk.response?.text) {
            chunkText = typeof chunk.response.text === 'function' ? chunk.response.text() : chunk.response.text
          } else if (chunk.candidates?.[0]?.content?.parts?.[0]?.text) {
            chunkText = chunk.candidates[0].content.parts[0].text
          }
          
          if (chunkText) {
            responseText += chunkText
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:511',message:'translateWithStreaming: chunk processed',data:{chunkCount,chunkLength:chunkText.length,accumulatedLength:responseText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
            // #endregion
            onChunk(chunkText)
          }
        }
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:517',message:'translateWithStreaming: stream iteration completed',data:{chunkCount,totalLength:responseText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
        // #endregion
      } catch (streamError) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:521',message:'translateWithStreaming: stream loop error',data:{errorType:streamError?.constructor?.name,errorMessage:streamError instanceof Error?streamError.message:String(streamError),chunkCount,accumulatedLength:responseText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
        // #endregion
        throw streamError
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:483',message:'translateWithStreaming: stream finished',data:{chunkCount,totalLength:responseText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
      // #endregion
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:486',message:'translateWithStreaming: fallback to generateContent',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      // Fallback to regular generateContent with fast mode
      const result = await model.generateContent(fastPrompt)
      responseText = result.response.text()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:489',message:'translateWithStreaming: generateContent completed',data:{responseLength:responseText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      // Emit entire response as single chunk
      if (responseText) {
        onChunk(responseText)
      }
    }

    // Parse the accumulated response
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:554',message:'translateWithStreaming: before parsing response',data:{responseLength:responseText.length,responsePreview:responseText.substring(0,300),originalLanguage,targetLanguage,expectedDirection:`${originalLanguage}->${targetLanguage}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
    // #endregion
    let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract JSON if response is truncated or has extra text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedText = jsonMatch[0]
    }
    
    // Replace null with "N/A" for pinyin fields before parsing
    cleanedText = cleanedText.replace(/:\s*null(?=[,\}])/g, ': "N/A"')
    
    const parsed: TranslationResponse = JSON.parse(cleanedText)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:566',message:'translateWithStreaming: response parsed',data:{hasTranslated:!!parsed.translated,translatedPreview:parsed.translated?.substring(0,100),translatedLength:parsed.translated?.length,originalLanguage,targetLanguage,expectedDirection:`${originalLanguage}->${targetLanguage}`,hasWords:!!parsed.words,wordsCount:parsed.words?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
    // #endregion
    
    // Ensure all words have required fields
    if (!Array.isArray(parsed.words)) {
      parsed.words = []
    }
    parsed.words = parsed.words.map(word => ({
      ...word,
      learnedAt: new Date(),
      reviewCount: 0,
      lastReviewed: new Date(),
      mastery: 0,
    }))
    
    // If original language is not Chinese, pinyin should be empty string
    if (originalLanguage !== 'zh' && !parsed.pinyin) {
      parsed.pinyin = ''
    }
    
    parsed.enhanced = false // Mark as not enhanced (live/preliminary translation)
    
    return parsed
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'lib/gemini.ts:524',message:'translateWithStreaming: error caught',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack?.substring(0,500):undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
    console.error('Streaming translation error:', error)
    throw new Error('Failed to stream translation. Please try again.')
  }
}

// Context-aware translation with conversation history
export async function translateWithContext(
  text: string,
  originalLanguage: 'zh' | 'en' | 'fr' = 'zh',
  targetLanguage: 'zh' | 'en' | 'fr' = 'en',
  conversationHistory: Array<{ original: string; translated: string }> = []
): Promise<TranslationResponse> {
  // Using gemini-2.0-flash-lite for context-aware translation
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-lite',
    generationConfig: {
      temperature: 0.7, // Higher temperature for better context understanding
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 2048,
    }
  })

  const langNames: Record<string, string> = {
    zh: 'Chinese (Mandarin)',
    en: 'English',
    fr: 'French'
  }

  const originalLangName = langNames[originalLanguage] || 'Chinese (Mandarin)'
  const targetLangName = langNames[targetLanguage] || 'English'
  const isTargetChinese = targetLanguage === 'zh'
  const isOriginalChinese = originalLanguage === 'zh'

  // Build context from conversation history (limit to last 10 exchanges to avoid token limits)
  const recentHistory = conversationHistory.slice(-10)
  const contextSection = recentHistory.length > 0
    ? `\n\nConversation context (previous exchanges):\n${recentHistory.map((entry, idx) => 
        `${idx + 1}. Original: "${entry.original}"\n   Translated: "${entry.translated}"`
      ).join('\n')}\n`
    : ''

  // Use detailed mode prompt template with context
  const detailedPrompt = isTargetChinese && !isOriginalChinese
    ? `Given this ${originalLangName} text (may contain some Chinese): "${text}"${contextSection}

Your task:
1. Use the conversation context above to understand the meaning and ensure consistency
2. Identify each ${originalLangName} word/phrase that needs to be translated to Chinese
3. Translate each ${originalLangName} word/phrase to Chinese, keeping any Chinese words unchanged
4. Create a natural Chinese translation that combines everything and fits the conversation context
5. For each ${originalLangName} word that was translated to Chinese, extract the translation with:
   - The original ${originalLangName} word
   - Its part of speech (adj, noun, verb, etc.)
   - If the word can be translated in multiple ways with different connotations, provide ALL Chinese translations grouped by connotation
   - For each connotation, provide: the connotation description, the Chinese translation(s) with pinyin, and the part of speech

Return a JSON object in this exact format:
{
  "translated": "the full Chinese translation",
  "words": [
    {
      "word": "primary Chinese translation (characters)",
      "pinyin": "pinyin with tone marks",
      "english": "original ${originalLangName} word that was translated",
      "explanation": "brief context or usage explanation",
      "partOfSpeech": "adj",
      "translations": [
        {
          "connotation": "connotation description",
          "translations": ["Chinese translation 1", "Chinese translation 2"],
          "partOfSpeech": "adj"
        }
      ]
    }
  ],
  "pinyin": "pinyin for the entire translated sentence"
}

IMPORTANT: Consider the conversation context when choosing translations to ensure consistency. If a word has only ONE translation, still include it in the translations array with a single entry.
Only include translated Chinese words (that came from ${originalLangName}) in the words array. Do not include words that were already in Chinese.
Return ONLY valid JSON, no additional text.`
    : isOriginalChinese && !isTargetChinese
    ? `Given this Chinese text (may contain some ${targetLangName}): "${text}"${contextSection}

Your task:
1. Use the conversation context above to understand the meaning and ensure consistency
2. Identify each Chinese word/phrase that needs to be translated to ${targetLangName}
3. Translate each Chinese word/phrase to ${targetLangName}, keeping any ${targetLangName} words unchanged
4. Create a natural ${targetLangName} translation that combines everything and fits the conversation context
5. Extract all Chinese words with:
   - The Chinese characters
   - Pinyin with tone marks
   - Part of speech
   - If the word can be translated in multiple ways with different connotations, provide ALL translations grouped by connotation
   - For each connotation, provide: the connotation description, the ${targetLangName} translation(s), and the part of speech

Return a JSON object in this exact format:
{
  "translated": "the full ${targetLangName} translation",
  "words": [
    {
      "word": "Chinese characters",
      "pinyin": "pinyin with tone marks",
      "english": "primary ${targetLangName} translation",
      "explanation": "brief context or usage explanation",
      "partOfSpeech": "noun",
      "translations": [
        {
          "connotation": "connotation description",
          "translations": ["translation1", "translation2"],
          "partOfSpeech": "noun"
        }
      ]
    }
  ],
  "pinyin": "pinyin for the entire translated sentence"
}

IMPORTANT: Consider the conversation context when choosing translations. If a word has only ONE translation, still include it in the translations array with a single entry. If a word has MULTIPLE translations with different connotations, include ALL of them.
Only include Chinese words in the words array. Do not include ${targetLangName} words that were translated from Chinese.
Return ONLY valid JSON, no additional text.`
    : !isOriginalChinese && !isTargetChinese
    ? `Given this ${originalLangName} text (may contain some ${targetLangName}): "${text}"${contextSection}

Your task:
1. Use the conversation context above to understand the meaning and ensure consistency
2. Identify each ${originalLangName} word/phrase that needs to be translated to ${targetLangName}
3. Translate each ${originalLangName} word/phrase to ${targetLangName}, keeping any ${targetLangName} words unchanged
4. Create a natural ${targetLangName} translation that combines everything and fits the conversation context
5. For each ${originalLangName} word that was translated to ${targetLangName}, extract it with:
   - The original ${originalLangName} word
   - Its part of speech (adj, noun, verb, etc.)
   - If the word can be translated in multiple ways with different connotations, provide ALL translations grouped by connotation
   - For each connotation, provide: the connotation description, the ${targetLangName} translation(s), and the part of speech

Return a JSON object in this exact format:
{
  "translated": "the full ${targetLangName} translation",
  "words": [
    {
      "word": "original ${originalLangName} word",
      "pinyin": "N/A",
      "english": "original ${originalLangName} word (same as word field)",
      "explanation": "brief context or usage explanation",
      "partOfSpeech": "adj",
      "translations": [
        {
          "connotation": "connotation description (e.g., 'full of joy', 'satisfied')",
          "translations": ["translation1", "translation2"],
          "partOfSpeech": "adj"
        }
      ]
    }
  ],
  "pinyin": "N/A"
}

IMPORTANT: Consider the conversation context when choosing translations. If a word has only ONE translation, still include it in the translations array with a single entry. If a word has MULTIPLE translations with different connotations, include ALL of them.
Only include translated ${targetLangName} words (that came from ${originalLangName}) in the words array. Do not include words that were already in ${targetLangName}.
Return ONLY valid JSON, no additional text.`
    : `Given this mixed ${originalLangName}-${targetLangName} text: "${text}"${contextSection}

Your task:
1. Use the conversation context above to understand the meaning and ensure consistency
2. Identify each word/phrase and determine if it's ${originalLangName} or ${targetLangName}
3. For ${targetLangName} words/phrases ONLY, translate them to ${originalLangName}. Leave ${originalLangName} words/phrases unchanged.
4. For ${originalLangName} words, provide pinyin (if ${originalLangName} is Chinese) and ${targetLangName} meaning
5. Create a natural ${originalLangName} translation that combines everything and fits the conversation context

Return a JSON object in this exact format:
{
  "translated": "the full ${originalLangName} translation (with ${targetLangName} words translated, ${originalLangName} words unchanged)",
  "words": [
    {
      "word": "${originalLangName} word or phrase",
      "pinyin": "${isOriginalChinese ? 'pinyin with tone marks' : 'N/A'}",
      "english": "${isOriginalChinese ? targetLangName + ' translation' : 'same as word'}",
      "explanation": "brief context or usage explanation"
    }
  ],
  "pinyin": "${isOriginalChinese ? 'pinyin for the entire translated sentence' : 'N/A'}"
}

Only include ${originalLangName} words in the words array. Do not include ${targetLangName} words that were translated.
Return ONLY valid JSON, no additional text.`

  try {
    const result = await model.generateContent(detailedPrompt)
    const response = await result.response
    const responseText = response.text()
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract JSON if response is truncated or has extra text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedText = jsonMatch[0]
    }
    
    // Replace null with "N/A" for pinyin fields before parsing
    cleanedText = cleanedText.replace(/:\s*null(?=[,\}])/g, ': "N/A"')
    
    const parsed: TranslationResponse = JSON.parse(cleanedText)
    
    // Ensure all words have required fields
    if (!Array.isArray(parsed.words)) {
      parsed.words = []
    }
    parsed.words = parsed.words.map(word => ({
      ...word,
      learnedAt: new Date(),
      reviewCount: 0,
      lastReviewed: new Date(),
      mastery: 0,
    }))
    
    // If original language is not Chinese, pinyin should be empty string
    if (originalLanguage !== 'zh' && !parsed.pinyin) {
      parsed.pinyin = ''
    }
    
    parsed.enhanced = true // Mark as enhanced (context-aware translation)
    
    return parsed
  } catch (error) {
    console.error('Context-aware translation error:', error)
    throw new Error('Failed to translate with context. Please try again.')
  }
}

// Word translation interface
export interface WordTranslation {
  word: string
  translation: string
  pinyin?: string
  alternatives?: string[]
}

// Single-word translation for live word-by-word translation
export async function translateWord(
  word: string,
  originalLanguage: 'zh' | 'en' | 'fr' = 'zh',
  targetLanguage: 'zh' | 'en' | 'fr' = 'en',
  context?: string[]
): Promise<WordTranslation> {
  // Using gemini-2.0-flash-lite for single-word translation
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-lite',
    generationConfig: {
      temperature: 0.1, // Low temperature for fast, deterministic responses
      topK: 10,
      topP: 0.7,
      maxOutputTokens: 256, // Minimal tokens for single word
    }
  })

  const langNames: Record<string, string> = {
    zh: 'Chinese (Mandarin)',
    en: 'English',
    fr: 'French'
  }

  const originalLangName = langNames[originalLanguage] || 'Chinese (Mandarin)'
  const targetLangName = langNames[targetLanguage] || 'English'
  const isTargetChinese = targetLanguage === 'zh'
  const isOriginalChinese = originalLanguage === 'zh'

  // Build context string if provided
  const contextStr = context && context.length > 0 
    ? `\nContext (previous words): ${context.join(' ')}\n`
    : ''

  // Create minimal fast prompt for single-word translation
  const prompt = isTargetChinese && !isOriginalChinese
    ? `Translate the ${originalLangName} word "${word}"${contextStr}to Chinese. Return ONLY JSON: {"word": "${word}", "translation": "Chinese translation", "pinyin": "pinyin with tone marks", "alternatives": ["alt1", "alt2"]}. No null values, use empty array for alternatives if none.`
    : isOriginalChinese && !isTargetChinese
    ? `Translate the Chinese word "${word}"${contextStr}to ${targetLangName}. Return ONLY JSON: {"word": "${word}", "translation": "${targetLangName} translation", "pinyin": "pinyin", "alternatives": ["alt1", "alt2"]}. No null values.`
    : !isOriginalChinese && !isTargetChinese
    ? `Translate the ${originalLangName} word "${word}"${contextStr}to ${targetLangName}. Return ONLY JSON: {"word": "${word}", "translation": "${targetLangName} translation", "alternatives": ["alt1", "alt2"]}. No null values, no pinyin field.`
    : `Translate the word "${word}" from ${originalLangName} to ${targetLangName}${contextStr}. Return ONLY JSON: {"word": "${word}", "translation": "translation", "pinyin": "${isTargetChinese ? 'pinyin' : ''}", "alternatives": []}. No null values.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()
    
    // Clean the response - remove markdown code blocks if present
    let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    // Try to extract JSON if response is truncated or has extra text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanedText = jsonMatch[0]
    }
    
    // Replace null with empty values
    cleanedText = cleanedText.replace(/:\s*null(?=[,\}])/g, ': []')
    
    const parsed: WordTranslation = JSON.parse(cleanedText)
    
    // Validate and ensure required fields
    if (!parsed.translation) {
      parsed.translation = word // Fallback to original word
    }
    
    // Ensure pinyin is empty string if not Chinese target
    if (!isTargetChinese && parsed.pinyin) {
      parsed.pinyin = undefined
    }
    
    // Ensure alternatives is an array
    if (!Array.isArray(parsed.alternatives)) {
      parsed.alternatives = []
    }
    
    return parsed
  } catch (error) {
    console.error('Word translation error:', error)
    // Return fallback translation on error
    return {
      word,
      translation: word, // Fallback to original word
      pinyin: isTargetChinese ? '' : undefined,
      alternatives: []
    }
  }
}
