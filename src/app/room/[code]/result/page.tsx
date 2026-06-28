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
      fetch('/api/rooms/' + code),
      fetch('/api/reactions?room_id=' + roomData!.roomId),
      fetch('/api/notification-rounds?room_id=' + roomData!.roomId),
      fetch('/api/end-votes?room_id=' + roomData!.roomId),
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
      body: JSON.stringify({ room_id: roomData.roomId, voter_session: getSessionToken(), voted_for_id: participantId }),
    })
    if (res.ok) { setVoted(participantId); fetchResult() }
    setVotingSending(false)
  }

  const handleLeave = () => { clearRoomData(); router.replace('/') }

  if (!data || !roomData) {
    return (
      <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
          <p style={{ color: 'var(--muted2)' }}>결과 불러오는 중...</p>
        </div>
      </main>
    )
  }

  const heartCounts: Record<string, number> = {}
  data.reactions.filter(r => r.type === 'heart').forEach(r => {
    heartCounts[r.receiver_id] = (heartCounts[r.receiver_id] ?? 0) + 1
  })
  const heartTop3 = Object.entries(heartCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 3)
    .map(([id, count]) => ({ participant: data.participants.find(p => p.id === id), count }))
    .filter(x => x.participant)

  const moodTimeline = data.rounds.map(round => {
    const stars = data.reactions.filter(r => r.type === 'star' && r.round === round.round_number)
    const avg = stars.length > 0 ? stars.reduce((a, r) => a + (r.value ?? 0), 0) / stars.length : null
    return { ...round, avg }
  })

  const seeAgainTop = Object.entries(data.endVoteCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([id, count]) => ({ participant: data.participants.find(p => p.id === id), count }))
    .filter(x => x.participant)

  const others = data.participants.filter(p => p.id !== roomData.participantId)
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  const totalHearts = data.reactions.filter(r => r.type === 'heart').length
  const starReactions = data.reactions.filter(r => r.type === 'star' && r.value)
  const avgMood = starReactions.length > 0 ? starReactions.reduce((a, r) => a + (r.value ?? 0), 0) / starReactions.length : null

  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 40 }}>
      <div style={{ padding: '52px 20px 24px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,107,107,0.08) 0%, transparent 100%)' }} className="animate-fade-in">
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>{roomData.roomName}</h1>
        <p style={{ fontSize: 14, color: 'var(--muted2)' }}>오늘 모임 결과</p>
      </div>

      <div style={{ padding: '0 20px', marginBottom: 20 }} className="animate-fade-in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { e: '👥', v: data.participants.length, l: '참여자', c: 'var(--text)' },
            { e: '💖', v: totalHearts, l: '하트', c: '#ff6b6b' },
            { e: '⭐', v: avgMood !== null ? avgMood.toFixed(1) : '-', l: '평균 분위기', c: '#fbbf24' },
          ].map(s => (
            <div key={s.l} className="card" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{s.e}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)' }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>💖</span>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#ff6b6b' }}>오늘의 하트 Top 3</h2>
          </div>
          {heartTop3.length === 0 ? (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '16px 0', color: 'var(--muted2)' }}>아직 하트가 없어요</p>
          ) : heartTop3.map(({ participant: p, count }, i) => (
            <div key={p!.id} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <span style={{ fontSize: 24, width: 32, textAlign: 'center' }}>{medals[i]}</span>
              <p style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
                {p!.id === roomData.participantId ? roomData.nickname + ' (나)' : p!.nickname}
              </p>
              <div style={{ background: 'rgba(255,107,107,0.12)', padding: '4px 12px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 14 }}>💖</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#ff6b6b' }}>{count}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>분위기 타임라인</h2>
          </div>
          {moodTimeline.length === 0 ? (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '16px 0', color: 'var(--muted2)' }}>투표 기록이 없어요</p>
          ) : moodTimeline.map(round => (
            <div key={round.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 12, width: 60, flexShrink: 0, color: 'var(--muted2)', fontWeight: 600 }}>Round {round.round_number}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                {round.avg !== null && (
                  <div style={{ height: '100%', borderRadius: 4, width: (round.avg / 5 * 100) + '%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }} />
                )}
              </div>
              <span style={{ fontSize: 14, fontWeight: 800, width: 36, textAlign: 'right', color: '#fbbf24' }}>
                {round.avg !== null ? round.avg.toFixed(1) : '-'}
              </span>
            </div>
          ))}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>🙋</span>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>다음에 또 보고 싶은 사람</h2>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 16 }}>익명 투표 · 1명 선택</p>
          {others.length === 0 ? (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '16px 0', color: 'var(--muted2)' }}>다른 참여자가 없어요</p>
          ) : others.map(p => {
            const voteCount = data.endVoteCounts[p.id] ?? 0
            const isVoted = voted === p.id
            return (
              <button key={p.id} onClick={() => handleVote(p.id)} disabled={!!voted || votingSending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 16px', borderRadius: 14, marginBottom: 8,
                  background: isVoted ? 'rgba(16,185,129,0.12)' : 'var(--card2)',
                  border: '1.5px solid ' + (isVoted ? 'rgba(16,185,129,0.4)' : 'var(--border)'),
                  cursor: voted ? 'default' : 'pointer',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>
                    {p.nickname[0] ?? '?'}
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{p.nickname}</span>
                </div>
                {voted && voteCount > 0 && (
                  <div style={{ background: 'rgba(16,185,129,0.15)', padding: '4px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 14 }}>🙋</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>{voteCount}</span>
                  </div>
                )}
              </button>
            )
          })}
          {voted && seeAgainTop.length > 0 && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 12, color: 'var(--muted2)', marginBottom: 10 }}>투표 결과</p>
              {seeAgainTop.map(({ participant: p, count }, i) => (
                <div key={p!.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14 }}>
                  <span>{medals[i]}</span>
                  <span style={{ flex: 1 }}>{p!.id === roomData.participantId ? roomData.nickname + ' (나)' : p!.nickname}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>🙋 {count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 20px 0' }}>
        <button className="btn btn-ghost" onClick={handleLeave} style={{ fontSize: 16 }}>
          홈으로 돌아가기
        </button>
      </div>
    </main>
  )
}
