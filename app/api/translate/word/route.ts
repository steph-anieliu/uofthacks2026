import { NextRequest, NextResponse } from 'next/server'
import { translateWord } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { word, originalLanguage = 'zh', targetLanguage = 'en', context } = body

    if (!word || typeof word !== 'string') {
      return NextResponse.json(
        { error: 'Word is required' },
        { status: 400 }
      )
    }

    if (!['zh', 'en', 'fr'].includes(originalLanguage) || !['zh', 'en', 'fr'].includes(targetLanguage)) {
      return NextResponse.json(
        { error: 'originalLanguage and targetLanguage must be "zh", "en", or "fr"' },
        { status: 400 }
      )
    }

    // Validate context if provided
    const validContext = Array.isArray(context) 
      ? context.filter(item => typeof item === 'string')
      : undefined

    const result = await translateWord(
      word,
      originalLanguage,
      targetLanguage,
      validContext
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Word translation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate word' },
      { status: 500 }
    )
  }
}
