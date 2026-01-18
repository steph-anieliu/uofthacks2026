'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff, Play, Trash2 } from 'lucide-react'

interface AudioInputProps {
  onTranscript: (text: string) => void
  onTranscriptUpdate?: (text: string, isFinal: boolean) => void
  onWordUpdate?: (words: Array<{text: string, isFinal: boolean, index: number}>) => void
  disabled?: boolean
  originalLanguage?: 'zh' | 'en' | 'fr'
  targetLanguage?: 'zh' | 'en' | 'fr'
}

export function AudioInput({ onTranscript, onTranscriptUpdate, onWordUpdate, disabled = false, originalLanguage = 'zh', targetLanguage = 'en' }: AudioInputProps) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const isListeningRef = useRef(false) // Track listening state separately for onend handler
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioStreamRef = useRef<MediaStream | null>(null)
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null)
  const shouldStartRecordingRef = useRef(false) // Flag to start MediaRecorder after SpeechRecognition confirms audio
  const hasReceivedAudioRef = useRef(false) // Track if we've received audio from SpeechRecognition
  const onTranscriptRef = useRef(onTranscript)
  const onTranscriptUpdateRef = useRef(onTranscriptUpdate)
  const onWordUpdateRef = useRef(onWordUpdate)

  // Keep refs updated with latest callbacks without triggering useEffect
  useEffect(() => {
    onTranscriptRef.current = onTranscript
    onTranscriptUpdateRef.current = onTranscriptUpdate
    onWordUpdateRef.current = onWordUpdate
  }, [onTranscript, onTranscriptUpdate, onWordUpdate])

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:20',message:'useEffect: checking SpeechRecognition support',data:{hasWindow:typeof window!=='undefined'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    // Check if browser supports Web Speech API
    const SpeechRecognitionClass = 
      (typeof window !== 'undefined' && window.SpeechRecognition) || 
      (typeof window !== 'undefined' && (window as any).webkitSpeechRecognition)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:26',message:'SpeechRecognition class check',data:{hasSpeechRecognition:!!(typeof window!=='undefined'&&window.SpeechRecognition),hasWebkit:!!(typeof window!=='undefined'&&(window as any).webkitSpeechRecognition),hasClass:!!SpeechRecognitionClass},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    if (SpeechRecognitionClass) {
      setIsSupported(true)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:29',message:'Creating SpeechRecognition instance',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      const recognition = new SpeechRecognitionClass()
      recognition.continuous = true
      recognition.interimResults = true
      // Map originalLanguage to BCP 47 language codes for Speech Recognition API
      const langMap: Record<string, string> = {
        'zh': 'zh-CN',
        'en': 'en-US',
        'fr': 'fr-FR'
      }
      const recognitionLang = langMap[originalLanguage] || 'en-US'
      recognition.lang = recognitionLang
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:66',message:'Recognition configured with language',data:{continuous:recognition.continuous,interimResults:recognition.interimResults,lang:recognition.lang,langProperty:recognition.lang,originalLanguage,targetLanguage,recognitionLang,langMap},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:35',message:'onresult: transcription event received',data:{resultsLength:event.results.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        let interimTranscript = ''
        let finalTranscript = ''
        const words: Array<{text: string, isFinal: boolean, index: number}> = []
        
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const transcript = result[0]?.transcript || ''
          const isFinal = result.isFinal
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:44',message:'onresult: processing result',data:{index:i,transcript,transcriptLength:transcript.length,isFinal,resultLength:result.length,hasResult0:!!result[0]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          
          // Check if we received actual audio (non-empty transcript) and should start MediaRecorder
          if (transcript.length > 0 && !hasReceivedAudioRef.current) {
            hasReceivedAudioRef.current = true
            // Start MediaRecorder after confirming SpeechRecognition has audio
            if (shouldStartRecordingRef.current && !mediaRecorderRef.current) {
              startRecording().catch(err => console.error('Failed to start MediaRecorder:', err))
            }
          }
          
          if (isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
          
          // Extract individual words from this result
          const wordsInResult = transcript.split(/\s+/).filter(w => w.trim())
          wordsInResult.forEach((word, wordIdx) => {
            // Clean word of punctuation for better tracking
            const cleanWord = word.trim().replace(/^[^\w\u4e00-\u9fff]+|[^\w\u4e00-\u9fff]+$/g, '')
            if (cleanWord) {
              words.push({
                text: cleanWord,
                isFinal: isFinal,
                index: i
              })
            }
          })
        }
        
        const combinedText = (finalTranscript + interimTranscript).trim()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:93',message:'onresult: processed transcript',data:{combinedText,combinedTextLength:combinedText.length,finalTranscript,finalTranscriptLength:finalTranscript.length,interimTranscript,interimTranscriptLength:interimTranscript.length,wordsCount:words.length,hasOnWordUpdate:!!onWordUpdateRef.current,hasOnTranscriptUpdate:!!onTranscriptUpdateRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        
        // Call word update callback if provided (use ref to get latest callback)
        if (onWordUpdateRef.current && words.length > 0) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:101',message:'Calling onWordUpdate callback',data:{wordsCount:words.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          onWordUpdateRef.current(words)
        }
        
        // Always call update callback for both interim and final results
        // This allows live translation updates (use ref to get latest callback)
        if (onTranscriptUpdateRef.current && combinedText) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:108',message:'Calling onTranscriptUpdate callback',data:{combinedText,isFinal:finalTranscript.length>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          onTranscriptUpdateRef.current(combinedText, finalTranscript.length > 0)
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:113',message:'Skipping onTranscriptUpdate callback',data:{hasCallback:!!onTranscriptUpdateRef.current,hasCombinedText:!!combinedText,combinedTextLength:combinedText.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
        }
        
        // Call original callback only for final results
        // Note: This won't stop recognition because continuous = true (use ref to get latest callback)
        if (finalTranscript.trim()) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:121',message:'Calling onTranscript callback',data:{finalTranscript:finalTranscript.trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          onTranscriptRef.current(finalTranscript.trim())
        }
      }

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:87',message:'onerror: recognition error',data:{error:event.error,message:event.message,isListening:isListeningRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4,H5'})}).catch(()=>{});
        // #endregion
        
        // Don't stop on all errors - some are recoverable
        // 'no-speech' and 'audio-capture' errors might be temporary
        if (event.error === 'no-speech' || event.error === 'audio-capture') {
          // Keep trying - recognition will continue
          return
        }
        
        // Stop only on unrecoverable errors
        if (event.error === 'aborted' || event.error === 'not-allowed' || event.error === 'network') {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:95',message:'onerror: stopping recognition due to unrecoverable error',data:{error:event.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4,H5'})}).catch(()=>{});
          // #endregion
          isListeningRef.current = false
          setIsListening(false)
        }
      }

      recognition.onend = () => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:104',message:'onend: recognition ended',data:{isListeningRef:isListeningRef.current,hasRecognitionRef:!!recognitionRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        // #endregion
        // If we're still supposed to be listening, restart recognition
        // This handles cases where recognition stops unexpectedly (common in continuous mode)
        if (isListeningRef.current && recognitionRef.current) {
          try {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:107',message:'onend: attempting restart',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
            // #endregion
            recognitionRef.current.start()
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:109',message:'onend: restart successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
            // #endregion
          } catch (error) {
            // Recognition might already be starting, ignore InvalidStateError
            const errorName = error instanceof DOMException ? error.name : 'Unknown'
            const isInvalidState = error instanceof DOMException && error.name === 'InvalidStateError'
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:114',message:'onend: restart error',data:{errorName,isInvalidState,errorMessage:error instanceof Error?error.message:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
            // #endregion
            if (error instanceof DOMException && error.name !== 'InvalidStateError') {
              console.error('Error restarting recognition:', error)
            }
            // If we can't restart, mark as not listening
            setIsListening(false)
            isListeningRef.current = false
          }
        } else {
          setIsListening(false)
          isListeningRef.current = false
        }
      }

      recognitionRef.current = recognition
    }

    return () => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:215',message:'Cleanup: stopping recognition',data:{hasRecognitionRef:!!recognitionRef.current,isListeningRef:isListeningRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop()
        } catch (e) {
          // Ignore errors when stopping
        }
      }
      // Reset listening state
      isListeningRef.current = false
      setIsListening(false)
    }
  }, [originalLanguage, targetLanguage]) // Recreate recognition when languages change

  const startRecording = async () => {
    try {
      // Get user media stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioStreamRef.current = stream

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

      mediaRecorder.onstop = () => {
        // Create blob from recorded chunks
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm' 
        })
        const audioUrl = URL.createObjectURL(audioBlob)
        setRecordedAudio(audioUrl)

        // Stop all tracks in the stream
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach(track => track.stop())
          audioStreamRef.current = null
        }
      }

      mediaRecorder.start()
    } catch (error) {
      console.error('Error starting audio recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const toggleListening = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:137',message:'toggleListening called',data:{isListening,hasRecognitionRef:!!recognitionRef.current,disabled},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
    // #endregion
    if (!recognitionRef.current) return

    if (isListening) {
      // Stop listening - set ref first to prevent auto-restart
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:141',message:'toggleListening: stopping',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      isListeningRef.current = false
      shouldStartRecordingRef.current = false
      recognitionRef.current.stop()
      stopRecording()
      setIsListening(false)
    } else {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:147',message:'toggleListening: starting recognition',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        // Reset flags
        hasReceivedAudioRef.current = false
        shouldStartRecordingRef.current = true
        
        // Start speech recognition FIRST to let it get microphone access
        // MediaRecorder will start AFTER we confirm SpeechRecognition is receiving audio
        isListeningRef.current = true
        recognitionRef.current.start()
        setIsListening(true)
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:151',message:'toggleListening: start successful',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
      } catch (error) {
        console.error('Error starting speech recognition:', error)
        const errorName = error instanceof DOMException ? error.name : 'Unknown'
        const errorMessage = error instanceof Error ? error.message : 'unknown'
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/AudioInput.tsx:156',message:'toggleListening: start error',data:{errorName,errorMessage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5,H6'})}).catch(()=>{});
        // #endregion
        isListeningRef.current = false
        setIsListening(false)
        stopRecording()
      }
    }
  }

  const playRecording = () => {
    if (!recordedAudio) return

    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current.currentTime = 0
    }

    const audio = new Audio(recordedAudio)
    audioPlayerRef.current = audio
    setIsPlaying(true)

    audio.onended = () => {
      setIsPlaying(false)
      audioPlayerRef.current = null
    }

    audio.onerror = () => {
      setIsPlaying(false)
      audioPlayerRef.current = null
    }

    audio.play()
  }

  const clearRecording = () => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause()
      audioPlayerRef.current = null
    }
    if (recordedAudio) {
      URL.revokeObjectURL(recordedAudio)
      setRecordedAudio(null)
    }
    setIsPlaying(false)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      if (recordedAudio) {
        URL.revokeObjectURL(recordedAudio)
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause()
      }
    }
  }, [recordedAudio])

  if (!isSupported) {
    return (
      <div className="text-sm text-muted-foreground">
        Speech recognition is not supported in your browser. Please use Chrome or Edge.
      </div>
    )
  }

  return (
    <div className="flex gap-2 items-center">
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
      {recordedAudio && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={playRecording}
            disabled={isPlaying || disabled}
            className="gap-2"
          >
            <Play className="h-5 w-5" />
            {isPlaying ? 'Playing...' : 'Play Recording'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={clearRecording}
            disabled={disabled}
            className="gap-2"
            title="Clear recording"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  )
}

