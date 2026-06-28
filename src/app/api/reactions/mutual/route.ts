import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// 쓌방 호감 확인: 나가 하트를 보낸 사람 중 나에게도 하트를 보낸 사람 ID 조회
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')
  const my_session = searchParams.get('my_session')
  const my_participant_id = searchParams.get('my_participant_id')

  if (!room_id || !my_session || !my_participant_id) {
    return NextResponse.json({ mutualIds: [] })
  }

  const supabase = await createServerSupabaseClient()

  // 내가 하트 보낸 사람들
  const { data: mySent } = await supabase
    .from('reactions').select('receiver_id')
    .eq('room_id', room_id).eq('sender_session', my_session).eq('type', 'heart')

  if (!mySent || mySent.length === 0) return NextResponse.json({ mutualIds: [] })

  const sentToIds = mySent.map(r => r.receiver_id)

  // 그 사람들의 session_token 조회
  const { data: theirData } = await supabase
    .from('participants').select('id, session_token').in('id', sentToIds)

  if (!theirData || theirData.length === 0) return NextResponse.json({ mutualIds: [] })

  // 그 사람들이 나에게 하트를 보냈는지 확인
  const { data: received } = await supabase
    .from('reactions').select('sender_session')
    .eq('room_id', room_id).eq('receiver_id', my_participant_id).eq('type', 'heart')
    .in('sender_session', theirData.map(p => p.session_token))

  if (!received || received.length === 0) return NextResponse.json({ mutualIds: [] })

  const mutualSessions = new Set(received.map(r => r.sender_session))
  const mutualIds = theirData.filter(p => mutualSessions.has(p.session_token)).map(p => p.id)

  return NextResponse.json({ mutualIds })
}
