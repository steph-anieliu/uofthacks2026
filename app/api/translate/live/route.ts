import { NextRequest } from 'next/server'
import { translateWithStreaming } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { text, originalLanguage = 'zh', targetLanguage = 'en' } = body

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!['zh', 'en', 'fr'].includes(originalLanguage) || !['zh', 'en', 'fr'].includes(targetLanguage)) {
      return new Response(
        JSON.stringify({ error: 'originalLanguage and targetLanguage must be "zh", "en", or "fr"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create a readable stream for SSE (Server-Sent Events)
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let accumulatedResponse = ''
          let finalResult: any = null
          
          finalResult = await translateWithStreaming(
            text,
            originalLanguage,
            targetLanguage,
            (chunk: string) => {
              accumulatedResponse += chunk
              // Send chunk to client (raw text chunks for incremental display)
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ chunk, type: 'partial' })}\n\n`))
            }
          )

          // Send final complete parsed response
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, type: 'complete', result: finalResult })}\n\n`))
          controller.close()
        } catch (error) {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to translate' })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Live translation error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to translate' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
