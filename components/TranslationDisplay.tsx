'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Volume2, Loader2 } from 'lucide-react'
import { TranslationResponse } from '@/types'
import { useState } from 'react'

interface TranslationDisplayProps {
  original: string
  translation: TranslationResponse | null
  loading?: boolean
  enhancingDetails?: boolean
  onPlayAudio?: (text: string) => void
  originalLanguage?: 'zh' | 'en' | 'fr'
  targetLanguage?: 'zh' | 'en' | 'fr'
  isLive?: boolean
  isStreaming?: boolean
}

export function TranslationDisplay({
  original,
  translation,
  loading = false,
  enhancingDetails = false,
  onPlayAudio,
  originalLanguage = 'zh',
  targetLanguage = 'en',
  isLive = false,
  isStreaming = false,
}: TranslationDisplayProps) {
  const [playing, setPlaying] = useState(false)

  const handlePlayAudio = async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/TranslationDisplay.tsx:34',message:'handlePlayAudio button clicked',data:{hasTranslation:!!translation,hasOnPlayAudio:!!onPlayAudio,translatedText:translation?.translated?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
    // #endregion
    if (!translation || !onPlayAudio) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/TranslationDisplay.tsx:37',message:'handlePlayAudio early return',data:{hasTranslation:!!translation,hasOnPlayAudio:!!onPlayAudio},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      return
    }
    
    setPlaying(true)
    try {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/TranslationDisplay.tsx:43',message:'Calling onPlayAudio',data:{translatedText:translation.translated.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      await onPlayAudio(translation.translated)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/TranslationDisplay.tsx:45',message:'onPlayAudio completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,D'})}).catch(()=>{});
      // #endregion
    } catch (error) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'components/TranslationDisplay.tsx:47',message:'handlePlayAudio error in component',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
      // #endregion
    } finally {
      setPlaying(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Translating...</div>
        </CardContent>
      </Card>
    )
  }

  if (!translation) {
    return null
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Translation</CardTitle>
            {isLive && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {isStreaming && <Loader2 className="h-3 w-3 animate-spin" />}
                <span className="italic">Live Preview</span>
              </span>
            )}
            {!isLive && translation?.enhanced && (
              <span className="text-xs text-muted-foreground italic">
                Context-Aware
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Original:</p>
            <p className="text-lg">{original}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Translated:</p>
            <p className={`text-2xl font-semibold mb-2 ${isLive ? 'italic text-muted-foreground' : ''}`}>
              {translation.translated}
            </p>
            {translation.pinyin && (
              <p className={`text-lg ${isLive ? 'text-muted-foreground/70' : 'text-muted-foreground'}`}>
                {translation.pinyin}
              </p>
            )}
          </div>

          {onPlayAudio && (
            <Button
              onClick={(e) => {
                console.log('[DEBUG] Play button clicked', { hasTranslation: !!translation, hasOnPlayAudio: !!onPlayAudio })
                handlePlayAudio()
              }}
              disabled={playing}
              variant="outline"
              className="w-full"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              {playing ? 'Playing...' : 'Play Pronunciation'}
            </Button>
          )}

          {isStreaming && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 pt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Translating in real-time...
            </div>
          )}
          {enhancingDetails && !isLive && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 pt-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Enhancing with conversation context...
            </div>
          )}
        </CardContent>
      </Card>

      {translation.words && translation.words.length > 0 && !isLive && (
        <Card>
          <CardHeader>
            <CardTitle>
              {(originalLanguage === 'en' || originalLanguage === 'fr') && targetLanguage === 'zh' 
                ? 'Translated Words' 
                : 'Words Learned'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {translation.words.map((word, index) => {
                const hasMultipleTranslations = word.translations && word.translations.length > 0
                
                return (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      {(originalLanguage === 'en' || originalLanguage === 'fr') && targetLanguage === 'zh' ? (
                        // Non-Chinese → Chinese
                        hasMultipleTranslations ? (
                          <div className="space-y-2">
                            <div className="font-semibold text-lg">
                              {word.english}
                              {word.partOfSpeech && (
                                <span className="text-sm font-normal text-muted-foreground ml-1">
                                  ({word.partOfSpeech})
                                </span>
                              )}
                            </div>
                            {word.translations?.map((variant, vIndex) => (
                              <div key={vIndex} className="text-sm ml-2">
                                <span className="text-muted-foreground">
                                  {variant.connotation}
                                </span>
                                {' → '}
                                <span className="font-medium">
                                  {variant.translations.join(', ')}
                                </span>
                                {variant.partOfSpeech && (
                                  <span className="text-muted-foreground ml-1">
                                    ({variant.partOfSpeech})
                                  </span>
                                )}
                              </div>
                            ))}
                            {word.explanation && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {word.explanation}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="text-sm text-muted-foreground mb-1">{word.english}</div>
                            <div className="font-semibold text-lg">{word.word}</div>
                            <div className="text-sm text-muted-foreground">{word.pinyin}</div>
                            {word.explanation && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {word.explanation}
                              </div>
                            )}
                          </>
                        )
                      ) : (
                        // Chinese → Non-Chinese or other combinations
                        hasMultipleTranslations ? (
                          <div className="space-y-2">
                            <div className="font-semibold text-lg">
                              {word.word}
                              {word.partOfSpeech && (
                                <span className="text-sm font-normal text-muted-foreground ml-1">
                                  ({word.partOfSpeech})
                                </span>
                              )}
                            </div>
                            {word.pinyin && word.pinyin !== 'N/A' && (
                              <div className="text-sm text-muted-foreground">{word.pinyin}</div>
                            )}
                            {word.translations?.map((variant, vIndex) => (
                              <div key={vIndex} className="text-sm ml-2">
                                <span className="text-muted-foreground">
                                  {variant.connotation}
                                </span>
                                {' → '}
                                <span className="font-medium">
                                  {variant.translations.join(', ')}
                                </span>
                                {variant.partOfSpeech && (
                                  <span className="text-muted-foreground ml-1">
                                    ({variant.partOfSpeech})
                                  </span>
                                )}
                              </div>
                            ))}
                            {word.explanation && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {word.explanation}
                              </div>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="font-semibold text-lg">{word.word}</div>
                            {word.pinyin && word.pinyin !== 'N/A' && (
                              <div className="text-sm text-muted-foreground">{word.pinyin}</div>
                            )}
                            <div className="text-sm">{word.english}</div>
                            {word.explanation && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {word.explanation}
                              </div>
                            )}
                          </>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
