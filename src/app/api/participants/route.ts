import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const text = await req.text()
  let participant_id: string, session_token: string
  try {
    const parsed = JSON.parse(text)
    participant_id = parsed.participant_id
    session_token = parsed.session_token
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 })
  }

  if (!participant_id || !session_token) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participant_id)
    .eq('session_token', session_token)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
