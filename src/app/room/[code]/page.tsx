'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomData, getSessionToken } from '@/lib/session'
import { useRoom } from '@/hooks/useRoom'
import InteractionModal from '@/components/InteractionModal'
import NotificationBanner from '@/components/NotificationBanner'
import HeartToast, { showToast } from '@/components/HeartToast'
import QRCodeDisplay from '@/components/QRCodeDisplay'

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const roomData = getRoomData()
  const [showModal, setShowModal] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [endingRoom, setEndingRoom] = useState(false)
  const [prevReactionCount, setPrevReactionCount] = useState(0)
  const [warnCooldownEnd, setWarnCooldownEnd] = useState<number | null>(null)
  const [warnCountdown, setWarnCountdown] = useState('')
  const notifiedThresholds = useRef(new Set<number>())
  const prevHotRef = useRef(0)

  useEffect(() => {
    if (!roomData || roomData.roomCode !== code) router.replace(`/join?code=${code}`)
  }, [code, roomData, router])

  const { state, sendReaction, dismissNotification } = useRoom(
    roomData?.roomId ?? '',
    code,
    () => router.push(`/room/${code}/result`),
  )

  // Warning countdown timer
  useEffect(() => {
    if (!warnCooldownEnd) return
    const tick = () => {
      const rem = Math.max(0, warnCooldownEnd - Date.now())
      if (rem === 0) { setWarnCooldownEnd(null); setWarnCountdown(''); return }
      const m = Math.floor(rem / 60000)
      const s = Math.floor((rem % 60000) / 1000)
      setWarnCountdown(`${m}:${s.toString().padStart(2, '0')}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [warnCooldownEnd])

  // Hot index
  const totalHearts = state.reactions.filter(r => r.type === 'heart').length
  const starReactions = state.reactions.filter(r => r.type === 'star' && r.value)
  const avgMood = starReactions.length > 0
    ? starReactions.reduce((a, r) => a + (r.value ?? 0), 0) / starReactions.length
    : null
  const hotIndex = Math.min(100, Math.round(totalHearts * 5 + (avgMood ?? 0) * 10))
  const isSuperhot = hotIndex >= 90

  // Reaction notifications
  useEffect(() => {
    if (state.reactions.length > prevReactionCount && prevReactionCount > 0) {
      const latest = state.reactions[0]
      if (latest?.receiver_id === roomData?.participantId) {
        if (latest.type === 'heart') {
          showToast({ emoji: '💖', message: '누군가 호감 시그널을 보냈어요!', color: '#ff6b6b' })
        } else if (latest.type === 'warning') {
          setWarnCooldownEnd(Date.now() + 10 * 60 * 1000)
          showToast({ emoji: '🤫', message: '자제 시그널을 받았어요', color: '#f59e0b' })
        }
      }
    }
    setPrevReactionCount(state.reactions.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reactions.length])

  // Hot index threshold notifications
  useEffect(() => {
    const thresholds: [number, string][] = [
      [50, '분위기 달아오르는데요? 🔥 50%'],
      [80, '파티 분위기 활활! 🔥 80%'],
      [90, '오늘 자리 진짜 핫해요!! 🔥 90%'],
      [100, '🔥🔥🔥 완전 불타는 파티!!'],
    ]
    for (const [t, msg] of thresholds) {
      if (hotIndex >= t && prevHotRef.current < t && !notifiedThresholds.current.has(t)) {
        showToast({ emoji: '🔥', message: msg, color: '#f97316' })
        notifiedThresholds.current.add(t)
      }
    }
    prevHotRef.current = hotIndex
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotIndex])

  const handleEndRoom = async () => {
    if (!confirm('방을 종료할까요?')) return
    setEndingRoom(true)
    await fetch(`/api/rooms/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host_session: getSessionToken(), status: 'ended' }),
    })
    router.push(`/room/${code}/result`)
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${appUrl}/join?code=${code}`

  if (!roomData) return null

  const myHearts = state.reactions.filter(r => r.receiver_id === roomData.participantId && r.type === 'heart').length
  const myWarnings = state.warningCounts[roomData.participantId] ?? 0
  const totalReactions = state.reactions.length

  return (
    <main className="flex flex-col min-h-dvh" style={{ paddingBottom: 100 }}>
      {/* 헤더 */}
      <div style={{ padding: '52px 20px 16px', background: 'linear-gradient(180deg, rgba(255,107,107,0.06) 0%, transparent 100%)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge" style={{ background: 'rgba(255,107,107,0.15)', color: 'var(--accent)', border: '1px solid rgba(255,107,107,0.25)' }}>🔴 LIVE</span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{roomData.roomName}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowQR(true)}
              style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              📱
            </button>
            {roomData.isHost && (
              <button onClick={handleEndRoom} disabled={endingRoom}
                style={{ height: 40, padding: '0 14px', borderRadius: 12, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {endingRoom ? '종료 중' : '방 종료'}
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>참여 코드</span>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.2em', color: 'var(--accent)', background: 'rgba(255,107,107,0.1)', padding: '3px 10px', borderRadius: 8 }}>{code}</span>
        </div>
      </div>

      {/* 자제 카운트다운 */}
      {warnCountdown && (
        <div className="animate-fade-in" style={{ margin: '0 20px 16px', padding: '14px 18px', borderRadius: 16, background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 24 }}>🤫</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>우리 10분만 쉬어요 {warnCountdown}</p>
            <p style={{ fontSize: 12, color: 'var(--muted2)' }}>익명 자제 시그널을 받았어요</p>
          </div>
        </div>
      )}

      {/* 스탯 카드 */}
      <div style={{ padding: '0 20px', marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>👥</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{state.participants.length}</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)' }}>참여자</div>
          </div>
          <div className="card" style={{ padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>⭐</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>{avgMood !== null ? avgMood.toFixed(1) : '-'}</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)' }}>분위기</div>
          </div>
          <div className={`card${isSuperhot ? ' fire-pulse' : ''}`} style={{ padding: '14px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: isSuperhot ? 26 : 22, marginBottom: 4, transition: 'font-size 0.3s' }}>🔥</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: isSuperhot ? '#f97316' : '#fbbf24' }}>{hotIndex}%</div>
            <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Hot 지수</div>
          </div>
        </div>
        {/* Hot 지수 바 */}
        <div style={{ marginTop: 10, height: 5, borderRadius: 3, background: 'var(--card)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, width: hotIndex + '%',
            background: hotIndex >= 90 ? 'linear-gradient(90deg, #f97316, #ef4444)' : hotIndex >= 50 ? 'linear-gradient(90deg, #fbbf24, #f97316)' : '#fbbf24',
            transition: 'width 0.6s ease, background 0.6s ease',
          }} />
        </div>
      </div>

      {/* 참여자 목록 */}
      <div style={{ padding: '0 20px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted2)' }}>참여자 목록</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>총 {totalReactions}개 리액션</p>
        </div>
        <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>💖 하트 · 🤫 자제는 나에게만 표시돼요</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.participants.map((p, idx) => {
            const isMe = p.id === roomData.participantId
            const isHost = idx === 0
            return (
              <div key={p.id} className="card" style={{
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                borderColor: isMe ? 'rgba(255,107,107,0.25)' : undefined,
                background: isMe ? 'rgba(255,107,107,0.05)' : undefined,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: isMe ? 'rgba(255,107,107,0.2)' : 'var(--card2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, flexShrink: 0,
                }}>
                  {isMe ? (roomData.nickname[0] ?? '나') : '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                      {isMe ? `${roomData.nickname} (나)` : '누군가'}
                    </p>
                    {isHost && (
                      <span className="badge" style={{ background: 'rgba(124,92,191,0.2)', color: 'var(--purple-light)', fontSize: 10 }}>HOST</span>
                    )}
                  </div>
                  {isMe && (myHearts > 0 || myWarnings > 0) && (
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      {myHearts > 0 && <span style={{ fontSize: 12, color: '#ff6b6b' }}>💖 {myHearts}</span>}
                      {myWarnings > 0 && <span style={{ fontSize: 12, color: '#f59e0b' }}>🤫 {myWarnings}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 448, padding: '16px 20px 32px',
        background: 'linear-gradient(0deg, var(--bg) 60%, transparent)',
      }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}
          style={{ fontSize: 18, minHeight: 60, boxShadow: '0 12px 32px rgba(255,107,107,0.5)' }}>
          ✨ 지금 표현하기
        </button>
      </div>

      {state.notification && (
        <NotificationBanner
          round={state.notification.round}
          onOpen={() => { dismissNotification(); setShowModal(true) }}
          onDismiss={dismissNotification}
        />
      )}

      {showModal && (
        <InteractionModal
          participants={state.participants}
          myParticipantId={roomData.participantId}
          roomId={roomData.roomId}
          round={state.currentRound}
          onSend={sendReaction}
          onClose={() => setShowModal(false)}
        />
      )}

      {showQR && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setShowQR(false)}>
          <div className="card animate-slide-up" style={{ width: '100%', maxWidth: 448, padding: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }}
            onClick={e => e.stopPropagation()}>
            <QRCodeDisplay url={joinUrl} code={code} roomName={roomData.roomName} />
            <button className="btn btn-ghost" onClick={() => setShowQR(false)} style={{ marginTop: 12, fontSize: 15 }}>닫기</button>
          </div>
        </div>
      )}

      <HeartToast />
    </main>
  )
}
