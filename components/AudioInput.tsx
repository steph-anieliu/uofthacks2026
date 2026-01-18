'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface AudioInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function AudioInput({ onTranscript, disabled = false }: AudioInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async () => {
    try {
      // Get user media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsProcessing(true)
        
        try {
          // Create blob from recorded chunks
          const audioBlob = new Blob(audioChunksRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
          })

          // Send to transcription API
          const formData = new FormData()
          formData.append('audio', audioBlob, 'recording.webm')

          const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            throw new Error('Transcription failed')
          }

          const result = await response.json()
          
          // Call callback with transcription
          if (result.transcription) {
            onTranscript(result.transcription)
          }
        } catch (error) {
          console.error('Error processing audio:', error)
          alert('Failed to transcribe audio. Please try again.')
        } finally {
          setIsProcessing(false)
          
          // Stop all tracks in the stream
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
            streamRef.current = null
          }
        }
      }

      mediaRecorder.start()
      setIsListening(true)
    } catch (error) {
      console.error('Error starting audio recording:', error)
      alert('Failed to access microphone. Please check permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsListening(false)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  return (
    <Button
      type="button"
      variant={isListening ? 'destructive' : 'default'}
      size="lg"
      onClick={toggleListening}
      disabled={disabled || isProcessing}
      className="gap-2"
    >
      {isProcessing ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Processing...
        </>
      ) : isListening ? (
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
  )
}

