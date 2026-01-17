import { ElevenLabsClient } from 'elevenlabs'

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('Please add your ELEVENLABS_API_KEY to .env.local')
}

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
})

export async function synthesizeSpeech(text: string, voiceId: string = '21m00Tcm4TlvDq8ikWAM'): Promise<Buffer> {
  try {
    const audio = await client.textToSpeech.convert(voiceId, {
      text: text,
      model_id: 'eleven_multilingual_v2', // Supports Chinese
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    })

    // Convert the stream to a buffer
    const chunks: Uint8Array[] = []
    for await (const chunk of audio) {
      chunks.push(chunk)
    }
    
    return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)))
  } catch (error) {
    console.error('ElevenLabs API error:', error)
    throw new Error('Failed to generate speech. Please try again.')
  }
}

// Transcribe audio using ElevenLabs Speech-to-Text
export async function transcribeSpeech(audioBlob: Blob): Promise<string> {
  try {
    // Convert Blob to Buffer
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)
    
    // Create form data using global FormData (available in Node.js 18+)
    const formData = new FormData()
    const blob = new Blob([audioBuffer], { type: audioBlob.type || 'audio/webm' })
    formData.append('audio', blob, 'recording.webm')
    
    // ElevenLabs STT API endpoint
    const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: { message: errorText } }
      }
      throw new Error(errorData.error?.message || `ElevenLabs API error: ${response.status}`)
    }

    const data = await response.json()
    return data.text || ''
  } catch (error) {
    console.error('ElevenLabs transcription error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to transcribe audio with ElevenLabs: ${errorMessage}`)
  }
}

// Get available voices (optional helper function)
export async function getVoices() {
  try {
    const voices = await client.voices.getAll()
    return voices
  } catch (error) {
    console.error('Error fetching voices:', error)
    return []
  }
}
