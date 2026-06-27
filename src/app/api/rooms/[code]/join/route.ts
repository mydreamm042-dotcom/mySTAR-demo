import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { nickname, session_token } = await req.json()

  if (!nickname || !session_token) {
    return NextResponse.json({ error: '닉네임과 세션이 필요합니다' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 })
  }

  if (room.status === 'ended') {
    return NextResponse.json({ error: '이미 종료된 방입니다' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('participants')
    .select('*')
    .eq('room_id', room.id)
    .eq('session_token', session_token)
    .single()

  if (existing) {
    return NextResponse.json({ room, participant: existing })
  }

  const { data: participant, error } = await supabase
    .from('participants')
    .insert({ room_id: room.id, nickname, session_token })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ room, participant })
}
