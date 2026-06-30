import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { ReactionType } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const { room_id, sender_session, receiver_id, type, value, round } = await req.json()

  if (!room_id || !sender_session || !receiver_id || !type) {
    return NextResponse.json({ error: '필수 파라미터가 누락됐습니다' }, { status: 400 })
  }

  const validTypes: ReactionType[] = ['heart', 'warning', 'star', 'hot']
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: '유효하지 않은 리액션 타입' }, { status: 400 })
  }

  if (type === 'star' && (value < 1 || value > 5)) {
    return NextResponse.json({ error: '별점은 1~5 사이여야 합니다' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  if (type !== 'hot' && type !== 'star') {
    const { data: selfCheck } = await supabase
      .from('participants').select('id')
      .eq('id', receiver_id).eq('session_token', sender_session).single()
    if (selfCheck) {
      return NextResponse.json({ error: '자기 자신에게는 보낼 수 없습니다' }, { status: 400 })
    }
  }

  if (type === 'warning') {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('reactions').select('id')
      .eq('room_id', room_id).eq('sender_session', sender_session)
      .eq('type', 'warning').gte('created_at', tenMinAgo).single()
    if (existing) {
      return NextResponse.json({ error: '자제 시그널은 10분마다 보낼 수 있어요!' }, { status: 400 })
    }
  }

  if (type === 'star') {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('reactions').select('id')
      .eq('room_id', room_id).eq('sender_session', sender_session)
      .eq('type', 'star').gte('created_at', thirtyMinAgo).single()
    if (existing) {
      return NextResponse.json({ error: '별점은 30분마다 투표할 수 있어요!' }, { status: 400 })
    }
  }

  const { data: senderParticipant } = await supabase
    .from('participants').select('id')
    .eq('room_id', room_id).eq('session_token', sender_session).single()
  const sender_participant_id = senderParticipant?.id ?? null

  const { data, error } = await supabase
    .from('reactions')
    .insert({ room_id, sender_session, sender_participant_id, receiver_id, type, value: value ?? null, round: round ?? 1 })
    .select('id, room_id, receiver_id, sender_participant_id, type, value, round, created_at')
    .single()

  if (error) {
    console.error('[reactions POST] supabase error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (type === 'heart') {
    const { data: receiverParticipant } = await supabase
      .from('participants').select('session_token')
      .eq('id', receiver_id).single()

    let isMutual = false
    if (receiverParticipant) {
      const { data: mySent } = await supabase
        .from('reactions').select('id')
        .eq('room_id', room_id).eq('sender_session', sender_session)
        .eq('receiver_id', receiver_id).eq('type', 'heart')

      const { data: theirSent } = await supabase
        .from('reactions').select('id')
        .eq('room_id', room_id).eq('sender_session', receiverParticipant.session_token)
        .eq('receiver_id', sender_participant_id).eq('type', 'heart')

      const myCount = mySent?.length ?? 0
      const theirCount = theirSent?.length ?? 0

      isMutual = theirCount > 0 && theirCount >= myCount
    }

    return NextResponse.json({ reaction: data, isMutual })
  }

  if (type === 'warning') {
    const { count } = await supabase
      .from('reactions').select('id', { count: 'exact' })
      .eq('room_id', room_id).eq('receiver_id', receiver_id).eq('type', 'warning')
    return NextResponse.json({ reaction: data, warningCount: count ?? 0 })
  }

  return NextResponse.json({ reaction: data })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')
  const round = searchParams.get('round')
  const type = searchParams.get('type')

  if (!room_id) {
    return NextResponse.json({ error: 'room_id가 필요합니다' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  let query = supabase
    .from('reactions')
    .select('id, room_id, receiver_id, sender_participant_id, type, value, round, created_at')
    .eq('room_id', room_id)

  if (round) query = query.eq('round', parseInt(round))
  if (type) query = query.eq('type', type as ReactionType)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reactions: data })
}
