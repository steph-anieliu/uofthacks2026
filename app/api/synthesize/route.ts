import { NextRequest, NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/elevenlabs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text } = body

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    const audioBuffer = await synthesizeSpeech(text)
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Synthesis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to synthesize speech' },
      { status: 500 }
    )
  }
}
