'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Word } from '@/types'

interface WordCardProps {
  word: Word
  onClick?: () => void
}

export function WordCard({ word, onClick }: WordCardProps) {
  return (
    <Card
      className={onClick ? 'cursor-pointer hover:bg-accent transition-colors' : ''}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="font-semibold text-xl">{word.word}</div>
          <div className="text-sm text-muted-foreground">{word.pinyin}</div>
          <div className="text-base">{word.english}</div>
          {word.explanation && (
            <div className="text-sm text-muted-foreground mt-2">
              {word.explanation}
            </div>
          )}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span>Reviews: {word.reviewCount}</span>
            <span>Mastery: {word.mastery}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
