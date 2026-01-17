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

    if (!['zh', 'en'].includes(originalLanguage) || !['zh', 'en'].includes(targetLanguage)) {
      return NextResponse.json(
        { error: 'originalLanguage and targetLanguage must be "zh" or "en"' },
        { status: 400 }
      )
    }

    const result = await translateWithCodeswitching(text, originalLanguage, targetLanguage)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate' },
      { status: 500 }
    )
  }
}
