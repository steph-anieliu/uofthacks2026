import { GoogleGenerativeAI } from '@google/generative-ai'
import { Word, TranslationResponse, TranscriptionResult } from '@/types'
import { transcribeSpeech } from '@/lib/elevenlabs'

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
    
    // Step 1: Use ElevenLabs for speech-to-text transcription
    const transcription = await transcribeSpeech(audioBlob)
    
    if (!transcription || !transcription.trim()) {
      throw new Error('Empty transcription received from ElevenLabs')
    }
    
    // Step 2: Use Gemini to tag words/phrases by language
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Given this transcribed text: "${transcription}"

Tag each word/phrase by language (Chinese 'zh' or English 'en'). For mixed words/phrases, use 'mixed'. Tag each word or phrase separately.

Return ONLY a valid JSON object in this exact format (no additional text, no markdown):
{
  "transcription": "${transcription}",
  "words": [
    {"text": "word or phrase", "language": "zh"},
    {"text": "word or phrase", "language": "en"}
  ]
}

The words array should contain each word or phrase from the transcription with its language tag. The transcription field should be the original transcribed text.`
    
    const result = await model.generateContent(prompt)
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
    
    // Ensure transcription matches what we got from ElevenLabs
    parsed.transcription = transcription
    
    // Validate response structure
    if (!parsed.transcription || !Array.isArray(parsed.words)) {
      throw new Error('Invalid response format from Gemini API')
    }
    
    return parsed
  } catch (error) {
    console.error('Audio transcription error:', error)
    
    // Provide more specific error messages
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse language tagging response. The API may have returned invalid JSON.')
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to transcribe audio: ${errorMessage}`)
  }
}

export async function translateWithCodeswitching(
  text: string,
  originalLanguage: 'zh' | 'en' = 'zh',
  targetLanguage: 'zh' | 'en' = 'en'
): Promise<TranslationResponse> {
  // Using gemini-2.5-flash (gemini-2.5-pro not available on free tier)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const originalLangName = originalLanguage === 'zh' ? 'Chinese' : 'English'
  const targetLangName = targetLanguage === 'zh' ? 'Chinese' : 'English'
  const preserveLangName = originalLanguage === 'zh' ? 'Chinese' : 'English'
  const translateLangName = originalLanguage === 'zh' ? 'English' : 'Chinese'

  const prompt = originalLanguage === 'en' && targetLanguage === 'zh'
    ? `Given this English text (may contain some Chinese): "${text}"

Your task:
1. Identify each English word/phrase that needs to be translated to Chinese
2. Translate each English word/phrase to Chinese, keeping any Chinese words unchanged
3. Create a natural Chinese translation that combines everything
4. For each English word that was translated to Chinese, extract the translation with:
   - The Chinese characters (translation)
   - Pinyin with tone marks
   - The original English word
   - A brief context/explanation of usage

Return a JSON object in this exact format:
{
  "translated": "the full Chinese translation",
  "words": [
    {
      "word": "Chinese characters (the translation)",
      "pinyin": "pinyin with tone marks",
      "english": "original English word that was translated",
      "explanation": "brief context or usage explanation"
    }
  ],
  "pinyin": "pinyin for the entire translated sentence"
}

Only include translated Chinese words (that came from English) in the words array. Do not include words that were already in Chinese.
Return ONLY valid JSON, no additional text.`
    : `Given this mixed ${originalLangName}-${translateLangName} text: "${text}"

Your task:
1. Identify each word/phrase and determine if it's ${preserveLangName} or ${translateLangName}
2. For ${translateLangName} words/phrases ONLY, translate them to ${targetLangName}. Leave ${preserveLangName} words/phrases unchanged.
3. For ${preserveLangName} words, provide pinyin (if ${preserveLangName} is Chinese) and ${translateLangName} meaning
4. Create a natural ${targetLangName} translation that combines everything - translate ${translateLangName} parts to ${targetLangName}, keep ${preserveLangName} parts as-is
5. Extract all ${preserveLangName} words with their pinyin (if applicable) and ${translateLangName} translation, and a brief explanation

Return a JSON object in this exact format:
{
  "translated": "the full ${targetLangName} translation (with ${translateLangName} words translated, ${preserveLangName} words unchanged)",
  "words": [
    {
      "word": "${preserveLangName} word or phrase",
      "pinyin": "${originalLanguage === 'zh' ? 'pinyin with tone marks' : 'N/A'}",
      "english": "${originalLanguage === 'zh' ? 'English translation' : 'same as word'}",
      "explanation": "brief context or usage explanation"
    }
  ],
  "pinyin": "${originalLanguage === 'zh' ? 'pinyin for the entire translated sentence' : 'N/A'}"
}

Only include ${preserveLangName} words in the words array. Do not include ${translateLangName} words that were translated.
Return ONLY valid JSON, no additional text.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()
    
    // Clean the response - remove markdown code blocks if present
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    const parsed: TranslationResponse = JSON.parse(cleanedText)
    
    // Ensure all words have required fields
    parsed.words = parsed.words.map(word => ({
      ...word,
      learnedAt: new Date(),
      reviewCount: 0,
      lastReviewed: new Date(),
      mastery: 0,
    }))
    
    // If original language is English, pinyin should be empty string or not included
    if (originalLanguage === 'en' && !parsed.pinyin) {
      parsed.pinyin = ''
    }
    
    return parsed
  } catch (error) {
    
    console.error('Gemini API error:', error)
    throw new Error('Failed to translate text. Please try again.')
  }
}
