/**
 * Test script to verify all language combinations work correctly
 * 
 * To run this script:
 *   npm run test:translations
 * 
 * Make sure .env.local exists with GEMINI_API_KEY
 */

import { readFileSync } from 'fs'
import { resolve } from 'path'

// Set dummy ELEVENLABS_API_KEY if not present (not needed for translation tests)
// Must be set BEFORE importing modules that check for it
if (!process.env.ELEVENLABS_API_KEY) {
  process.env.ELEVENLABS_API_KEY = 'dummy-key-for-testing'
}

// Load environment variables from .env.local
function loadEnvFile() {
  try {
    const envPath = resolve(process.cwd(), '.env.local')
    const envContent = readFileSync(envPath, 'utf-8')
    const envLines = envContent.split('\n')
    
    for (const line of envLines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value
        }
      }
    }
  } catch (error) {
    // .env.local might not exist, that's okay if env vars are set another way
    console.warn('Warning: Could not load .env.local file. Make sure GEMINI_API_KEY is set in environment.')
  }
}

loadEnvFile()

// Import types (these don't cause module execution)
import type { TranslationResponse } from './types'

type Language = 'zh' | 'en' | 'fr'

interface TestCase {
  originalLanguage: Language
  targetLanguage: Language
  text: string
  description: string
}

const testCases: TestCase[] = [
  // Pattern A: Non-Chinese → Chinese (extract Chinese translations with pinyin)
  {
    originalLanguage: 'en',
    targetLanguage: 'zh',
    text: 'Hello, my name is John',
    description: 'English → Chinese (Pattern A)'
  },
  {
    originalLanguage: 'fr',
    targetLanguage: 'zh',
    text: 'Bonjour, je m\'appelle Jean',
    description: 'French → Chinese (Pattern A)'
  },
  
  // Pattern B: Chinese → Non-Chinese (extract original Chinese words)
  {
    originalLanguage: 'zh',
    targetLanguage: 'en',
    text: '你好，我的名字是约翰',
    description: 'Chinese → English (Pattern B)'
  },
  {
    originalLanguage: 'zh',
    targetLanguage: 'fr',
    text: '你好，我的名字是约翰',
    description: 'Chinese → French (Pattern B)'
  },
  
  // Pattern C: Non-Chinese → Non-Chinese (extract translated words, no pinyin)
  {
    originalLanguage: 'en',
    targetLanguage: 'fr',
    text: 'Hello, my name is John',
    description: 'English → French (Pattern C)'
  },
  {
    originalLanguage: 'fr',
    targetLanguage: 'en',
    text: 'Bonjour, je m\'appelle Jean',
    description: 'French → English (Pattern C)'
  },
  
  // Edge cases: Same language (should still work)
  {
    originalLanguage: 'zh',
    targetLanguage: 'zh',
    text: '你好，我的名字是约翰',
    description: 'Chinese → Chinese (Edge case)'
  },
  {
    originalLanguage: 'en',
    targetLanguage: 'en',
    text: 'Hello, my name is John',
    description: 'English → English (Edge case)'
  },
  {
    originalLanguage: 'fr',
    targetLanguage: 'fr',
    text: 'Bonjour, je m\'appelle Jean',
    description: 'French → French (Edge case)'
  },
  
  // Mixed language cases
  {
    originalLanguage: 'en',
    targetLanguage: 'zh',
    text: 'Hello 你好 my name is John',
    description: 'Mixed English/Chinese → Chinese (Pattern A with mixed input)'
  },
  {
    originalLanguage: 'zh',
    targetLanguage: 'en',
    text: '你好 Hello 我的名字是约翰',
    description: 'Mixed Chinese/English → English (Pattern B with mixed input)'
  },
  {
    originalLanguage: 'en',
    targetLanguage: 'fr',
    text: 'Hello bonjour my name is John',
    description: 'Mixed English/French → French (Pattern C with mixed input)'
  }
]

