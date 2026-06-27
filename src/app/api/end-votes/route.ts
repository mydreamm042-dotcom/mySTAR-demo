import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { room_id, voter_session, voted_for_id } = await req.json()

  if (!room_id || !voter_session || !voted_for_id) {
    return NextResponse.json({ error: '필수 파라미터가 누락됐습니다' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('end_votes')
    .insert({ room_id, voter_session, voted_for_id })
    .select('id, room_id, voted_for_id, created_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: '이미 투표했습니다' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ vote: data })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')

  if (!room_id) {
    return NextResponse.json({ error: 'room_id가 필요합니다' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('end_votes')
    .select('voted_for_id')
    .eq('room_id', room_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const counts: Record<string, number> = {}
  data.forEach(({ voted_for_id }) => {
    counts[voted_for_id] = (counts[voted_for_id] ?? 0) + 1
  })

  return NextResponse.json({ counts })
}
