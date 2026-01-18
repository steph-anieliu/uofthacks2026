import { NextRequest, NextResponse } from 'next/server'
import { translateWithContext } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, originalLanguage = 'zh', targetLanguage = 'en', conversationHistory = [] } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    if (!['zh', 'en', 'fr'].includes(originalLanguage) || !['zh', 'en', 'fr'].includes(targetLanguage)) {
      return NextResponse.json(
        { error: 'originalLanguage and targetLanguage must be "zh", "en", or "fr"' },
        { status: 400 }
      )
    }

    // Validate conversation history format
    const validHistory = Array.isArray(conversationHistory)
      ? conversationHistory.filter(entry => 
          entry && 
          typeof entry.original === 'string' && 
          typeof entry.translated === 'string'
        )
      : []

    const result = await translateWithContext(
      text,
      originalLanguage,
      targetLanguage,
      validHistory
    )
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Context-aware translation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate with context' },
      { status: 500 }
    )
  }
}
