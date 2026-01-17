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

export async function translateWithCodeswitching(text: string): Promise<TranslationResponse> {
  // Using gemini-2.5-flash (gemini-2.5-pro not available on free tier)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `Given this mixed Chinese-English text: "${text}"

Your task:
1. Identify each word/phrase and determine if it's Chinese or English
2. For English words/phrases, translate them to Chinese
3. For Chinese words, provide pinyin and English meaning
4. Create a natural Chinese translation that combines everything
5. Extract all Chinese words with their pinyin, English translation, and a brief explanation

Return a JSON object in this exact format:
{
  "translated": "the full Chinese translation",
  "words": [
    {
      "word": "Chinese word or phrase",
      "pinyin": "pinyin with tone marks",
      "english": "English translation",
      "explanation": "brief context or usage explanation"
    }
  ],
  "pinyin": "pinyin for the entire translated sentence"
}

Only include Chinese words in the words array. Do not include English words that were translated.
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
    
    return parsed
  } catch (error) {
    
    console.error('Gemini API error:', error)
    throw new Error('Failed to translate text. Please try again.')
  }
}
