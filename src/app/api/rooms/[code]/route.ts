import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const supabase = await createServerSupabaseClient()

  const { data: room, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error || !room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 })
  }

  const { data: participants } = await supabase
    .from('participants')
    .select('id, room_id, joined_at, nickname')
    .eq('room_id', room.id)
    .order('joined_at', { ascending: true })

  return NextResponse.json({ room, participants })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const { host_session, status } = await req.json()
  const supabase = await createServerSupabaseClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (!room) {
    return NextResponse.json({ error: '방을 찾을 수 없습니다' }, { status: 404 })
  }

  if (room.host_session !== host_session) {
    return NextResponse.json({ error: '호스트만 방을 종료할 수 있습니다' }, { status: 403 })
  }

  const { data: updated, error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', room.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ room: updated })
}
