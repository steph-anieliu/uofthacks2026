'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import { TranscriptionResult } from '@/types'

export function ElevenLabsTranscriptionTest() {
  const [isRecording, setIsRecording] = useState(false)
  const [result, setResult] = useState<TranscriptionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        
        // Validate audio blob has data
        if (audioBlob.size === 0) {
          setError('No audio was recorded. Please try again.')
          setIsRecording(false)
          stream.getTracks().forEach(track => track.stop())
          return
        }
        
        // Send to transcription API
        setLoading(true)
        setError('')
        setResult(null)
        
        try {
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }))
            throw new Error(errorData.error || `Transcription failed with status ${response.status}`)
          }

          const data: TranscriptionResult = await response.json()
          
          // Validate response
          if (!data.transcription) {
            throw new Error('Received empty transcription from server')
          }
          
          setResult(data)
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to transcribe audio'
          setError(errorMsg)
          console.error('Transcription error:', err)
        } finally {
          setLoading(false)
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      mediaRecorderRef.current = mediaRecorder
      setIsRecording(true)
    } catch (err) {
      setError('Failed to access microphone. Please grant permissions.')
      console.error('Media access error:', err)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const getLanguageColor = (language: string) => {
    switch (language) {
      case 'zh':
        return 'text-blue-600 bg-blue-50'
      case 'en':
        return 'text-green-600 bg-green-50'
      case 'mixed':
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getLanguageLabel = (language: string) => {
    switch (language) {
      case 'zh':
        return 'Chinese'
      case 'en':
        return 'English'
      case 'mixed':
        return 'Mixed'
      default:
        return language
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>ElevenLabs Transcription with Language Tagging</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Button
            type="button"
            variant={isRecording ? 'destructive' : 'default'}
            size="lg"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={loading}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Transcribing...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="h-5 w-5" />
                Stop Recording
              </>
            ) : (
              <>
                <Mic className="h-5 w-5" />
                Start Recording
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Full Transcription:</h3>
              <div className="p-4 bg-muted rounded-md">
                <p className="whitespace-pre-wrap">{result.transcription}</p>
              </div>
            </div>

            {result.words && result.words.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Words with Language Tags:</h3>
                <div className="flex flex-wrap gap-2">
                  {result.words.map((word, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-md text-sm font-medium ${getLanguageColor(word.language)}`}
                      title={`${word.text} - ${getLanguageLabel(word.language)}`}
                    >
                      {word.text} <span className="text-xs opacity-70">({word.language})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-semibold">Legend:</p>
              <div className="flex gap-4">
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-600">Chinese (zh)</span>
                <span className="px-2 py-1 rounded bg-green-50 text-green-600">English (en)</span>
                <span className="px-2 py-1 rounded bg-purple-50 text-purple-600">Mixed</span>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-muted-foreground">
          <p>Click "Start Recording" to record audio and test ElevenLabs transcription with language tagging.</p>
          <p>Audio is transcribed with ElevenLabs, then language tags are added by Gemini when you stop recording.</p>
        </div>
      </CardContent>
    </Card>
  )
}
