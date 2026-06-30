import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')
  const my_session = searchParams.get('my_session')
  const my_participant_id = searchParams.get('my_participant_id')
  const just_sent_to = searchParams.get('just_sent_to') // 방금 내가 하트 보낸 상대 participant_id

  if (!room_id || !my_session || !my_participant_id) {
    return NextResponse.json({ mutualIds: [], isNewMutual: false })
  }

  const supabase = await createServerSupabaseClient()

  // just_sent_to 있으면: 내가 방금 보낸 상대와 하트 횟수가 같아졌는지 확인 (새 라운드 성립 여부)
  if (just_sent_to) {
    // 내가 상대에게 보낸 하트 수
    const { data: mySent } = await supabase
      .from('reactions').select('id', { count: 'exact' })
      .eq('room_id', room_id).eq('sender_session', my_session)
      .eq('receiver_id', just_sent_to).eq('type', 'heart')

    // 상대의 session_token 조회
    const { data: partner } = await supabase
      .from('participants').select('session_token')
      .eq('id', just_sent_to).single()

    if (!partner) return NextResponse.json({ mutualIds: [], isNewMutual: false })

    // 상대가 나에게 보낸 하트 수
    const { data: theirSent } = await supabase
      .from('reactions').select('id', { count: 'exact' })
      .eq('room_id', room_id).eq('sender_session', partner.session_token)
      .eq('receiver_id', my_participant_id).eq('type', 'heart')

    const myCount = mySent?.length ?? 0
    const theirCount = theirSent?.length ?? 0

    // 횟수가 같을 때만 새 라운드 성립 (내가 보내서 균형이 맞춰진 경우)
    const isNewMutual = myCount > 0 && theirCount > 0 && myCount === theirCount
    return NextResponse.json({ mutualIds: isNewMutual ? [just_sent_to] : [], isNewMutual })
  }

  // just_sent_to 없으면: 기존 로직 (내가 받았을 때 — 쌍방인 사람 목록 반환)
  const { data: mySent } = await supabase
    .from('reactions').select('receiver_id')
    .eq('room_id', room_id).eq('sender_session', my_session).eq('type', 'heart')

  if (!mySent || mySent.length === 0) return NextResponse.json({ mutualIds: [], isNewMutual: false })

  const sentToIds = mySent.map(r => r.receiver_id)

  const { data: theirData } = await supabase
    .from('participants').select('id, session_token').in('id', sentToIds)

  if (!theirData || theirData.length === 0) return NextResponse.json({ mutualIds: [], isNewMutual: false })

  const { data: received } = await supabase
    .from('reactions').select('sender_session')
    .eq('room_id', room_id).eq('receiver_id', my_participant_id).eq('type', 'heart')
    .in('sender_session', theirData.map(p => p.session_token))

  if (!received || received.length === 0) return NextResponse.json({ mutualIds: [], isNewMutual: false })

  const mutualSessions = new Set(received.map(r => r.sender_session))
  const mutualIds = theirData.filter(p => mutualSessions.has(p.session_token)).map(p => p.id)

  return NextResponse.json({ mutualIds, isNewMutual: mutualIds.length > 0 })
}
