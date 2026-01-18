import { GoogleGenerativeAI } from '@google/generative-ai'
import { Word, TranslationResponse, TranscriptionResult } from '@/types'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Please add your GEMINI_API_KEY to .env.local')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

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
    
    // Use Gemini 2.5 Flash with audio input + reasoning
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            transcription: {
              type: 'string',
              description: 'The complete transcribed text from the audio'
            },
            words: {
              type: 'array',
              description: 'Array of words/phrases with language tags',
              items: {
                type: 'object',
                properties: {
                  text: {
                    type: 'string',
                    description: 'The word or phrase'
                  },
                  language: {
                    type: 'string',
                    enum: ['zh', 'en', 'fr', 'mixed'],
                    description: 'Language tag: zh (Chinese), en (English), fr (French), or mixed'
                  }
                },
                required: ['text', 'language']
              }
            }
          },
          required: ['transcription', 'words']
        }
      }
    })
    
    // Upload the audio file to Gemini
    const fileData = {
      inlineData: {
        data: audioBuffer.toString('base64'),
        mimeType: mimeType,
      },
    }
    
    // Prompt-engineered for structured JSON output with reasoning
    const prompt = `Transcribe this audio and tag each word/phrase by language (Chinese 'zh', English 'en', or French 'fr'). For mixed words/phrases, use 'mixed'. 

Analyze the audio carefully:
1. Transcribe the complete spoken text accurately
2. Identify the language of each word or phrase
3. For code-switching scenarios (mixed languages), tag appropriately
4. Group related words/phrases together when they form a single linguistic unit

Return a structured JSON response with:
- transcription: the full transcribed text
- words: array of objects, each with "text" and "language" fields

Be precise with language detection - consider context and pronunciation patterns.`
    
    const result = await model.generateContent([prompt, fileData])
    const response = await result.response
    
    // Parse the structured JSON response
    const responseText = response.text()
    let parsed: TranscriptionResult
    
    try {
      parsed = JSON.parse(responseText)
    } catch (parseError) {
      // Fallback: try to extract JSON if wrapped
      let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleanedText = jsonMatch[0]
      }
      parsed = JSON.parse(cleanedText)
    }
    
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
  targetLanguage: 'zh' | 'en' | 'fr' = 'en'
): Promise<TranslationResponse> {
  // Using gemini-2.5-flash with structured JSON output
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          translated: {
            type: 'string',
            description: 'The complete translated text'
          },
          words: {
            type: 'array',
            description: 'Array of word objects with translations and metadata',
            items: {
              type: 'object',
              properties: {
                word: { type: 'string' },
                pinyin: { type: 'string' },
                english: { type: 'string' },
                explanation: { type: 'string' },
                partOfSpeech: { type: 'string' },
                translations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      connotation: { type: 'string' },
                      translations: { type: 'array', items: { type: 'string' } },
                      partOfSpeech: { type: 'string' }
                    },
                    required: ['connotation', 'translations', 'partOfSpeech']
                  }
                }
              },
              required: ['word', 'pinyin', 'english', 'explanation']
            }
          },
          pinyin: {
            type: 'string',
            description: 'Pinyin for the entire translated sentence, or "N/A" if not applicable'
          }
        },
        required: ['translated', 'words', 'pinyin']
      }
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

  // Template for Pattern A: Non-Chinese → Chinese (extract Chinese translations with pinyin)
  const translateToChineseTemplate = (sourceLang: string) => `Given this ${sourceLang} text (may contain some Chinese): "${text}"

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
  const translateFromChineseTemplate = (targetLang: string) => `Given this Chinese text (may contain some ${targetLang}): "${text}"

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
  const translateBetweenNonChineseTemplate = (sourceLang: string, targetLang: string) => `Given this ${sourceLang} text (may contain some ${targetLang}): "${text}"

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
    ? translateToChineseTemplate(originalLangName)
    : isOriginalChinese && !isTargetChinese
    ? translateFromChineseTemplate(targetLangName)
    : !isOriginalChinese && !isTargetChinese
    ? translateBetweenNonChineseTemplate(originalLangName, targetLangName)
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
    const result = await model.generateContent(prompt)
    const response = await result.response
    const responseText = response.text()
    
    // Parse structured JSON response (should already be valid JSON with responseSchema)
    let parsed: TranslationResponse
    try {
      parsed = JSON.parse(responseText)
    } catch (parseError) {
      // Fallback: try to extract JSON if wrapped in markdown
      let cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        cleanedText = jsonMatch[0]
      }
      parsed = JSON.parse(cleanedText)
    }
    
    // Ensure all words have required fields
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
    
    return parsed
  } catch (error) {
    
    console.error('Gemini API error:', error)
    throw new Error('Failed to translate text. Please try again.')
  }
}
