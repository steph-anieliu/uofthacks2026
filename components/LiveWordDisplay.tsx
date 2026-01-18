'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'

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

interface LiveWordDisplayProps {
  words: LiveWord[]
}

export function LiveWordDisplay({ words }: LiveWordDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new words are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [words])

  if (words.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Word Translations</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          ref={scrollRef}
          className="space-y-3 max-h-96 overflow-y-auto"
        >
          {words.map((word, idx) => (
            <div 
              key={`${word.original}-${word.timestamp}-${idx}`}
              className={`p-2 border rounded-lg transition-opacity ${
                word.isFinal ? 'opacity-100' : 'opacity-70'
              }`}
            >
              <div className="font-medium text-lg">{word.original}</div>
              
              {word.isTranslating ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Translating...</span>
                </div>
              ) : word.translation ? (
                <div className="mt-1 space-y-1">
                  <div className="text-muted-foreground">
                    {word.translation.translation}
                    {word.translation.pinyin && (
                      <span className="text-xs ml-2">({word.translation.pinyin})</span>
                    )}
                  </div>
                  {word.translation.alternatives && word.translation.alternatives.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Alternatives: {word.translation.alternatives.join(', ')}
                    </div>
                  )}
                </div>
              ) : null}
              
              {!word.isFinal && (
                <div className="text-xs text-muted-foreground mt-1 italic">
                  (interim)
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
