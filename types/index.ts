export interface TranslationVariant {
  connotation: string // e.g., "full of joy", "satisfied"
  translations: string[] // e.g., ["heureux", "heureuse"]
  partOfSpeech: string // e.g., "adj", "noun", "verb"
}

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
  // New fields for multiple translations with connotations
  partOfSpeech?: string // Part of speech of the original word
  translations?: TranslationVariant[] // Multiple translations with connotations
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

export type SupportedLanguage = 'zh' | 'en' | 'fr'

export interface TranslationRequest {
  text: string
  originalLanguage: SupportedLanguage
  targetLanguage: SupportedLanguage
}

export interface TaggedWord {
  text: string
  language: 'zh' | 'en' | 'fr' | 'mixed'
}

export interface TranscriptionResult {
  transcription: string
  words: TaggedWord[]
}