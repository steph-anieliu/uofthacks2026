import { NextRequest, NextResponse } from 'next/server'
import { synthesizeSpeech } from '@/lib/elevenlabs'

export async function POST(request: NextRequest) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/synthesize/route.ts:4',message:'POST /api/synthesize entry',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  // #endregion
  try {
    const body = await request.json()
    const { text } = body

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/synthesize/route.ts:10',message:'Request body parsed',data:{hasText:!!text,textType:typeof text,textLength:text?.length||0,textPreview:text?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    if (!text || typeof text !== 'string') {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/synthesize/route.ts:14',message:'Text validation failed',data:{hasText:!!text,textType:typeof text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/synthesize/route.ts:21',message:'Before synthesizeSpeech',data:{textLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const audioBuffer = await synthesizeSpeech(text)
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/synthesize/route.ts:24',message:'After synthesizeSpeech',data:{bufferLength:audioBuffer?.length||0,hasBuffer:!!audioBuffer,isBuffer:Buffer.isBuffer(audioBuffer)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
    // #endregion
    
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      },
    })
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/3cbc9417-70a3-4ada-8e6c-18446bbb1bd6',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/synthesize/route.ts:35',message:'Synthesis error caught',data:{errorType:error?.constructor?.name,errorMessage:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack?.substring(0,300):undefined},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.error('Synthesis error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to synthesize speech' },
      { status: 500 }
    )
  }
}
