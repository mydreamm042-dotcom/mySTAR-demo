import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const room_id = searchParams.get('room_id')
  const my_session = searchParams.get('my_session')
  const my_participant_id = searchParams.get('my_participant_id')
  const just_received_from = searchParams.get('just_received_from')

  if (!room_id || !my_session || !my_participant_id || !just_received_from) {
    return NextResponse.json({ isNewMutual: false })
  }

  const supabase = await createServerSupabaseClient()

  const { data: partner } = await supabase
    .from('participants').select('session_token')
    .eq('id', just_received_from).single()

  if (!partner) return NextResponse.json({ isNewMutual: false })

  const { data: mySent } = await supabase
    .from('reactions').select('id')
    .eq('room_id', room_id).eq('sender_session', my_session)
    .eq('receiver_id', just_received_from).eq('type', 'heart')

  const { data: theirSent } = await supabase
    .from('reactions').select('id')
    .eq('room_id', room_id).eq('sender_session', partner.session_token)
    .eq('receiver_id', my_participant_id).eq('type', 'heart')

  const myCount = mySent?.length ?? 0
  const theirCount = theirSent?.length ?? 0

  const isNewMutual = myCount > 0 && theirCount > 0 && myCount >= theirCount

  return NextResponse.json({ isNewMutual })
}
