'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Volume2 } from 'lucide-react'
import { TranslationResponse } from '@/types'
import { useState } from 'react'

interface TranslationDisplayProps {
  original: string
  translation: TranslationResponse | null
  loading?: boolean
  onPlayAudio?: (text: string) => void
  originalLanguage?: 'zh' | 'en' | 'fr'
  targetLanguage?: 'zh' | 'en' | 'fr'
}

export function TranslationDisplay({
  original,
  translation,
  loading = false,
  onPlayAudio,
  originalLanguage = 'zh',
  targetLanguage = 'en',
}: TranslationDisplayProps) {
  const [playing, setPlaying] = useState(false)

  const handlePlayAudio = async () => {
    if (!translation || !onPlayAudio) return
    
    setPlaying(true)
    try {
      await onPlayAudio(translation.translated)
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
          <CardTitle>Translation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Original:</p>
            <p className="text-lg">{original}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Translated:</p>
            <p className="text-2xl font-semibold mb-2">{translation.translated}</p>
            {translation.pinyin && (
              <p className="text-lg text-muted-foreground">{translation.pinyin}</p>
            )}
          </div>

          {onPlayAudio && (
            <Button
              onClick={handlePlayAudio}
              disabled={playing}
              variant="outline"
              className="w-full"
            >
              <Volume2 className="h-4 w-4 mr-2" />
              {playing ? 'Playing...' : 'Play Pronunciation'}
            </Button>
          )}
        </CardContent>
      </Card>

      {translation.words && translation.words.length > 0 && (
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
