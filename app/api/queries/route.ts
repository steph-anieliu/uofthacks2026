import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { Query } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const db = await getDb()
    const queries = await db.collection<Query>('queries')
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray()
    
    return NextResponse.json(queries)
  } catch (error) {
    console.error('Error fetching queries:', error)
    return NextResponse.json(
      { error: 'Failed to fetch queries' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const query: Omit<Query, '_id'> = {
      original: body.original,
      translated: body.translated,
      words: body.words || [],
      timestamp: new Date(),
    }

    const db = await getDb()
    const queries = db.collection<Query>('queries')
    const result = await queries.insertOne(query as Query)
    const insertedQuery = await queries.findOne({ _id: result.insertedId })
    
    return NextResponse.json(insertedQuery, { status: 201 })
  } catch (error) {
    console.error('Error saving query:', error)
    return NextResponse.json(
      { error: 'Failed to save query' },
      { status: 500 }
    )
  }
}
