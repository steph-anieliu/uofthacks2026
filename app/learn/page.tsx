'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Flashcard } from '@/components/Flashcard'
import { ProgressStats } from '@/components/ProgressStats'
import { WordCard } from '@/components/WordCard'
import { Word } from '@/types'
import { Trash2, Search } from 'lucide-react'
import Link from 'next/link'

export default function LearnPage() {
  const [words, setWords] = useState<Word[]>([])
  const [filteredWords, setFilteredWords] = useState<Word[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWords()
  }, [])

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = words.filter(
        (word) =>
          word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
          word.pinyin.toLowerCase().includes(searchQuery.toLowerCase()) ||
          word.english.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredWords(filtered)
    } else {
      setFilteredWords(words)
    }
  }, [searchQuery, words])

  // Ensure currentIndex is always valid when filteredWords changes
  useEffect(() => {
    if (filteredWords.length === 0) {
      setCurrentIndex(0)
    } else if (currentIndex >= filteredWords.length) {
      setCurrentIndex(Math.max(0, filteredWords.length - 1))
    }
  }, [filteredWords, currentIndex])

  const fetchWords = async () => {
    try {
      const response = await fetch('/api/words')
      if (response.ok) {
        const data = await response.json()
        setWords(data)
        setFilteredWords(data)
      }
    } catch (error) {
      console.error('Error fetching words:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteWord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this word?')) return

    try {
      const response = await fetch(`/api/words?id=${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const updatedWords = words.filter((w) => w._id !== id)
        setWords(updatedWords)
        
        // Find the index of the deleted word in filteredWords
        const deletedIndex = filteredWords.findIndex((w) => w._id === id)
        
        // Adjust currentIndex based on the deletion
        if (deletedIndex !== -1) {
          if (filteredWords.length === 1) {
            // Deleting the last/only item, reset to 0
            setCurrentIndex(0)
          } else if (currentIndex >= deletedIndex) {
            // If we're at or after the deleted index, move back
            setCurrentIndex(Math.max(0, currentIndex - 1))
          }
          // If currentIndex < deletedIndex, no change needed
        }
      }
    } catch (error) {
      console.error('Error deleting word:', error)
      alert('Failed to delete word')
    }
  }

  const currentWord = filteredWords[currentIndex]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Learning Dashboard</h1>
          <Link href="/">
            <Button variant="outline">Back to Translation</Button>
          </Link>
        </div>

        <ProgressStats />

        <Tabs defaultValue="flashcards" className="mt-8">
          <TabsList>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="words">All Words</TabsTrigger>
          </TabsList>

          <TabsContent value="flashcards" className="mt-6">
            {loading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    Loading words...
                  </div>
                </CardContent>
              </Card>
            ) : filteredWords.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    {words.length === 0
                      ? 'No words learned yet. Start translating to save words!'
                      : 'No words match your search.'}
                  </div>
                </CardContent>
              </Card>
            ) : currentWord ? (
              <div className="max-w-2xl mx-auto">
                <div className="mb-4 text-center text-sm text-muted-foreground">
                  Card {currentIndex + 1} of {filteredWords.length}
                </div>
                <Flashcard
                  word={currentWord}
                  onNext={() =>
                    setCurrentIndex((prev) =>
                      Math.min(prev + 1, filteredWords.length - 1)
                    )
                  }
                  onPrevious={() =>
                    setCurrentIndex((prev) => Math.max(prev - 1, 0))
                  }
                  hasNext={currentIndex < filteredWords.length - 1}
                  hasPrevious={currentIndex > 0}
                />
              </div>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    No word available at this index.
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="words" className="mt-6">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search words, pinyin, or English..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {loading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    Loading words...
                  </div>
                </CardContent>
              </Card>
            ) : filteredWords.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    {words.length === 0
                      ? 'No words learned yet. Start translating to save words!'
                      : 'No words match your search.'}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWords.map((word) => (
                  <div key={word._id} className="relative group">
                    <WordCard word={word} />
                    {word._id && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteWord(word._id!)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
