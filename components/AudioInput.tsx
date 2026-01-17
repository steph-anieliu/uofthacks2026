'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'

interface AudioInputProps {
  onTranscript: (text: string) => void
  disabled?: boolean
}

export function AudioInput({ onTranscript, disabled = false }: AudioInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognitionClass = 
      (typeof window !== 'undefined' && window.SpeechRecognition) || 
      (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition)
    
    if (SpeechRecognitionClass) {
      setIsSupported(true)
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'zh-CN,en-US' // Support both Chinese and English

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript
        onTranscript(transcript)
        setIsListening(false)
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [onTranscript])

  const toggleListening = () => {
    if (!recognitionRef.current) return

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
    } else {
      try {
        recognitionRef.current.start()
        setIsListening(true)
      } catch (error) {
        console.error('Error starting speech recognition:', error)
      }
    }
  }

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Speech recognition is not supported in your browser. Please use Chrome or Edge.
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant={isListening ? 'destructive' : 'default'}
      size="lg"
      onClick={toggleListening}
      disabled={disabled}
      className="gap-2"
    >
      {isListening ? (
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

