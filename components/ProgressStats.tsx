'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/types'
import { getProgress } from '@/lib/storage'
import { Flame, BookOpen, MessageSquare } from 'lucide-react'

export function ProgressStats() {
  const [progress, setProgress] = useState<Progress>({
    wordsLearned: 0,
    currentStreak: 0,
    lastPracticeDate: '',
    totalQueries: 0,
  })

  useEffect(() => {
    setProgress(getProgress())
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Words Learned</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.wordsLearned}</div>
          <p className="text-xs text-muted-foreground">
            Total vocabulary
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
          <Flame className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.currentStreak}</div>
          <p className="text-xs text-muted-foreground">
            {progress.currentStreak > 0 ? 'days in a row!' : 'Start practicing!'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Queries</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{progress.totalQueries}</div>
          <p className="text-xs text-muted-foreground">
            Translations made
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
