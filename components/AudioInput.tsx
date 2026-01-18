'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Loader2 } from 'lucide-react'

interface AudioInputProps {
  onTranscript: (text: string) => void
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void
  disabled?: boolean
  originalLanguage?: 'zh' | 'en' | 'fr'
  targetLanguage?: 'zh' | 'en' | 'fr'
}

export function AudioInput({ 
  onTranscript, 
  onTranscriptUpdate,
  disabled = false,
  originalLanguage = 'en',
  targetLanguage = 'fr'
}: AudioInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const accumulatedTranscriptRef = useRef<string>('')
  const onTranscriptRef = useRef(onTranscript)
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate)
  const currentChunkRef = useRef<Blob[]>([])
  const chunkStartTimeRef = useRef<number>(0)

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onTranscriptUpdateRef.current = onTranscriptUpdate
  }, [onTranscript, onTranscriptUpdate])

  const processAudioChunk = async (audioBlob: Blob) => {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioInput.tsx:39',message:'processAudioChunk entry',data:{chunkSize:audioBlob.size,chunkType:audioBlob.type,chunksCount:currentChunkRef.current.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      const formData = new FormData()
      formData.append('audio', audioBlob, 'chunk.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioInput.tsx:49',message:'transcription API failed',data:{status:response.status,statusText:response.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        throw new Error('Transcription failed')
      }

      const result = await response.json()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioInput.tsx:53',message:'received transcription result',data:{transcription:result.transcription,hasTranscription:!!result.transcription,words:result.words},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      
      if (result.transcription) {
        // Accumulate transcriptions
        accumulatedTranscriptRef.current += ' ' + result.transcription
        const combinedText = accumulatedTranscriptRef.current.trim()
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioInput.tsx:57',message:'updating UI with transcription',data:{newTranscription:result.transcription,accumulated:combinedText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
        // #endregion
        
        // Update UI in real-time
        if (onTranscriptUpdateRef.current) {
          onTranscriptUpdateRef.current(combinedText, false) // false = interim result
        }
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioInput.tsx:65',message:'error in processAudioChunk',data:{error:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.error('Error transcribing audio chunk:', error)
    }
  }

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
      accumulatedTranscriptRef.current = ''
      currentChunkRef.current = []
      chunkStartTimeRef.current = Date.now()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          currentChunkRef.current.push(event.data)
        }
      }

      // Process chunks periodically for real-time transcription with Gemini 2.5 Flash
      chunkIntervalRef.current = setInterval(async () => {
        if (currentChunkRef.current.length > 0 && mediaRecorderRef.current?.state === 'recording') {
          const chunkBlob = new Blob(currentChunkRef.current, { 
            type: mediaRecorder.mimeType || 'audio/webm' 
          })
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AudioInput.tsx:92',message:'interval processing chunk',data:{chunkBlobSize:chunkBlob.size,chunksCount:currentChunkRef.current.length,recorderState:mediaRecorderRef.current?.state},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          
          // Process chunk asynchronously (don't await to keep recording)
          processAudioChunk(chunkBlob).catch(err => 
            console.error('Error processing chunk:', err)
          )
          
          // Reset for next chunk
          currentChunkRef.current = []
          chunkStartTimeRef.current = Date.now()
        }
      }, 3000) // Process every 3 seconds for real-time updates

      mediaRecorder.onstop = async () => {
        // Clear interval
        if (chunkIntervalRef.current) {
          clearInterval(chunkIntervalRef.current)
          chunkIntervalRef.current = null
        }

        // Process final chunk if any
        if (currentChunkRef.current.length > 0) {
          setIsProcessing(true)
          try {
            const finalChunkBlob = new Blob(currentChunkRef.current, { 
              type: mediaRecorder.mimeType || 'audio/webm' 
            })
            await processAudioChunk(finalChunkBlob)
            
            // Send final transcription
            const finalText = accumulatedTranscriptRef.current.trim()
            if (finalText && onTranscriptRef.current) {
              if (onTranscriptUpdateRef.current) {
                onTranscriptUpdateRef.current(finalText, true) // true = final result
              }
              onTranscriptRef.current(finalText)
            }
          } catch (error) {
            console.error('Error processing final chunk:', error)
          } finally {
            setIsProcessing(false)
          }
        }

        // Stop all tracks in the stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
          streamRef.current = null
        }
      }

      // Start recording with timeslice for periodic chunks
      mediaRecorder.start(1000) // Get data every 1 second
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
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current)
      chunkIntervalRef.current = null
    }
  }

  const toggleListening = () => {
    if (isListening) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

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
