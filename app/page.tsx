'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AudioInput } from '@/components/AudioInput'
import { TranslationDisplay } from '@/components/TranslationDisplay'
import { LiveWordDisplay } from '@/components/LiveWordDisplay'
import { TranslationResponse, Word } from '@/types'
import { Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface ConversationEntry {
  original: string
  translated: string
  timestamp: Date
  words?: Word[]
}

interface LiveWord {
  original: string
  translation: {
    translation: string
    pinyin?: string
    alternatives?: string[]
  } | null
  isFinal: boolean
  timestamp: number
  isTranslating?: boolean
}

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [translation, setTranslation] = useState<TranslationResponse | null>(null)
  const [liveTranslation, setLiveTranslation] = useState<TranslationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [enhancingDetails, setEnhancingDetails] = useState(false)
  const [saving, setSaving] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [originalLanguage, setOriginalLanguage] = useState<'zh' | 'en' | 'fr'>('zh')
  const [targetLanguage, setTargetLanguage] = useState<'zh' | 'en' | 'fr'>('en')
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [liveWords, setLiveWords] = useState<LiveWord[]>([])
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const processedWordsRef = useRef<Set<string>>(new Set()) // Track processed words by original text + index to avoid duplicates

  // Debounced handler for interim translations
  const handleInterimTranslation = useCallback(async (text: string) => {
    if (!text.trim()) return

    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Debounce: wait 300ms before making request
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setIsStreaming(true)
        setLiveTranslation(null)

        // Use live streaming translation endpoint
        const response = await fetch('/api/translate/live', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, originalLanguage, targetLanguage }),
        })

        if (!response.ok) {
          throw new Error('Live translation failed')
        }

        // Process streaming response (SSE format)
        const reader = response.body?.getReader()
        const decoder = new TextDecoder()

        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  
                  // Handle partial chunks (for visual feedback if needed)
                  if (data.chunk && data.type === 'partial') {
                    // Could show loading state or partial text here
                  }
                  
                  // Handle final complete result
                  if (data.done && data.type === 'complete' && data.result) {
                    const parsed = data.result
                    if (parsed.translated) {
                      setLiveTranslation({
                        ...parsed,
                        enhanced: false,
                      })
                    }
                  }
                } catch (e) {
                  // Ignore parse errors for individual chunks
                  console.warn('Failed to parse SSE data:', e)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Interim translation error:', error)
        // Graceful degradation: don't show error for interim results
      } finally {
        setIsStreaming(false)
      }
    }, 300) // 300ms debounce
  }, [originalLanguage, targetLanguage])

  // Handler for final translation with context
  const handleFinalTranslation = useCallback(async (text: string) => {
    if (!text.trim()) return

    setLoading(true)
    setEnhancingDetails(true)

    try {
      // Use context-aware translation endpoint
      const response = await fetch('/api/translate/context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          originalLanguage,
          targetLanguage,
          conversationHistory: conversationHistory.map(entry => ({
            original: entry.original,
            translated: entry.translated,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Context-aware translation failed')
      }

      const contextData: TranslationResponse = await response.json()
      contextData.enhanced = true

      // Update translation with context-aware version
      setTranslation(contextData)
      setLiveTranslation(null) // Clear live translation
      setInputText(text)

      // Add to conversation history
      setConversationHistory(prev => [
        ...prev,
        {
          original: text,
          translated: contextData.translated,
          timestamp: new Date(),
          words: contextData.words,
        },
      ])
    } catch (error) {
      console.error('Context-aware translation error:', error)
      // If context translation fails, keep live translation if available
      if (liveTranslation) {
        setTranslation(liveTranslation)
      } else {
        alert('Failed to translate with context. Please try again.')
      }
    } finally {
      setLoading(false)
      setEnhancingDetails(false)
    }
  }, [originalLanguage, targetLanguage, conversationHistory, liveTranslation])

  // Handler for word-by-word translation
  const handleWordTranslation = useCallback(async (
    words: Array<{text: string, isFinal: boolean, index: number}>
  ) => {
    if (!words || words.length === 0) return

    // Filter out words we've already processed
    // Create a unique key from word text and its position in the sequence
    const newWords = words.filter((word, idx) => {
      const wordKey = `${word.text}-${idx}-${word.isFinal}`
      if (processedWordsRef.current.has(wordKey)) {
        return false
      }
      processedWordsRef.current.add(wordKey)
      return true
    })

    if (newWords.length === 0) return

    // Get context from previous words for better accuracy
    // Use a ref to get the latest state without depending on it
    const previousWords: string[] = []
    setLiveWords(prev => {
      prev.forEach(w => previousWords.push(w.original))
      return prev
    })
    const context = previousWords.slice(-5) // Last 5 words as context

    // Translate each new word immediately
    newWords.forEach(async (word, idx) => {
      // Add word to state with null translation (translating)
      setLiveWords(prev => [...prev, {
        original: word.text,
        translation: null,
        isFinal: word.isFinal,
        timestamp: Date.now(),
        isTranslating: true
      }])

      try {
        // Translate word via API
        const response = await fetch('/api/translate/word', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: word.text,
            originalLanguage,
            targetLanguage,
            context: context
          }),
        })

        if (!response.ok) {
          throw new Error('Word translation failed')
        }

        const translation = await response.json()

        // Update state with translation (find by original word and null translation)
        setLiveWords(prev => prev.map((w, i) => {
          // Find the word that matches and doesn't have a translation yet
          const isTargetWord = w.original === word.text && 
                              w.translation === null && 
                              i >= prev.length - newWords.length
          
          if (isTargetWord) {
            return {
              ...w,
              translation: {
                translation: translation.translation || word.text,
                pinyin: translation.pinyin,
                alternatives: translation.alternatives || []
              },
              isTranslating: false
            }
          }
          return w
        }))
      } catch (error) {
        console.error('Word translation error:', error)
        // Update state to remove translating flag on error
        setLiveWords(prev => prev.map((w, i) => {
          const isTargetWord = w.original === word.text && 
                              w.translation === null && 
                              i >= prev.length - newWords.length
          
          if (isTargetWord) {
            return {
              ...w,
              translation: {
                translation: word.text, // Fallback to original word
                alternatives: []
              },
              isTranslating: false
            }
          }
          return w
        }))
      }
    })
  }, [originalLanguage, targetLanguage, liveWords])

  // Handler for transcript updates (interim and final)
  const handleTranscriptUpdate = useCallback((text: string, isFinal: boolean) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:287',message:'handleTranscriptUpdate: called',data:{text,textLength:text.length,isFinal,currentInputText:inputText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    setInputText(text)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:291',message:'handleTranscriptUpdate: setInputText called',data:{text,isFinal,settingTo:text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion

    if (isFinal) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:294',message:'handleTranscriptUpdate: calling handleFinalTranslation',data:{text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
      // Final result: use context-aware translation
      handleFinalTranslation(text)
      // Clear live words when starting a new sentence (optional - keep them visible)
      // setLiveWords([])
      // processedWordsRef.current.clear()
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:301',message:'handleTranscriptUpdate: calling handleInterimTranslation',data:{text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
      // #endregion
      // Interim result: use live streaming translation
      handleInterimTranslation(text)
    }
  }, [handleInterimTranslation, handleFinalTranslation])

  // Clear live words when language changes or manually
  const clearLiveWords = useCallback(() => {
    setLiveWords([])
    processedWordsRef.current.clear()
  }, [])

  const handleTranslate = async (text: string) => {
    if (!text.trim()) return

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:319',message:'handleTranslate entry',data:{text:text.substring(0,50),originalLanguage,targetLanguage,expectedDirection:`${originalLanguage}->${targetLanguage}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    setLoading(true)
    setTranslation(null)
    setEnhancingDetails(false)

    try {
      // Phase 1: Fast translation with streaming (shows results incrementally)
      setIsStreaming(true)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:320',message:'handleTranslate: starting fetch',data:{textLength:text.length,originalLanguage,targetLanguage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D'})}).catch(()=>{});
      // #endregion
      const requestBody = { text, originalLanguage, targetLanguage, fastMode: true, stream: true };
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:336',message:'handleTranslate: before fetch with request body',data:{originalLanguage,targetLanguage,requestBody:JSON.stringify(requestBody)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
      // #endregion
      const fastResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:343',message:'handleTranslate: fetch completed',data:{ok:fastResponse.ok,status:fastResponse.status,contentType:fastResponse.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D'})}).catch(()=>{});
      // #endregion

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:38',message:'Fast response status',data:{ok:fastResponse.ok,status:fastResponse.status,statusText:fastResponse.statusText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion

      if (!fastResponse.ok) {
        // #region agent log
        const errorText = await fastResponse.text().catch(() => 'failed to read error');
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:40',message:'Fast response not ok',data:{status:fastResponse.status,statusText:fastResponse.statusText,errorText:errorText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw new Error('Translation failed')
      }

      // Check if response is streaming (SSE) or regular JSON
      const contentType = fastResponse.headers.get('content-type')
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:342',message:'Checking content type',data:{contentType,isSSE:contentType?.includes('text/event-stream')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      if (contentType?.includes('text/event-stream')) {
        // Handle streaming response
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:345',message:'SSE mode: getting reader',data:{hasBody:!!fastResponse.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
        // #endregion
        const reader = fastResponse.body?.getReader()
        const decoder = new TextDecoder()
        let accumulatedText = ''
        let fastData: TranslationResponse | null = null

        if (reader) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:352',message:'SSE: starting read loop',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
          // #endregion
          while (true) {
            const { done, value } = await reader.read()
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:355',message:'SSE: reader read',data:{done,hasValue:!!value,valueLength:value?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
            // #endregion
            if (done) {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:361',message:'SSE: reader done, loop exiting',data:{accumulatedLength:accumulatedText.length,hasFastData:!!fastData},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,F'})}).catch(()=>{});
              // #endregion
              // If stream ended but no translation was set, there was likely an error
              if (!fastData && !translation) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:365',message:'SSE: stream ended without result, retrying non-streaming',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
                // #endregion
                // Fallback: try non-streaming mode
                setIsStreaming(false)
                const fallbackResponse = await fetch('/api/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ text, originalLanguage, targetLanguage, fastMode: true, stream: false }),
                })
                if (fallbackResponse.ok) {
                  const fallbackData: TranslationResponse = await fallbackResponse.json()
                  fallbackData.enhanced = false
                  setTranslation(fallbackData)
                  setInputText(text)
                  setLoading(false)
                } else {
                  throw new Error('Translation failed in both streaming and non-streaming modes')
                }
              }
              break
            }

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  
                  // Handle partial chunks (for visual feedback if needed)
                  if (data.chunk && data.type === 'partial') {
                    accumulatedText += data.chunk
                    // Try to parse partial JSON to show incremental translation
                    try {
                      // Look for translated field in accumulated text
                      const jsonMatch = accumulatedText.match(/"translated"\s*:\s*"([^"]*)"/)
                      if (jsonMatch && jsonMatch[1]) {
                        // Update translation incrementally if we have partial data
                        if (!fastData) {
                          fastData = {
                            translated: jsonMatch[1],
                            words: [],
                            pinyin: '',
                            enhanced: false,
                          }
                          setTranslation(fastData)
                          setInputText(text)
                          setLoading(false) // Stop loading as soon as we have partial translation
                        } else {
                          setTranslation({
                            ...fastData,
                            translated: jsonMatch[1],
                          })
                        }
                      }
                    } catch (e) {
                      // Ignore partial parse errors
                    }
                  }
                  
                  // Handle final complete result
                  if (data.done && data.type === 'complete' && data.result) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:396',message:'SSE: received final result',data:{hasResult:!!data.result,hasTranslated:!!data.result?.translated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    const finalResult = data.result
                    if (finalResult) {
                      finalResult.enhanced = false // Mark as not enhanced
                      fastData = finalResult
                      // #region agent log
                      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:461',message:'SSE: calling setTranslation with final result',data:{hasTranslated:!!finalResult.translated,translatedPreview:finalResult.translated?.substring(0,100),originalLanguage,targetLanguage,expectedDirection:`${originalLanguage}->${targetLanguage}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,D,E'})}).catch(()=>{});
                      // #endregion
                      setTranslation(finalResult)
                      setInputText(text)
                      setIsStreaming(false)
                      setLoading(false) // Stop loading indicator
                    }
                  }
                  
                  // Handle errors
                  if (data.error) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:407',message:'SSE: error received in data',data:{error:data.error},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C,E'})}).catch(()=>{});
                    // #endregion
                    setLoading(false)
                    setIsStreaming(false)
                    alert(`Translation error: ${data.error}`)
                    return // Exit early on error
                  }
                } catch (e) {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:412',message:'SSE: parse error',data:{errorType:e?.constructor?.name,errorMessage:e instanceof Error?e.message:String(e)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                  // #endregion
                  // Ignore parse errors for individual chunks
                  console.warn('Failed to parse SSE data:', e)
                }
              }
            }
          }
        }
      } else {
        // Fallback to non-streaming mode
        // #region agent log
        const responseText = await fastResponse.text();
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:43',message:'Fast response text before parse',data:{textLength:responseText.length,textPreview:responseText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
        // #endregion

        let fastData: TranslationResponse;
        try {
          fastData = JSON.parse(responseText);
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:45',message:'Fast JSON parse success',data:{hasTranslated:!!fastData.translated,wordsCount:fastData.words?.length||0,hasPinyin:!!fastData.pinyin},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
          // #endregion
        } catch (parseError) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:48',message:'Fast JSON parse error',data:{error:parseError instanceof Error?parseError.message:String(parseError),responsePreview:responseText.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          throw parseError;
        }
        fastData.enhanced = false // Mark as not enhanced
        setTranslation(fastData)
        setInputText(text)
        setLoading(false) // Stop loading indicator - show fast translation immediately
      }

      // Phase 2: Detailed translation (background) - use current translation state
      setEnhancingDetails(true)
      try {
        const detailedResponse = await fetch('/api/translate/detailed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, originalLanguage, targetLanguage }),
        })

        if (!detailedResponse.ok) {
          throw new Error('Detailed translation failed')
        }

        const detailedData: TranslationResponse = await detailedResponse.json()
        detailedData.enhanced = true

        // Merge: Keep translated text from fast mode, update word details from detailed
        // Get current translation to preserve the translated text
        setTranslation(prev => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:536',message:'During merge: checking prev state',data:{hasPrev:!!prev,prevTranslated:prev?.translated?.substring(0,100),detailedTranslated:detailedData.translated?.substring(0,100),targetLanguage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          if (!prev) {
            return detailedData
          }
          
          // Always prefer fast translation (prev.translated) since it's usually correct
          // Only use detailed translation if fast translation doesn't exist
          // Check if detailed translation is clearly wrong (contains Chinese when target is French/English)
          const containsChinese = /[\u4e00-\u9fff]/.test(detailedData.translated || '')
          const isDetailedTranslationWrong = 
            (targetLanguage === 'fr' || targetLanguage === 'en') && containsChinese
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:546',message:'Merge decision',data:{isDetailedTranslationWrong,containsChinese,targetLanguage,willUsePrevTranslated:true,prevTranslatedExists:!!prev.translated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          return {
            ...detailedData,
            translated: prev.translated, // Always keep fast translation text when prev exists
            pinyin: detailedData.pinyin || prev.pinyin,
            enhanced: true,
          }
        })
      } catch (detailedError) {
        // Graceful degradation: if detailed translation fails, keep fast translation
        console.error('Detailed translation error:', detailedError)
        // Keep the fast translation displayed - don't show error to user for background enhancement
      } finally {
        setEnhancingDetails(false)
      }
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:80',message:'Translation error caught',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack?.substring(0,300):undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
      console.error('Translation error:', error)
      alert('Failed to translate. Please try again.')
      setLoading(false)
      setEnhancingDetails(false)
    }
  }

  const handlePlayAudio = async (text: string) => {
    console.log('[DEBUG] handlePlayAudio called', { text: text?.substring(0, 50), textLength: text?.length })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:401',message:'handlePlayAudio entry',data:{textLength:text.length,textPreview:text.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:404',message:'Before fetch /api/synthesize',data:{textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:412',message:'After fetch /api/synthesize',data:{ok:response.ok,status:response.status,statusText:response.statusText,contentType:response.headers.get('content-type'),hasBody:!!response.body},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
      // #endregion

      if (!response.ok) {
        // #region agent log
        const errorText = await response.text().catch(() => 'failed to read error');
        fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:416',message:'Response not ok',data:{status:response.status,statusText:response.statusText,errorText:errorText.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        throw new Error('Audio synthesis failed')
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:422',message:'Before blob creation',data:{contentType:response.headers.get('content-type')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const blob = await response.blob()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:427',message:'After blob creation',data:{blobSize:blob.size,blobType:blob.type,hasData:blob.size>0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const url = URL.createObjectURL(blob)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:432',message:'Audio URL created',data:{urlPreview:url.substring(0,50),previousAudioUrl:!!audioUrl},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
      // #endregion
      
      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      
      setAudioUrl(url)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:439',message:'Before Audio creation and play',data:{urlPreview:url.substring(0,50),blobSize:blob.size},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D,E'})}).catch(()=>{});
      // #endregion
      const audio = new Audio(url)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:443',message:'Audio object created',data:{readyState:audio.readyState,src:audio.src.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D,E'})}).catch(()=>{});
      // #endregion
      await audio.play()
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:446',message:'Audio play() succeeded',data:{paused:audio.paused,ended:audio.ended},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/page.tsx:449',message:'Audio playback error caught',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error),errorName:error instanceof DOMException?error.name:undefined,code:error instanceof DOMException?error.code:undefined,stack:error instanceof Error?error.stack?.substring(0,300):undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
      console.error('Audio playback error:', error)
      alert('Failed to play audio. Please try again.')
    }
  }

  const handleSaveWords = async () => {
    if (!translation || !translation.words || translation.words.length === 0) {
      alert('No words to save')
      return
    }

    setSaving(true)

    try {
      // Save each word and track successful saves
      const saveResults = await Promise.allSettled(
        translation.words.map(async (word) => {
          const response = await fetch('/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(word),
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(error.error || `Failed to save word: ${word.word}`)
          }

          return { word, response: await response.json() }
        })
      )

      // Filter successful saves
      const successfulSaves = saveResults
        .filter((result): result is PromiseFulfilledResult<{ word: Word; response: any }> => 
          result.status === 'fulfilled'
        )
        .map((result) => result.value)

      const failedSaves = saveResults
        .filter((result): result is PromiseRejectedResult => 
          result.status === 'rejected'
        )

      // Only proceed if at least one word was saved
      if (successfulSaves.length === 0) {
        const errorMessages = failedSaves
          .map((result) => result.reason?.message || 'Unknown error')
          .join('\n')
        alert(`Failed to save all words:\n${errorMessages}`)
        return
      }

      // Save query only with successfully saved words
      const queryResponse = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: inputText,
          translated: translation.translated,
          words: successfulSaves.map((s) => s.word.word),
        }),
      })

      if (!queryResponse.ok) {
        throw new Error('Failed to save query')
      }

      // Update progress in localStorage with actual saved count
      if (typeof window !== 'undefined') {
        const { updateStreak, incrementWordsLearned, incrementQueries } = await import('@/lib/storage')
        updateStreak()
        incrementWordsLearned(successfulSaves.length)
        incrementQueries()
      }

      // Show appropriate message based on results
      if (failedSaves.length > 0) {
        alert(`Saved ${successfulSaves.length} of ${translation.words.length} word(s). Some words failed to save.`)
      } else {
        alert(`Saved ${successfulSaves.length} word(s)!`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert(`Failed to save words: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTranscript = (text: string) => {
    // This is for backward compatibility - treat as final transcript
    setInputText(text)
    handleFinalTranslation(text)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Codeswitching Learning</h1>
          <Link href="/learn">
            <Button variant="outline">Learning Dashboard</Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Translate Mixed Languages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 items-center flex-wrap">
              <div className="flex gap-2 items-center">
                <label className="text-sm text-muted-foreground">From:</label>
                <select
                  value={originalLanguage}
                  onChange={(e) => setOriginalLanguage(e.target.value as 'zh' | 'en' | 'fr')}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                  disabled={loading}
                >
                  <option value="zh">Chinese (Mandarin)</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </div>
              <span className="text-muted-foreground">→</span>
              <div className="flex gap-2 items-center">
                <label className="text-sm text-muted-foreground">To:</label>
                <select
                  value={targetLanguage}
                  onChange={(e) => setTargetLanguage(e.target.value as 'zh' | 'en' | 'fr')}
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                  disabled={loading}
                >
                  <option value="zh">Chinese (Mandarin)</option>
                  <option value="en">English</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Type or say: 'ni hao my name is li hua'"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTranslate(inputText)
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => handleTranslate(inputText)}
                disabled={loading || !inputText.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Translating...
                  </>
                ) : (
                  'Translate'
                )}
              </Button>
            </div>

            <div className="flex justify-center">
              <AudioInput 
                onTranscript={handleTranscript} 
                onTranscriptUpdate={handleTranscriptUpdate}
                onWordUpdate={handleWordTranslation}
                disabled={loading}
                originalLanguage={originalLanguage}
                targetLanguage={targetLanguage}
              />
            </div>
          </CardContent>
        </Card>

        {liveWords.length > 0 && (
          <div className="mb-6">
            <LiveWordDisplay words={liveWords} />
          </div>
        )}

        {(translation || liveTranslation) && (
          <>
            <TranslationDisplay
              original={inputText}
              translation={translation || liveTranslation}
              loading={loading}
              enhancingDetails={enhancingDetails}
              onPlayAudio={handlePlayAudio}
              originalLanguage={originalLanguage}
              targetLanguage={targetLanguage}
              isLive={!!liveTranslation && !translation}
              isStreaming={isStreaming}
            />

            {(translation || liveTranslation) && (translation || liveTranslation)!.words && (translation || liveTranslation)!.words!.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleSaveWords}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Words
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
