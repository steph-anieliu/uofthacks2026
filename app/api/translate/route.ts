import { NextRequest, NextResponse } from 'next/server'
import { translateWithCodeswitching, translateWithStreaming } from '@/lib/gemini'

export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:4',message:'POST /api/translate entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json()
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:9',message:'Request body received',data:{bodyKeys:Object.keys(body),originalLanguageInBody:body.originalLanguage,targetLanguageInBody:body.targetLanguage,bodyString:JSON.stringify(body)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    const { text, originalLanguage = 'zh', targetLanguage = 'en', fastMode = true, stream = false } = body
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:12',message:'Request parsed with defaults',data:{textLength:text?.length||0,originalLanguage,targetLanguage,fastMode,stream,expectedDirection:`${originalLanguage}->${targetLanguage}`,usedDefaults:!body.originalLanguage||!body.targetLanguage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    if (!['zh', 'en', 'fr'].includes(originalLanguage) || !['zh', 'en', 'fr'].includes(targetLanguage)) {
      return NextResponse.json(
        { error: 'originalLanguage and targetLanguage must be "zh", "en", or "fr"' },
        { status: 400 }
      )
    }

    // If streaming is requested, return SSE stream
    if (stream && fastMode) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:25',message:'Starting streaming mode',data:{textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,D,F'})}).catch(()=>{});
      // #endregion
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            let accumulatedResponse = ''
            let finalResult: any = null
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:30',message:'Stream start: calling translateWithStreaming',data:{textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,E'})}).catch(()=>{});
            // #endregion
            
            finalResult = await translateWithStreaming(
              text,
              originalLanguage,
              targetLanguage,
              (chunk: string) => {
                accumulatedResponse += chunk
                // Send chunk to client for incremental display
                controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ chunk, type: 'partial' })}\n\n`))
              }
            )

            // Send final complete parsed response
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:44',message:'Stream: sending final result',data:{hasResult:!!finalResult,hasTranslated:!!finalResult?.translated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, type: 'complete', result: finalResult })}\n\n`))
            controller.close()
          } catch (error) {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:47',message:'Stream error in controller',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
            // #endregion
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to translate' })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Non-streaming mode (default for backward compatibility)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:65',message:'Non-streaming mode: calling translateWithCodeswitching',data:{textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,E'})}).catch(()=>{});
    // #endregion
    const result = await translateWithCodeswitching(text, originalLanguage, targetLanguage, { fastMode })
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:68',message:'Non-streaming mode: result received',data:{hasResult:!!result,hasTranslated:!!result?.translated},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
    // #endregion
    
    return NextResponse.json(result)
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/translate/route.ts:72',message:'Translation route error caught',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('Translation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to translate' },
      { status: 500 }
    )
  }
}
