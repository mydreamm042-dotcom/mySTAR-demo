import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// 수신자 입장에서 쌍방 여부 확인
// just_received_from: 방금 하트를 보낸 상대의 participant_id
// my_session: 나의 session_token (서버에서 participant_id 검증)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')
  const just_received_from = searchParams.get('just_received_from')
  const my_session = searchParams.get('my_session')

  if (!room_id || !just_received_from || !my_session) {
    return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // session_token으로 실제 participant 조회 (my_participant_id 클라이언트 신뢰 제거)
  const { data: me } = await supabase
    .from('participants')
    .select('id')
    .eq('room_id', room_id)
    .eq('session_token', my_session)
    .single()

  if (!me) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 })
  }

  const my_participant_id = me.id

  // 내가 상대에게 보낸 하트 수
  const { data: mySent } = await supabase
    .from('reactions')
    .select('id')
    .eq('room_id', room_id)
    .eq('sender_participant_id', my_participant_id)
    .eq('receiver_id', just_received_from)
    .eq('type', 'heart')

  // 상대가 나에게 보낸 하트 수 (방금 보낸 것 포함)
  const { data: theirSent } = await supabase
    .from('reactions')
    .select('id')
    .eq('room_id', room_id)
    .eq('sender_participant_id', just_received_from)
    .eq('receiver_id', my_participant_id)
    .eq('type', 'heart')

  const myCount = mySent?.length ?? 0
  const theirCount = theirSent?.length ?? 0

  // 상대가 방금 보냈으므로 상대가 "보낸 쪽". 내가 >= 상대면 내가 따라잡혀있는 것 = 통함
  const isNewMutual = myCount > 0 && theirCount > 0 && myCount >= theirCount

  return NextResponse.json({ isNewMutual, myCount, theirCount })
}
