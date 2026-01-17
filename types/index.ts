export interface Word {
  _id?: string
  word: string
  pinyin: string
  english: string
  explanation: string
  learnedAt: Date
  reviewCount: number
  lastReviewed: Date
  mastery: number // 0-100 score
}

export interface Query {
  _id?: string
  original: string
  translated: string
  words: string[] // Array of word IDs
  timestamp: Date
}

export interface Progress {
  wordsLearned: number
  currentStreak: number
  lastPracticeDate: string // ISO date string
  totalQueries: number
}

export interface TranslationResponse {
  translated: string
  words: Word[]
  pinyin: string
}

export interface TranslationRequest {
  text: string
}

export interface TaggedWord {
  text: string
  language: 'zh' | 'en' | 'mixed'
}

export interface TranscriptionResult {
  transcription: string
  words: TaggedWord[]
}