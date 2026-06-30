'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomData, getSessionToken, clearRoomData } from '@/lib/session'
import { createClient } from '@/lib/supabase/client'
import { Room, Participant, Reaction, NotificationRound } from '@/lib/supabase/types'

interface ResultData {
  room: Room
  participants: Participant[]
  reactions: Reaction[]
  rounds: NotificationRound[]
  endVoteCounts: Record<string, number>
}

function fmt(d: Date) {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function fmtDuration(ms: number) {
  const min = Math.floor(ms / 60000)
  const h = Math.floor(min / 60)
  return h > 0 ? `${h}시간 ${min % 60}분` : `${min}분`
}

export default function ResultPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const roomData = getRoomData()
  const [data, setData] = useState<ResultData | null>(null)
  const [voted, setVoted] = useState<string | null>(null)
  const [votingSending, setVotingSending] = useState(false)

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
      room: rData.room,
      participants: rData.participants ?? [],
      reactions: rxData.reactions ?? [],
      rounds: nData.rounds ?? [],
      endVoteCounts: evData.counts ?? {},
    })
  }

  useEffect(() => {
    if (!roomData) { router.replace('/'); return }
    const savedVote = localStorage.getItem(`mystar_vote_${roomData.roomId}`)
    if (savedVote) setVoted(savedVote)
    fetchResult()

    const supabase = createClient()
    const channel = supabase
      .channel(`end_votes:${roomData.roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'end_votes', filter: `room_id=eq.${roomData.roomId}` },
        (payload) => {
          const row = payload.new as { voted_for_id: string }
          setData(prev => {
            if (!prev) return prev
            const updated = { ...prev.endVoteCounts }
            updated[row.voted_for_id] = (updated[row.voted_for_id] ?? 0) + 1
            return { ...prev, endVoteCounts: updated }
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVote = async (participantId: string) => {
    if (voted || votingSending || !roomData) return
    setVotingSending(true)
    const res = await fetch('/api/end-votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room_id: roomData.roomId, voter_session: getSessionToken(), voted_for_id: participantId }),
    })
    if (res.ok) {
      setVoted(participantId)
      localStorage.setItem(`mystar_vote_${roomData.roomId}`, participantId)
    }
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

  const seeAgainTop = Object.entries(data.endVoteCounts)
    .sort(([, a], [, b]) => b - a).slice(0, 5)
    .map(([id, count]) => ({ participant: data.participants.find(p => p.id === id), count }))
    .filter(x => x.participant)

  const others = data.participants.filter(p => p.id !== roomData.participantId)
  const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣']
  const totalHearts = data.reactions.filter(r => r.type === 'heart').length
  const starReactions = data.reactions.filter(r => r.type === 'star' && r.value)
  const avgMood = starReactions.length > 0 ? starReactions.reduce((a, r) => a + (r.value ?? 0), 0) / starReactions.length : null

  const roomStart = data.room ? new Date(data.room.created_at) : null
  const roomEnd = data.room?.ended_at ? new Date(data.room.ended_at) : null
  const durationMs = roomStart && roomEnd ? roomEnd.getTime() - roomStart.getTime() : null

  const timelineEvents = roomStart ? [
    { time: roomStart, label: '모임 시작', icon: '🎉', color: '#ff6b6b' },
    ...data.participants
      .slice().sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
      .map(p => ({ time: new Date(p.joined_at), label: `${p.id === roomData.participantId ? p.nickname + ' (나)' : p.nickname} 입장`, icon: '👤', color: 'var(--purple-light)' })),
    ...(roomEnd ? [{ time: roomEnd, label: `모임 종료${durationMs ? ' · ' + fmtDuration(durationMs) : ''}`, icon: '🏁', color: 'var(--muted2)' }] : []),
  ].sort((a, b) => a.time.getTime() - b.time.getTime()) : []

  const HOT_BUCKET_MS = 10 * 60 * 1000
  const hotReactions = data.reactions
    .filter(r => (r.type as string) === 'hot')
    .slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const hotBuckets: { label: string; count: number }[] = []
  if (roomStart) {
    const end = roomEnd ?? (hotReactions.length > 0 ? new Date(hotReactions[hotReactions.length - 1].created_at) : null)
    if (end) {
      const totalBuckets = Math.max(1, Math.ceil((end.getTime() - roomStart.getTime()) / HOT_BUCKET_MS))
      for (let i = 0; i < totalBuckets; i++) {
        const bStart = roomStart.getTime() + i * HOT_BUCKET_MS
        const bEnd = bStart + HOT_BUCKET_MS
        const count = hotReactions.filter(r => {
          const t = new Date(r.created_at).getTime()
          return t >= bStart && t < bEnd
        }).length
        hotBuckets.push({ label: fmt(new Date(bStart)), count })
      }
    }
  }
  const maxHot = Math.max(1, ...hotBuckets.map(b => b.count))
  const totalHotTaps = hotReactions.length

  const STAR_BUCKET_MS = 30 * 60 * 1000
  const starForGraph = data.reactions
    .filter(r => r.type === 'star' && r.value)
    .slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const starBuckets: { label: string; avg: number | null; count: number }[] = []
  if (roomStart) {
    const end = roomEnd ?? (starForGraph.length > 0 ? new Date(starForGraph[starForGraph.length - 1].created_at) : null)
    if (end) {
      const totalBuckets = Math.max(1, Math.ceil((end.getTime() - roomStart.getTime()) / STAR_BUCKET_MS))
      for (let i = 0; i < totalBuckets; i++) {
        const bStart = roomStart.getTime() + i * STAR_BUCKET_MS
        const bEnd = bStart + STAR_BUCKET_MS
        const inBucket = starForGraph.filter(r => {
          const t = new Date(r.created_at).getTime()
          return t >= bStart && t < bEnd
        })
        const avg = inBucket.length > 0 ? inBucket.reduce((a, r) => a + (r.value ?? 0), 0) / inBucket.length : null
        starBuckets.push({ label: fmt(new Date(bStart)), avg, count: inBucket.length })
      }
    }
  }
  const maxStarAvg = 5

  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', paddingBottom: 40 }}>
      <div style={{ padding: '52px 20px 24px', textAlign: 'center', background: 'linear-gradient(180deg, rgba(255,107,107,0.08) 0%, transparent 100%)' }} className="animate-fade-in">
        <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>{roomData.roomName}</h1>
        <p style={{ fontSize: 14, color: 'var(--muted2)' }}>오늘 모임 결과</p>
        {durationMs !== null && (
          <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: '6px 14px' }}>
            <span style={{ fontSize: 14 }}>⏱️</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text2)' }}>{fmtDuration(durationMs)}</span>
          </div>
        )}
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

        {timelineEvents.length > 0 && (
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ fontSize: 20 }}>🕐</span>
              <h2 style={{ fontSize: 15, fontWeight: 800 }}>모임 타임라인</h2>
            </div>
            <div style={{ position: 'relative', paddingLeft: 16 }}>
              <div style={{ position: 'absolute', left: 16, top: 8, bottom: 8, width: 1.5, background: 'rgba(255,255,255,0.07)' }} />
              {timelineEvents.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: i < timelineEvents.length - 1 ? 16 : 0, position: 'relative' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--card2)', border: `1.5px solid ${ev.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, zIndex: 1 }}>{ev.icon}</div>
                  <div style={{ paddingTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginRight: 8 }}>{fmt(ev.time)}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: ev.color }}>{ev.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#f97316' }}>시간별 HOT 지수</h2>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>10분 단위 · 총 {totalHotTaps}회</span>
          </div>
          {hotBuckets.length === 0 ? (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '16px 0', color: 'var(--muted2)' }}>HOT 기록이 없어요 🥲</p>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, minWidth: hotBuckets.length * 36 }}>
                {hotBuckets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    {b.count > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 3 }}>{b.count}</span>
                    )}
                    <div style={{
                      width: '100%', minWidth: 20,
                      height: Math.max(4, Math.round((b.count / maxHot) * 72)),
                      borderRadius: '4px 4px 0 0',
                      background: b.count > 0 && b.count === maxHot
                        ? 'linear-gradient(180deg,#f97316,#ef4444)'
                        : b.count > 0 ? 'rgba(249,115,22,0.45)' : 'rgba(255,255,255,0.06)',
                    }} />
                    <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{ fontSize: 20 }}>⭐</span>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#fbbf24' }}>시간별 만족도</h2>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>30분 단위</span>
          </div>
          {starBuckets.length === 0 || starBuckets.every(b => b.avg === null) ? (
            <p style={{ fontSize: 14, textAlign: 'center', padding: '16px 0', color: 'var(--muted2)' }}>만족도 투표 기록이 없어요</p>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, minWidth: starBuckets.length * 48 }}>
                {starBuckets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' }}>
                    {b.avg !== null && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', marginBottom: 3 }}>{b.avg.toFixed(1)}</span>
                    )}
                    <div style={{
                      width: '100%', minWidth: 28,
                      height: b.avg !== null ? Math.max(4, Math.round((b.avg / maxStarAvg) * 72)) : 4,
                      borderRadius: '4px 4px 0 0',
                      background: b.avg !== null
                        ? 'linear-gradient(180deg,#fbbf24,#f59e0b)'
                        : 'rgba(255,255,255,0.06)',
                    }} />
                    <span style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, whiteSpace: 'nowrap' }}>{b.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: 14, marginBottom: 8, background: isVoted ? 'rgba(16,185,129,0.12)' : 'var(--card2)', border: '1.5px solid ' + (isVoted ? 'rgba(16,185,129,0.4)' : 'var(--border)'), cursor: voted ? 'default' : 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--text2)' }}>{p.nickname[0] ?? '?'}</div>
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
        <button className="btn btn-ghost" onClick={handleLeave} style={{ fontSize: 16 }}>홈으로 돌아가기</button>
      </div>
    </main>
  )
}