function validateResponse(response: TranslationResponse, testCase: TestCase): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Check required fields
  if (!response.translated || typeof response.translated !== 'string') {
    errors.push('Missing or invalid "translated" field')
  }
  
  if (!Array.isArray(response.words)) {
    errors.push('Missing or invalid "words" array')
  }
  
  if (typeof response.pinyin !== 'string') {
    errors.push('Missing or invalid "pinyin" field')
  }
  
  // Validate words array structure
  if (Array.isArray(response.words)) {
    response.words.forEach((word, index) => {
      if (!word.word || typeof word.word !== 'string') {
        errors.push(`Word ${index}: missing or invalid "word" field`)
      }
      if (typeof word.pinyin !== 'string') {
        errors.push(`Word ${index}: missing or invalid "pinyin" field`)
      }
      if (!word.english || typeof word.english !== 'string') {
        errors.push(`Word ${index}: missing or invalid "english" field`)
      }
      if (!word.explanation || typeof word.explanation !== 'string') {
        errors.push(`Word ${index}: missing or invalid "explanation" field`)
      }
      if (typeof word.learnedAt === 'undefined') {
        errors.push(`Word ${index}: missing "learnedAt" field`)
      }
      if (typeof word.reviewCount !== 'number') {
        errors.push(`Word ${index}: missing or invalid "reviewCount" field`)
      }
      if (typeof word.lastReviewed === 'undefined') {
        errors.push(`Word ${index}: missing "lastReviewed" field`)
      }
      if (typeof word.mastery !== 'number') {
        errors.push(`Word ${index}: missing or invalid "mastery" field`)
      }
    })
  }
  
  // Pattern-specific validations
  const isTargetChinese = testCase.targetLanguage === 'zh'
  const isOriginalChinese = testCase.originalLanguage === 'zh'
  
  if (isTargetChinese && !isOriginalChinese) {
    // Pattern A: Should have pinyin for words
    response.words.forEach((word, index) => {
      if (word.pinyin === 'N/A' || !word.pinyin) {
        errors.push(`Word ${index}: Pattern A should have pinyin, got "${word.pinyin}"`)
      }
    })
    if (!response.pinyin || response.pinyin === 'N/A') {
      errors.push('Pattern A should have pinyin for the full translation')
    }
  } else if (isOriginalChinese && !isTargetChinese) {
    // Pattern B: Should have pinyin for Chinese words
    response.words.forEach((word, index) => {
      if (word.pinyin === 'N/A' || !word.pinyin) {
        errors.push(`Word ${index}: Pattern B should have pinyin for Chinese words, got "${word.pinyin}"`)
      }
    })
    if (!response.pinyin || response.pinyin === 'N/A') {
      errors.push('Pattern B should have pinyin for the full translation')
    }
  } else if (!isOriginalChinese && !isTargetChinese) {
    // Pattern C: Should have "N/A" for pinyin
    response.words.forEach((word, index) => {
      if (word.pinyin !== 'N/A') {
        errors.push(`Word ${index}: Pattern C should have pinyin="N/A", got "${word.pinyin}"`)
      }
    })
    if (response.pinyin !== 'N/A') {
      errors.push(`Pattern C should have pinyin="N/A" for full translation, got "${response.pinyin}"`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

async function runTests() {
  // Dynamically import to ensure env vars are set first
  const { translateWithCodeswitching } = await import('./lib/gemini')
  
  console.log('🧪 Starting translation tests...\n')
  console.log(`Testing ${testCases.length} language combinations\n`)
  
  let passed = 0
  let failed = 0
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i]
    console.log(`\n[${i + 1}/${testCases.length}] ${testCase.description}`)
    console.log(`  Input: "${testCase.text}"`)
    console.log(`  ${testCase.originalLanguage} → ${testCase.targetLanguage}`)
    
    try {
      const startTime = Date.now()
      const response = await translateWithCodeswitching(
        testCase.text,
        testCase.originalLanguage,
        testCase.targetLanguage
      )
      const duration = Date.now() - startTime
      
      console.log(`  ✅ Translation received in ${duration}ms`)
      console.log(`  Translated: "${response.translated}"`)
      console.log(`  Words extracted: ${response.words.length}`)
      console.log(`  Pinyin: "${response.pinyin}"`)
      
      // Validate response
      const validation = validateResponse(response, testCase)
      
      if (validation.valid) {
        console.log(`  ✅ Validation passed`)
        passed++
      } else {
        console.log(`  ❌ Validation failed:`)
        validation.errors.forEach(error => {
          console.log(`     - ${error}`)
        })
        failed++
      }
      
      // Show first few words as sample
      if (response.words.length > 0) {
        console.log(`  Sample words:`)
        response.words.slice(0, 3).forEach((word, idx) => {
          console.log(`    ${idx + 1}. ${word.word} (${word.pinyin}) = ${word.english}`)
        })
        if (response.words.length > 3) {
          console.log(`    ... and ${response.words.length - 3} more`)
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Test failed with error:`)
      console.log(`     ${error instanceof Error ? error.message : String(error)}`)
      failed++
    }
    
    // Add a small delay to avoid rate limiting
    if (i < testCases.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  console.log(`\n\n📊 Test Results:`)
  console.log(`  ✅ Passed: ${passed}`)
  console.log(`  ❌ Failed: ${failed}`)
  console.log(`  Total: ${testCases.length}`)
  
  if (failed === 0) {
    console.log(`\n🎉 All tests passed!`)
    process.exit(0)
  } else {
    console.log(`\n⚠️  Some tests failed. Please review the errors above.`)
    process.exit(1)
  }
}

// Check for required environment variable
if (!process.env.GEMINI_API_KEY) {
  console.error('❌ Error: GEMINI_API_KEY not found in environment variables')
  console.error('   Please ensure .env.local exists and contains GEMINI_API_KEY')
  process.exit(1)
}

// Run tests
runTests().catch(error => {
  console.error('❌ Fatal error running tests:', error)
  process.exit(1)
})
