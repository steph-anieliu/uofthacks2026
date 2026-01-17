'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AudioInput } from '@/components/AudioInput'
import { TranslationDisplay } from '@/components/TranslationDisplay'
import { TranslationResponse, Word } from '@/types'
import { Save, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  const [inputText, setInputText] = useState('')
  const [translation, setTranslation] = useState<TranslationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const handleTranslate = async (text: string) => {
    if (!text.trim()) return

    setLoading(true)
    setTranslation(null)

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Translation failed')
      }

      const data: TranslationResponse = await response.json()
      setTranslation(data)
      setInputText(text)
    } catch (error) {
      console.error('Translation error:', error)
      alert('Failed to translate. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayAudio = async (text: string) => {
    try {
      const response = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      if (!response.ok) {
        throw new Error('Audio synthesis failed')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      
      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
      
      setAudioUrl(url)
      
      const audio = new Audio(url)
      await audio.play()
    } catch (error) {
      console.error('Audio playback error:', error)
      alert('Failed to play audio. Please try again.')
    }
  }

  const handleSaveWords = async () => {
    if (!translation || !translation.words || translation.words.length === 0) {
      alert('No words to save')
      return
    }

    setSaving(true)

    try {
      // Save each word and track successful saves
      const saveResults = await Promise.allSettled(
        translation.words.map(async (word) => {
          const response = await fetch('/api/words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(word),
          })

          if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(error.error || `Failed to save word: ${word.word}`)
          }

          return { word, response: await response.json() }
        })
      )

      // Filter successful saves
      const successfulSaves = saveResults
        .filter((result): result is PromiseFulfilledResult<{ word: Word; response: any }> => 
          result.status === 'fulfilled'
        )
        .map((result) => result.value)

      const failedSaves = saveResults
        .filter((result): result is PromiseRejectedResult => 
          result.status === 'rejected'
        )

      // Only proceed if at least one word was saved
      if (successfulSaves.length === 0) {
        const errorMessages = failedSaves
          .map((result) => result.reason?.message || 'Unknown error')
          .join('\n')
        alert(`Failed to save all words:\n${errorMessages}`)
        return
      }

      // Save query only with successfully saved words
      const queryResponse = await fetch('/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          original: inputText,
          translated: translation.translated,
          words: successfulSaves.map((s) => s.word.word),
        }),
      })

      if (!queryResponse.ok) {
        throw new Error('Failed to save query')
      }

      // Update progress in localStorage with actual saved count
      if (typeof window !== 'undefined') {
        const { updateStreak, incrementWordsLearned, incrementQueries } = await import('@/lib/storage')
        updateStreak()
        incrementWordsLearned(successfulSaves.length)
        incrementQueries()
      }

      // Show appropriate message based on results
      if (failedSaves.length > 0) {
        alert(`Saved ${successfulSaves.length} of ${translation.words.length} word(s). Some words failed to save.`)
      } else {
        alert(`Saved ${successfulSaves.length} word(s)!`)
      }
    } catch (error) {
      console.error('Save error:', error)
      alert(`Failed to save words: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTranscript = (text: string) => {
    setInputText(text)
    handleTranslate(text)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Codeswitching Learning</h1>
          <Link href="/learn">
            <Button variant="outline">Learning Dashboard</Button>
          </Link>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Translate Mixed Chinese/English</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Type or say: 'ni hao my name is li hua'"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleTranslate(inputText)
                  }
                }}
                className="flex-1"
              />
              <Button
                onClick={() => handleTranslate(inputText)}
                disabled={loading || !inputText.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Translating...
                  </>
                ) : (
                  'Translate'
                )}
              </Button>
            </div>

            <div className="flex justify-center">
              <AudioInput onTranscript={handleTranscript} disabled={loading} />
            </div>
          </CardContent>
        </Card>

        {translation && (
          <>
            <TranslationDisplay
              original={inputText}
              translation={translation}
              loading={loading}
              onPlayAudio={handlePlayAudio}
            />

            {translation.words && translation.words.length > 0 && (
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleSaveWords}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Words
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}
