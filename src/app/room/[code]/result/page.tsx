'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomData, getSessionToken, clearRoomData } from '@/lib/session'
import { Participant, Reaction, NotificationRound } from '@/lib/supabase/types'

interface ResultData {
  participants: Participant[]
  reactions: Reaction[]
  rounds: NotificationRound[]
  endVoteCounts: Record<string, number>
}

export default function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const roomData = getRoomData()
  const [data, setData] = useState<ResultData | null>(null)
  const [voted, setVoted] = useState<string | null>(null)
  const [votingSending, setVotingSending] = useState(false)

  useEffect(() => {
    if (!roomData) { router.replace('/'); return }
    fetchResult()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchResult = async () => {
    const [rRes, rxRes, nRes, evRes] = await Promise.all([
      fetch(`/api/rooms/${code}`),
      fetch(`/api/reactions?room_id=${roomData!.roomId}`),
      fetch(`/api/notification-rounds?room_id=${roomData!.roomId}`),
      fetch(`/api/end-votes?room_id=${roomData!.roomId}`),
    ])
    const rData = await rRes.json()
    const rxData = await rxRes.json()
    const nData = await nRes.json()
    const evData = await evRes.json()

    setData({
      participants: rData.participants ?? [],
      reactions: rxData.reactions ?? [],
      rounds: nData.rounds ?? [],
      endVoteCounts: evData.counts ?? {},
    })
  }

  const handleVote = async (participantId: string) => {
    if (voted || votingSending || !roomData) return
    setVotingSending(true)
    const res = await fetch('/api/end-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: roomData.roomId,
        voter_session: getSessionToken(),
        voted_for_id: participantId,
      }),
    })
    if (res.ok) {
      setVoted(participantId)
      fetchResult()
    }
    setVotingSending(false)
  }

  const handleLeave = () => {
    clearRoomData()
    router.replace('/')
  }

  if (!data || !roomData) {
    return (
      <main className="flex items-center justify-center min-h-dvh">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">⭐</div>
          <p style={{ color: '#6b7280' }}>결과 불러오는 중...</p>
        </div>
      </main>
    )
  }

  const heartCounts: Record<string, number> = {}
  data.reactions.filter(r => r.type === 'heart').forEach(r => {
    heartCounts[r.receiver_id] = (heartCounts[r.receiver_id] ?? 0) + 1
  })
  const heartTop3 = Object.entries(heartCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id, count]) => ({ participant: data.participants.find(p => p.id === id), count }))
    .filter(x => x.participant)

  const moodTimeline = data.rounds.map(round => {
    const stars = data.reactions.filter(r => r.type === 'star' && r.round === round.round_number)
    const avg = stars.length > 0 ? stars.reduce((a, r) => a + (r.value ?? 0), 0) / stars.length : null
    return { ...round, avg }
  })

  const seeAgainTop = Object.entries(data.endVoteCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({ participant: data.participants.find(p => p.id === id), count }))
    .filter(x => x.participant)

  const others = data.participants.filter(p => p.id !== roomData.participantId)

  return (
    <main className="flex flex-col min-h-dvh px-5 py-10">
      <div className="text-center mb-8 animate-fade-in">
        <div className="text-5xl mb-3">🎉</div>
        <h1 className="text-2xl font-bold">{roomData.roomName}</h1>
        <p className="text-sm mt-1" style={{ color: '#6b7280' }}>오늘 모임 결과</p>
      </div>

      <section className="glass-card p-5 mb-4 animate-fade-in">
        <h2 className="text-sm font-bold mb-4" style={{ color: '#f43f5e' }}>💖 오늘의 하트 Top 3</h2>
        {heartTop3.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: '#6b7280' }}>아직 하트가 없어요</p>
        ) : (
          <div className="space-y-3">
            {heartTop3.map(({ participant: p, count }, i) => (
              <div key={p!.id} className="flex items-center gap-3">
                <span className="text-xl w-8 text-center">{['🥇', '🥈', '🥉'][i]}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {p!.id === roomData.participantId ? `${roomData.nickname} (나)` : '누군가'}
                  </p>
                </div>
                <span className="text-sm font-bold" style={{ color: '#f43f5e' }}>💖 {count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card p-5 mb-4 animate-fade-in">
        <h2 className="text-sm font-bold mb-4" style={{ color: '#a78bfa' }}>⭐ 분위기 타임라인</h2>
        {moodTimeline.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: '#6b7280' }}>투표 기록이 없어요</p>
        ) : (
          <div className="space-y-3">
            {moodTimeline.map(round => (
              <div key={round.id} className="flex items-center gap-3">
                <span className="text-xs w-16 flex-shrink-0" style={{ color: '#6b7280' }}>
                  Round {round.round_number}
                </span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  {round.avg !== null && (
                    <div className="h-full rounded-full"
                      style={{ width: `${(round.avg / 5) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
                  )}
                </div>
                <span className="text-sm font-bold w-8 text-right" style={{ color: '#a78bfa' }}>
                  {round.avg !== null ? `${round.avg.toFixed(1)}` : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card p-5 mb-6 animate-fade-in">
        <h2 className="text-sm font-bold mb-1" style={{ color: '#10b981' }}>🙋 다음에 또 보고 싶은 사람</h2>
        <p className="text-xs mb-4" style={{ color: '#6b7280' }}>익명 투표 · 1명 선택</p>

        {others.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: '#6b7280' }}>다른 참여자가 없어요</p>
        ) : (
          <div className="space-y-2">
            {others.map(p => {
              const voteCount = data.endVoteCounts[p.id] ?? 0
              const isVoted = voted === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => handleVote(p.id)}
                  disabled={!!voted || votingSending}
                  className="btn-touch w-full px-4"
                  style={{
                    background: isVoted ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${isVoted ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    justifyContent: 'space-between',
                    minHeight: '48px',
                  }}
                >
                  <span className="text-sm">누군가</span>
                  {voted && voteCount > 0 && (
                    <span className="text-sm font-bold" style={{ color: '#10b981' }}>🙋 {voteCount}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {voted && seeAgainTop.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-xs mb-2" style={{ color: '#6b7280' }}>투표 결과</p>
            {seeAgainTop.map(({ participant: p, count }, i) => (
              <div key={p!.id} className="flex items-center gap-2 text-sm py-1">
                <span>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                <span className="flex-1">{p!.id === roomData.participantId ? '나' : '누군가'}</span>
                <span style={{ color: '#10b981' }}>🙋 {count}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <button
        onClick={handleLeave}
        className="btn-touch w-full"
        style={{ background: 'rgba(255,255,255,0.06)', color: '#9ca3af', fontSize: '16px' }}
      >
        홈으로 돌아가기
      </button>
    </main>
  )
}
