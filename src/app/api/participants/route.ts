import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const { participant_id, session_token } = await req.json()
  if (!participant_id || !session_token) {
    return NextResponse.json({ error: 'missing fields' }, { status: 400 })
  }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase
    .from('participants')
    .delete()
    .eq('id', participant_id)
    .eq('session_token', session_token)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
