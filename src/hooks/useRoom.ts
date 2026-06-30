'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Participant, Reaction, NotificationRound } from '@/lib/supabase/types'
import { getRoomData, getSessionToken } from '@/lib/session'

export interface RoomState {
  participants: Participant[]
  reactions: Reaction[]
  currentRound: number
  rounds: NotificationRound[]
  warningCounts: Record<string, number>  // receiver_id → count
  moodAverages: Record<number, number>   // round → average
  notification: { type: 'round'; round: number } | null
}

export function useRoom(roomId: string, roomCode: string, onRoomEnded?: () => void) {
  const [state, setState] = useState<RoomState>({
    participants: [],
    reactions: [],
    currentRound: 1,
    rounds: [],
    warningCounts: {},
    moodAverages: {},
    notification: null,
  })
  const supabase = createClient()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roomData = getRoomData()
  const onRoomEndedRef = useRef(onRoomEnded)
  useEffect(() => { onRoomEndedRef.current = onRoomEnded }, [onRoomEnded])

  const fetchInitial = useCallback(async () => {
    const [pRes, rRes, nRes] = await Promise.all([
      fetch(`/api/rooms/${roomCode}`),
      fetch(`/api/reactions?room_id=${roomId}`),
      fetch(`/api/notification-rounds?room_id=${roomId}`),
    ])

    const pData = await pRes.json()
    const rData = await rRes.json()
    const nData = await nRes.json()

    const reactions: Reaction[] = rData.reactions ?? []
    const rounds: NotificationRound[] = nData.rounds ?? []
    const currentRound = rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) : 1

    // 자제 시그널 집계
    const warningCounts: Record<string, number> = {}
    reactions.filter(r => r.type === 'warning').forEach(r => {
      warningCounts[r.receiver_id] = (warningCounts[r.receiver_id] ?? 0) + 1
    })

    // 분위기 평균 집계
    const moodAverages: Record<number, number> = {}
    const starsByRound: Record<number, number[]> = {}
    reactions.filter(r => r.type === 'star').forEach(r => {
      if (!starsByRound[r.round]) starsByRound[r.round] = []
      if (r.value) starsByRound[r.round].push(r.value)
    })
    Object.entries(starsByRound).forEach(([round, values]) => {
      moodAverages[Number(round)] = values.reduce((a, b) => a + b, 0) / values.length
    })

    setState(prev => ({
      ...prev,
      participants: pData.participants ?? [],
      reactions,
      currentRound,
      rounds,
      warningCounts,
      moodAverages,
    }))
  }, [roomId, roomCode])

  // 1시간 타이머
  const startRoundTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(async () => {
      setState(prev => {
        const nextRound = prev.currentRound + 1
        fetch('/api/notification-rounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: roomId, round_number: nextRound }),
        })
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
        return { ...prev, currentRound: nextRound, notification: { type: 'round', round: nextRound } }
      })
    }, 60 * 60 * 1000)
  }, [roomId])

  useEffect(() => {
    fetchInitial()
    startRoundTimer()

    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        (payload) => {
          setState(prev => ({ ...prev, participants: [...prev.participants, payload.new as Participant] }))
        }
      )
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'participants', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const deleted = payload.old as { id: string }
          setState(prev => ({ ...prev, participants: prev.participants.filter(p => p.id !== deleted.id) }))
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reactions', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const r = payload.new as Reaction & { sender_session: string }
          // sender_session 제거, sender_participant_id 유지
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { sender_session: _s, ...safeReaction } = r
          setState(prev => {
            const reactions = [...prev.reactions, safeReaction]
            const warningCounts = { ...prev.warningCounts }
            if (safeReaction.type === 'warning') {
              warningCounts[safeReaction.receiver_id] = (warningCounts[safeReaction.receiver_id] ?? 0) + 1
            }
            const moodAverages = { ...prev.moodAverages }
            if (safeReaction.type === 'star' && safeReaction.value) {
              const roundStars = reactions.filter(rx => rx.type === 'star' && rx.round === safeReaction.round)
              const vals = roundStars.map(rx => rx.value!).filter(Boolean)
              moodAverages[safeReaction.round] = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            return { ...prev, reactions, warningCounts, moodAverages }
          })

          const mySession = getSessionToken()
          const myParticipantId = roomData?.participantId
          if (safeReaction.receiver_id === myParticipantId) {
            if (safeReaction.type === 'heart') {
              if ('vibrate' in navigator) navigator.vibrate(300)
            }
            if (safeReaction.type === 'warning') {
              setState(prev => {
                const count = (prev.warningCounts[safeReaction.receiver_id] ?? 0)
                if (count >= 3 && 'vibrate' in navigator) navigator.vibrate([100, 50, 100, 50, 200])
                return prev
              })
            }
          }
          void mySession
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if ((payload.new as { status: string }).status === 'ended') {
            onRoomEndedRef.current?.()
          }
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notification_rounds', filter: `room_id=eq.${roomId}` },
        (payload) => {
          const round = payload.new as NotificationRound
          setState(prev => ({
            ...prev,
            rounds: [...prev.rounds, round],
            currentRound: round.round_number,
            notification: { type: 'round', round: round.round_number },
          }))
          if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const sendReaction = useCallback(async (
    receiver_id: string,
    type: 'heart' | 'warning' | 'star',
    value?: number
  ) => {
    const sender_session = getSessionToken()
    const res = await fetch('/api/reactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomId,
        sender_session,
        receiver_id,
        type,
        value,
        round: state.currentRound,
      }),
    })
    return res.json()
  }, [roomId, state.currentRound])

  const dismissNotification = useCallback(() => {
    setState(prev => ({ ...prev, notification: null }))
  }, [])

  return { state, sendReaction, dismissNotification, refetch: fetchInitial }
}
