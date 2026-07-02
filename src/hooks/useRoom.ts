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
  heartCounts: Record<string, number>    // receiver_id → count
  notification: { type: 'round'; round: number } | null
}

interface ReactionSummary {
  heart_counts: Record<string, number>
  warning_counts: Record<string, number>
  mood_averages: Record<string, number>
  total_reactions: number
}

export function useRoom(roomId: string, roomCode: string, onRoomEnded?: () => void) {
  const [state, setState] = useState<RoomState>({
    participants: [],
    reactions: [],
    currentRound: 1,
    rounds: [],
    warningCounts: {},
    moodAverages: {},
    heartCounts: {},
    notification: null,
  })
  const supabase = createClient()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roomData = getRoomData()
  const onRoomEndedRef = useRef(onRoomEnded)
  useEffect(() => { onRoomEndedRef.current = onRoomEnded }, [onRoomEnded])

  // 최초 접속 시 1번만 호출되는 전체 데이터 부트스트랩 (원본 reactions 전부 포함).
  // 이후 실시간 갱신은 realtime 구독 + 아래의 가벼운 재조회(fetchSummary)가 담당한다.
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

    const warningCounts: Record<string, number> = {}
    const heartCounts: Record<string, number> = {}
    reactions.forEach(r => {
      if (r.type === 'warning') warningCounts[r.receiver_id] = (warningCounts[r.receiver_id] ?? 0) + 1
      if (r.type === 'heart') heartCounts[r.receiver_id] = (heartCounts[r.receiver_id] ?? 0) + 1
    })

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
      heartCounts,
    }))
  }, [roomId, roomCode])

  // 3초마다 도는 가벼운 재조회: 전체 reactions를 다시 받는 대신, DB가 미리 집계한
  // 요약치(하트/경고 수, 평균 별점)와 HOT 탭만 새로 받아온다. 파티가 길어져 reactions가
  // 아무리 쌓여도 이 폴링 비용은 커지지 않는다. (하트/경고 등 원본 리액션의 세부 내역은
  // realtime 구독으로 실시간 갱신되며, 이 재조회는 realtime이 놓친 참여자/HOT 지수/집계치만 복구한다)
  const fetchSummary = useCallback(async () => {
    const [pRes, sRes, hRes, nRes] = await Promise.all([
      fetch(`/api/rooms/${roomCode}`),
      fetch(`/api/reactions/summary?room_id=${roomId}`),
      fetch(`/api/reactions?room_id=${roomId}&type=hot`),
      fetch(`/api/notification-rounds?room_id=${roomId}`),
    ])

    const pData = await pRes.json()
    const sData = await sRes.json()
    const hData = await hRes.json()
    const nData = await nRes.json()

    const summary: ReactionSummary | undefined = sData.summary
    const hotReactions: Reaction[] = hData.reactions ?? []
    const rounds: NotificationRound[] = nData.rounds ?? []
    const currentRound = rounds.length > 0 ? Math.max(...rounds.map((r) => r.round_number)) : 1

    setState(prev => {
      const nonHotReactions = prev.reactions.filter(r => r.type !== 'hot')
      return {
        ...prev,
        participants: pData.participants ?? prev.participants,
        reactions: [...nonHotReactions, ...hotReactions],
        rounds,
        currentRound,
        warningCounts: summary?.warning_counts ?? prev.warningCounts,
        heartCounts: summary?.heart_counts ?? prev.heartCounts,
        moodAverages: summary
          ? Object.fromEntries(Object.entries(summary.mood_averages).map(([k, v]) => [Number(k), v]))
          : prev.moodAverages,
      }
    })
  }, [roomId, roomCode])

  // 1시간 타이머
  const startRoundTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(async () => {
      setState(prev => {
        const nextRound = prev.currentRound + 1
        // 새 라운드 저장
        fetch('/api/notification-rounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: roomId, round_number: nextRound }),
        })
        // 진동
        if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
        return { ...prev, currentRound: nextRound, notification: { type: 'round', round: nextRound } }
      })
    }, 60 * 60 * 1000) // 1시간
  }, [roomId])

  // Realtime 구독이 놓친 이벤트를 주기적으로 재조회해 복구한다
  // (예: 참여자가 나갔다 들어왔을 때 그 사이의 소켓 재연결 타이밍에 이벤트가 누락될 수 있음)
  useEffect(() => {
    const reconcileTimer = setInterval(() => { fetchSummary() }, 3_000)
    return () => clearInterval(reconcileTimer)
  }, [fetchSummary])

  useEffect(() => {
    fetchInitial()
    startRoundTimer()

    // Realtime 구독
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
            const heartCounts = { ...prev.heartCounts }
            if (safeReaction.type === 'warning') {
              warningCounts[safeReaction.receiver_id] = (warningCounts[safeReaction.receiver_id] ?? 0) + 1
            }
            if (safeReaction.type === 'heart') {
              heartCounts[safeReaction.receiver_id] = (heartCounts[safeReaction.receiver_id] ?? 0) + 1
            }
            const moodAverages = { ...prev.moodAverages }
            if (safeReaction.type === 'star' && safeReaction.value) {
              const roundStars = reactions.filter(rx => rx.type === 'star' && rx.round === safeReaction.round)
              const vals = roundStars.map(rx => rx.value!).filter(Boolean)
              moodAverages[safeReaction.round] = vals.reduce((a, b) => a + b, 0) / vals.length
            }
            return { ...prev, reactions, warningCounts, heartCounts, moodAverages }
          })

          // 수신자에게 알림
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
    type: 'heart' | 'warning' | 'star' | 'hot',
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
