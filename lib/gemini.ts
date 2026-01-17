import { GoogleGenerativeAI } from '@google/generative-ai'
import { Word, TranslationResponse, TranscriptionResult } from '@/types'

if (!process.env.GEMINI_API_KEY) {
  throw new Error('Please add your GEMINI_API_KEY to .env.local')
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    // Convert Blob to base64
    const arrayBuffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString('base64')
    
    // Get mime type from blob, default to webm
    const mimeType = audioBlob.type || 'audio/webm'
    
    // Use Gemini 1.5 Pro which supports audio input
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })
    
    const prompt = `Transcribe this audio and tag each word/phrase by language (Chinese 'zh' or English 'en'). 
For mixed words/phrases, use 'mixed'. Tag each word or phrase separately.

Return ONLY a valid JSON object in this exact format (no additional text, no markdown):
{
  "transcription": "the full transcription text",
  "words": [
    {"text": "word or phrase", "language": "zh"},
    {"text": "word or phrase", "language": "en"}
  ]
}

The words array should contain each word or phrase from the transcription with its language tag.`
    
    // Create audio part for Gemini
    const audioPart = {
      inlineData: {
        data: base64Audio,
        mimeType: mimeType,
      },
    }
    
    const result = await model.generateContent([prompt, audioPart])
    const response = await result.response
    const text = response.text()
    
    // Clean the response - remove markdown code blocks if present
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    
    const parsed: TranscriptionResult = JSON.parse(cleanedText)
    
    return parsed
  } catch (error) {
    console.error('Gemini audio transcription error:', error)
    throw new Error('Failed to transcribe audio. Please try again.')
  }
}

export async function translateWithCodeswitching(text: string): Promise<TranslationResponse> {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

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
