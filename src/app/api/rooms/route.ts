import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { generateRoomCode } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { name, host_session } = await req.json()

  if (!name || !host_session) {
    return NextResponse.json({ error: '방 이름과 세션이 필요합니다' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  let code = ''
  let attempts = 0
  while (attempts < 10) {
    code = generateRoomCode()
    const { data } = await supabase.from('rooms').select('id').eq('code', code).single()
    if (!data) break
    attempts++
  }

  const { data: room, error } = await supabase
    .from('rooms')
    .insert({ code, name, host_session, status: 'active' })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: participant, error: pError } = await supabase
    .from('participants')
    .insert({ room_id: room.id, nickname: '호스트', session_token: host_session })
    .select()
    .single()

  if (pError) {
    return NextResponse.json({ error: pError.message }, { status: 500 })
  }

  return NextResponse.json({ room, participant })
}
