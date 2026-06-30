'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomData, getSessionToken, clearRoomData } from '@/lib/session'
import { createClient } from '@/lib/supabase/client'
import { Participant, Reaction, NotificationRound } from '@/lib/supabase/types'

interface ResultData {
  participants: Participant[]
  reactions: Reaction[]
  rounds: NotificationRound[]
  endVoteCounts: Record<string, number>
}

const STAR_BUCKET_MS = 30 * 60 * 1000

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

    const supabase = createClient()
    const channel = supabase
      .channel('result-end-votes-' + roomData.roomId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'end_votes', filter: `room_id=eq.${roomData.roomId}` },
        (payload) => {
          const votedForId = (payload.new as { voted_for_id: string }).voted_for_id
          setData(prev => {
            if (!prev) return prev
            const updated = { ...prev.endVoteCounts }
            updated[votedForId] = (updated[votedForId] ?? 0) + 1
            return { ...prev, endVoteCounts: updated }
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
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
    if (res.ok) { setVoted(participantId) }
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

  // 30-minute bucket bar chart for star ratings
  const starReactionsAll = data.reactions.filter(r => r.type === 'star' && r.value && r.created_at)
  const starBuckets: { label: string; avg: number; count: number }[] = []
  if (starReactionsAll.length > 0) {
    const times = starReactionsAll.map(r => new Date(r.created_at!).getTime())
    const minTime = Math.min(...times)
    const bucketStart = Math.floor(minTime / STAR_BUCKET_MS) * STAR_BUCKET_MS
    const maxTime = Math.max(...times)
    const bucketCount = Math.floor((maxTime - bucketStart) / STAR_BUCKET_MS) + 1
    for (let i = 0; i < bucketCount; i++) {
      const bStart = bucketStart + i * STAR_BUCKET_MS
      const bEnd = bStart + STAR_BUCKET_MS
      const inBucket = starReactionsAll.filter(r => {
        const t = new Date(r.created_at!).getTime()
        return t >= bStart && t < bEnd
      })
      if (inBucket.length > 0) {
        const avg = inBucket.reduce((a, r) => a + (r.value ?? 0), 0) / inBucket.length
        const d = new Date(bStart)
        const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
        starBuckets.push({ label, avg, count: inBucket.length })
      }
    }
  }
  const maxBucketAvg = starBuckets.length > 0 ? Math.max(...starBuckets.map(b => b.avg)) : 5

  const seeAgainTop = Object.entries(data.endVoteCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([id, count]) => ({ participant: data.participants.find(p => p.id === id), count }))
    .filter(x => x.participant)

  const others = data.participants.filter(p => p.id !== roomData.participantId)
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  const totalHearts = data.reactions.filter(r => r.type === 'heart').length
  const avgMood = starReactionsAll.length > 0 ? starReactionsAll.reduce((a, r) => a + (r.value ?? 0), 0) / starReactionsAll.length : null

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
            { e: '⭐', v: avgMood !== null ? avgMood.toFixed(1) : '-', l: '평균 만족도', c: '#fbbf24' },
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
                {p!.id === roomData.participantId ? roomData.nickname + ' (나)' : '누군가'}
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
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>시간별 만족도</h2>
          </div>
          {starBuckets.length === 0 ? (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '16px 0', color: 'var(--muted2)' }}>투표 기록이 없어요</p>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 100, paddingBottom: 24, position: 'relative' }}>
              {starBuckets.map((bucket, i) => {
                const heightPct = (bucket.avg / Math.max(maxBucketAvg, 5)) * 100
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#fbbf24' }}>{bucket.avg.toFixed(1)}</span>
                    <div style={{ width: '100%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(180deg, #fbbf24, #f59e0b)', height: `${heightPct}%`, minHeight: 4, transition: 'height 0.5s ease' }} />
                    <span style={{ fontSize: 9, color: 'var(--muted2)', position: 'absolute', bottom: 0, whiteSpace: 'nowrap' }}>{bucket.label}</span>
                  </div>
                )
              })}
            </div>
          )}
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
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>누군가</span>
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
                  <span style={{ flex: 1 }}>{p!.id === roomData.participantId ? '나' : '누군가'}</span>
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
