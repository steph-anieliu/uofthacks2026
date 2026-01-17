import { ElevenLabsClient } from 'elevenlabs'
import FormDataPackage from 'form-data'

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
    // Convert Blob to Buffer for Node.js FormData
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)
    
    // Use form-data package for Node.js (compatible with fetch when converted properly)
    // Create FormData with proper field names required by ElevenLabs API
    const formData = new FormDataPackage()
    
    // Required: model_id (use scribe_v1 for speech-to-text)
    formData.append('model_id', 'scribe_v1')
    
    // Required: file (must be named 'file', not 'audio')
    // Use Buffer directly with form-data package
    formData.append('file', audioBuffer, {
      filename: 'recording.webm',
      contentType: audioBlob.type || 'audio/webm',
    })
    
    const endpointUrl = 'https://api.elevenlabs.io/v1/speech-to-text'
    const headers = {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      ...formData.getHeaders(),
    }
    
    // Convert form-data to buffer for fetch
    // form-data package's FormData is a readable stream - read chunks directly instead of piping
    const formDataBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      
      // Read chunks directly from formData stream
      formData.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })
      formData.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      formData.on('error', reject)
      
      // Resume the stream to start reading (form-data streams start paused)
      formData.resume()
    })
    
    // ElevenLabs STT API endpoint
    // Buffer extends Uint8Array which is a valid BodyInit type
    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: formDataBuffer as any, // Buffer is valid BodyInit but TypeScript needs help
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { error: { message: errorText } }
      }
      console.error('ElevenLabs API error details:', errorData)
      throw new Error(errorData.error?.message || errorData.detail?.message || `ElevenLabs API error: ${response.status}`)
    }

    const data = await response.json()
    // ElevenLabs returns text in 'text' field
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
