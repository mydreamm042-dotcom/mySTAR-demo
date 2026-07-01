import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getRoomData, getSessionToken } from '@/lib/session'
import { Participant, Reaction } from '@/lib/supabase/types'

interface RoomState {
  participants: Participant[]
  reactions: Reaction[]
  warningCounts: Record<string, number>
  moodAverages: Record<number, number>
  currentRound: number
  roomStatus: 'active' | 'ended' | null
  notification: { round: number } | null
}

export function useRoom(
  roomId: string,
  code: string,
  onRoomEnded: () => void,
) {
  const [state, setState] = useState<RoomState>({
    participants: [],
    reactions: [],
    warningCounts: {},
    moodAverages: {},
    currentRound: 1,
    roomStatus: null,
    notification: null,
  })

  const onRoomEndedRef = useRef(onRoomEnded)
  onRoomEndedRef.current = onRoomEnded

  const fetchInitial = useCallback(async () => {
    if (!roomId) return
    const [rRes, rxRes] = await Promise.all([
      fetch('/api/rooms/' + code),
      fetch('/api/reactions?room_id=' + roomId),
    ])
    const rData = await rRes.json()
    const rxData = await rxRes.json()

    const participants: Participant[] = rData.participants ?? []
    const reactions: Reaction[] = rxData.reactions ?? []
    const room = rData.room

    const warningCounts: Record<string, number> = {}
    reactions.filter((r: Reaction) => r.type === 'warning').forEach((r: Reaction) => {
      warningCounts[r.receiver_id] = (warningCounts[r.receiver_id] ?? 0) + 1
    })

    const moodAverages: Record<number, number> = {}
    const starReactions = reactions.filter((r: Reaction) => r.type === 'star' && r.value)
    const rounds = [...new Set(starReactions.map((r: Reaction) => r.round))]
    rounds.forEach(round => {
      const roundStars = starReactions.filter((r: Reaction) => r.round === round)
      moodAverages[round] = roundStars.reduce((a: number, r: Reaction) => a + (r.value ?? 0), 0) / roundStars.length
    })

    setState(prev => ({
      ...prev,
      participants,
      reactions,
      warningCounts,
      moodAverages,
      currentRound: room?.current_round ?? 1,
      roomStatus: room?.status ?? null,
    }))

    if (room?.status === 'ended') {
      onRoomEndedRef.current()
    }
  }, [roomId, code])

  useEffect(() => {
    if (!roomId) return
    fetchInitial()

    const supabase = createClient()
    const roomData = getRoomData()

    const channel = supabase
      .channel('room-' + roomId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, (payload) => {
        setState(prev => ({ ...prev, participants: [...prev.participants, payload.new as Participant] }))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` }, (payload) => {
        setState(prev => ({ ...prev, participants: prev.participants.filter(p => p.id !== (payload.old as Participant).id) }))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `room_id=eq.${roomId}` }, (payload) => {
        const r = payload.new as Reaction
        setState(prev => {
          const reactions = [r, ...prev.reactions]
          const warningCounts = { ...prev.warningCounts }
          if (r.type === 'warning') {
            warningCounts[r.receiver_id] = (warningCounts[r.receiver_id] ?? 0) + 1
          }
          const moodAverages = { ...prev.moodAverages }
          if (r.type === 'star' && r.value) {
            const roundStars = reactions.filter(rx => rx.type === 'star' && rx.round === r.round && rx.value)
            moodAverages[r.round] = roundStars.reduce((a, rx) => a + (rx.value ?? 0), 0) / roundStars.length
          }
          return { ...prev, reactions, warningCounts, moodAverages }
        })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, (payload) => {
        const room = payload.new
        setState(prev => ({ ...prev, roomStatus: room.status, currentRound: room.current_round ?? prev.currentRound }))
        if (room.status === 'ended') {
          onRoomEndedRef.current()
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_rounds', filter: `room_id=eq.${roomId}` }, (payload) => {
        const nr = payload.new
        setState(prev => ({ ...prev, currentRound: nr.round_number, notification: { round: nr.round_number } }))
      })
      .subscribe()

    const pollInterval = setInterval(async () => {
      if (!roomData) return
      const res = await fetch('/api/rooms/' + code)
      const data = await res.json()
      if (data.room?.status === 'ended') {
        onRoomEndedRef.current()
      }
    }, 5000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(pollInterval)
    }
  }, [roomId, code, fetchInitial])

  const sendReaction = useCallback(async (
    receiver_id: string,
    type: 'heart' | 'warning' | 'star' | 'hot',
    value?: number
  ) => {
    const sender_session = getSessionToken()
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id, type, value, sender_session }),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.error ?? '오류', warningCount: 0 }
    return { error: undefined, warningCount: data.warningCount ?? 0, isMutual: data.isMutual ?? false }
  }, [])

  const dismissNotification = useCallback(() => {
    setState(prev => ({ ...prev, notification: null }))
  }, [])

  return { state, sendReaction, dismissNotification, refetch: fetchInitial }
}
