import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { Word } from '@/types'
import { ObjectId } from 'mongodb'

export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const words = await db.collection<Word>('words')
      .find({})
      .sort({ learnedAt: -1 })
      .toArray()
    
    return NextResponse.json(words)
  } catch (error) {
    console.error('Error fetching words:', error)
    return NextResponse.json(
      { error: 'Failed to fetch words' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const word: Omit<Word, '_id'> = {
      word: body.word,
      pinyin: body.pinyin,
      english: body.english,
      explanation: body.explanation || '',
      learnedAt: new Date(),
      reviewCount: 0,
      lastReviewed: new Date(),
      mastery: 0,
    }

    const db = await getDb()
    const words = db.collection<Word>('words')
    
    // Check if word already exists
    const existing = await words.findOne({ word: word.word })
    if (existing) {
      return NextResponse.json(existing)
    }

    const result = await words.insertOne(word as Word)
    const insertedWord = await words.findOne({ _id: result.insertedId })
    
    return NextResponse.json(insertedWord, { status: 201 })
  } catch (error) {
    console.error('Error saving word:', error)
    return NextResponse.json(
      { error: 'Failed to save word' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Word ID is required' },
        { status: 400 }
      )
    }

    const db = await getDb()
    const words = db.collection<Word>('words')
    const result = await words.deleteOne({ _id: new ObjectId(id) })

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Word not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting word:', error)
    return NextResponse.json(
      { error: 'Failed to delete word' },
      { status: 500 }
    )
  }
}
