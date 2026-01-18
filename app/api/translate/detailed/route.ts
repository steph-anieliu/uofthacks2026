import { NextRequest, NextResponse } from 'next/server'
import { translateWithCodeswitching } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, originalLanguage = 'zh', targetLanguage = 'en' } = body

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

    // Use detailed mode (fastMode: false) to get full connotations and part of speech
    const result = await translateWithCodeswitching(text, originalLanguage, targetLanguage, { fastMode: false })
    
    // Mark as enhanced
    result.enhanced = true
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Detailed translation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate with details' },
      { status: 500 }
    )
  }
}
