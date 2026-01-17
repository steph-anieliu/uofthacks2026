import { Progress } from '@/types'

const PROGRESS_KEY = 'codeswitching_progress'

export function getProgress(): Progress {
  if (typeof window === 'undefined') {
    return {
      wordsLearned: 0,
      currentStreak: 0,
      lastPracticeDate: '',
      totalQueries: 0,
    }
  }

  try {
    const stored = localStorage.getItem(PROGRESS_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Error reading progress from localStorage:', error)
  }

  return {
    wordsLearned: 0,
    currentStreak: 0,
    lastPracticeDate: '',
    totalQueries: 0,
  }
}

export function updateProgress(updates: Partial<Progress>): Progress {
  const current = getProgress()
  const updated = { ...current, ...updates }
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(updated))
    } catch (error) {
      console.error('Error saving progress to localStorage:', error)
    }
  }
  
  return updated
}

export function updateStreak(): Progress {
  const progress = getProgress()
  const today = new Date().toISOString().split('T')[0]
  const lastDate = progress.lastPracticeDate

  let newStreak = progress.currentStreak

  if (lastDate === today) {
    // Already practiced today, no change
    return progress
  }

  if (!lastDate) {
    // First time practicing
    newStreak = 1
  } else {
    const last = new Date(lastDate)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    if (last.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
      // Consecutive day
      newStreak = progress.currentStreak + 1
    } else {
      // Streak broken
      newStreak = 1
    }
  }

  return updateProgress({
    currentStreak: newStreak,
    lastPracticeDate: today,
  })
}

export function incrementWordsLearned(count: number = 1): Progress {
  const progress = getProgress()
  return updateProgress({
    wordsLearned: progress.wordsLearned + count,
  })
}

export function incrementQueries(): Progress {
  const progress = getProgress()
  return updateProgress({
    totalQueries: progress.totalQueries + 1,
  })
}
