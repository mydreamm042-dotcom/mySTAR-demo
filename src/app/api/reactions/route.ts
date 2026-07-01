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

  // 자기 자신에게 보내기 방지 (별점/HOT은 전체 대상이므로 제외)
  if (type !== 'star' && type !== 'hot') {
    const { data: selfCheck } = await supabase
      .from('participants')
      .select('id')
      .eq('id', receiver_id)
      .eq('session_token', sender_session)
      .single()

    if (selfCheck) {
      return NextResponse.json({ error: '자기 자신에게는 보낼 수 없습니다' }, { status: 400 })
    }
  }

  // 하트: 라운드당 1회 제한
  if (type === 'heart') {
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('room_id', room_id)
      .eq('sender_session', sender_session)
      .eq('type', 'heart')
      .eq('round', round)
      .single()

    if (existing) {
      return NextResponse.json({ error: '이 라운드에서 이미 하트를 보냈습니다' }, { status: 400 })
    }
  }

  // sender의 participant_id 조회 (쌍방 확인용)
  const { data: senderParticipant } = await supabase
    .from('participants')
    .select('id')
    .eq('room_id', room_id)
    .eq('session_token', sender_session)
    .single()
  const sender_participant_id = senderParticipant?.id ?? null

  const { data, error } = await supabase
    .from('reactions')
    .insert({ room_id, sender_session, receiver_id, type, value: value ?? null, round: round ?? 1, sender_participant_id })
    .select('id, room_id, receiver_id, sender_participant_id, type, value, round, created_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 자제 시그널이 3개 이상인지 확인
  if (type === 'warning') {
    const { count } = await supabase
      .from('reactions')
      .select('id', { count: 'exact' })
      .eq('room_id', room_id)
      .eq('receiver_id', receiver_id)
      .eq('type', 'warning')

    return NextResponse.json({ reaction: data, warningCount: count ?? 0 })
  }

  // 하트: 쌍방 호감 여부 계산 (서버에서 즉시 계산 — stale read 없음)
  if (type === 'heart' && sender_participant_id) {
    // 내가 상대에게 보낸 하트 수 (방금 것 포함)
    const { data: mySent } = await supabase
      .from('reactions')
      .select('id')
      .eq('room_id', room_id)
      .eq('sender_participant_id', sender_participant_id)
      .eq('receiver_id', receiver_id)
      .eq('type', 'heart')

    // 상대가 나에게 보낸 하트 수
    const { data: theirSent } = await supabase
      .from('reactions')
      .select('id')
      .eq('room_id', room_id)
      .eq('sender_participant_id', receiver_id)
      .eq('receiver_id', sender_participant_id)
      .eq('type', 'heart')

    const myCount = mySent?.length ?? 0
    const theirCount = theirSent?.length ?? 0

    // 쌍방 조건: 상대가 1개 이상 보냈고, 상대 횟수 >= 내 횟수
    const isMutual = theirCount > 0 && theirCount >= myCount

    return NextResponse.json({ reaction: data, isMutual })
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ reactions: data })
}
