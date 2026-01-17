'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Word } from '@/types'

interface WordCardProps {
  word: Word
  onClick?: () => void
}

export function WordCard({ word, onClick }: WordCardProps) {
  // Check if word has multiple translations with connotations
  const hasMultipleTranslations = word.translations && word.translations.length > 0

  return (
    <Card
      className={onClick ? 'cursor-pointer hover:bg-accent transition-colors' : ''}
      onClick={onClick}
    >
      <CardContent className="pt-6">
        <div className="space-y-2">
          {hasMultipleTranslations ? (
            // Display in WordReference format with multiple translations
            <div className="space-y-3">
              <div className="font-semibold text-xl">
                {word.word}
                {word.partOfSpeech && (
                  <span className="text-base font-normal text-muted-foreground ml-1">
                    ({word.partOfSpeech})
                  </span>
                )}
              </div>
              {word.pinyin && word.pinyin !== 'N/A' && (
                <div className="text-sm text-muted-foreground">{word.pinyin}</div>
              )}
              {word.translations.map((variant, index) => (
                <div key={index} className="text-sm">
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
                <div className="text-xs text-muted-foreground mt-2">
                  {word.explanation}
                </div>
              )}
            </div>
          ) : (
            // Display in original format for backward compatibility
            <>
              <div className="font-semibold text-xl">{word.word}</div>
              {word.pinyin && word.pinyin !== 'N/A' && (
                <div className="text-sm text-muted-foreground">{word.pinyin}</div>
              )}
              <div className="text-base">{word.english}</div>
              {word.explanation && (
                <div className="text-sm text-muted-foreground mt-2">
                  {word.explanation}
                </div>
              )}
            </>
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
