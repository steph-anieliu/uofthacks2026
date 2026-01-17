'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Word } from '@/types'
import { RotateCw, ChevronLeft, ChevronRight } from 'lucide-react'

interface FlashcardProps {
  word: Word
  onNext?: () => void
  onPrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
}

export function Flashcard({
  word,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
}: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <div className="space-y-4">
      <Card
        className="min-h-[300px] cursor-pointer transition-transform hover:scale-[1.02]"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <CardContent className="pt-6 flex flex-col items-center justify-center h-full min-h-[300px]">
          {!isFlipped ? (
            <div className="text-center space-y-4">
              <div className="text-4xl font-bold mb-4">{word.word}</div>
              <div className="text-xl text-muted-foreground">{word.pinyin}</div>
              <div className="text-sm text-muted-foreground mt-8">
                Click to reveal translation
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-3xl font-semibold mb-2">{word.english}</div>
              {word.explanation && (
                <div className="text-sm text-muted-foreground max-w-md">
                  {word.explanation}
                </div>
              )}
              <div className="text-sm text-muted-foreground mt-8">
                Click to flip back
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            setIsFlipped(false)
            onPrevious?.()
          }}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Button
          variant="outline"
          onClick={(e) => {
            e.stopPropagation()
            setIsFlipped(false)
          }}
        >
          <RotateCw className="h-4 w-4 mr-2" />
          Reset
        </Button>

        <Button
          variant="outline"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            setIsFlipped(false)
            onNext?.()
          }}
          disabled={!hasNext}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
