import { NextRequest, NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    // Validate file size (e.g., max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (audioFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Audio file is too large. Maximum size is 10MB.' },
        { status: 400 }
      )
    }

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type })
    
    const result = await transcribeAudio(audioBlob)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Transcription error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to transcribe audio'
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
