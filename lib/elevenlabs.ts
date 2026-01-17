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
