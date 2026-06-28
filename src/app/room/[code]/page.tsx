'use client'

import { useEffect, useState, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getRoomData, getSessionToken, clearRoomData } from '@/lib/session'
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
  const [hotFloaters, setHotFloaters] = useState<string[]>([])
  const [hotPressed, setHotPressed] = useState(false)
  const hotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!roomData || roomData.roomCode !== code) router.replace(`/join?code=${code}`)
  }, [code, roomData, router])

  const { state, sendReaction, dismissNotification } = useRoom(
    roomData?.roomId ?? '',
    code,
    () => router.push(`/room/${code}/result`),
  )

  useEffect(() => {
    if (state.reactions.length > prevReactionCount && prevReactionCount > 0) {
      const latest = state.reactions[0]
      if (!latest) return
      if (latest.receiver_id === roomData?.participantId) {
        if (latest.type === 'heart') showToast({ emoji: '💖', message: '누군가 하트를 보냈어요!', color: '#ff6b6b' })
        else if (latest.type === 'warning') {
          const count = state.warningCounts[roomData?.participantId ?? ''] ?? 0
          if (count >= 3) showToast({ emoji: '🤫', message: '잠깐, 오늘 좀 과한 것 같아요', color: '#f59e0b' })
        }
      }
    }
    setPrevReactionCount(state.reactions.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reactions.length])

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

  const handleLeave = () => {
    clearRoomData()
    router.replace('/')
  }

  const handleHot = () => {
    // 애니메이션: 버튼 살짝 커졌다 복구
    setHotPressed(true)
    if (hotTimerRef.current) clearTimeout(hotTimerRef.current)
    hotTimerRef.current = setTimeout(() => setHotPressed(false), 150)

    // 플로팅 이모지
    const id = Math.random().toString(36).slice(2)
    setHotFloaters(prev => [...prev, id])
    setTimeout(() => setHotFloaters(prev => prev.filter(x => x !== id)), 900)

    // 서버 전송 (fire-and-forget)
    if (roomData) {
      sendReaction(roomData.participantId, 'hot')
    }
  }

  const currentMood = state.moodAverages[state.currentRound]
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${appUrl}/join?code=${code}`

  if (!roomData) return null

  const myHearts = state.reactions.filter(r => r.receiver_id === roomData.participantId && r.type === 'heart').length
  const totalReactions = state.reactions.filter(r => r.type !== 'hot').length
  const hotTaps = state.reactions.filter(r => r.type === 'hot').length
  const totalHearts = state.reactions.filter(r => r.type === 'heart').length
  const hotIndex = Math.min(100, hotTaps * 2 + totalHearts * 3 + Math.round((currentMood ?? 0) * 8))

  return (
    <main className="flex flex-col min-h-dvh" style={{ paddingBottom: 100 }}>
      {/* 상단 헤더 */}
      <div style={{
        padding: '52px 20px 16px',
        background: 'linear-gradient(180deg, rgba(255,107,107,0.06) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span className="badge" style={{ background: 'rgba(255,107,107,0.15)', color: 'var(--accent)', border: '1px solid rgba(255,107,107,0.25)' }}>
                🔴 LIVE
              </span>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.2 }}>{roomData.roomName}</h1>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowQR(true)}
              style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              📱
            </button>
            {roomData.isHost ? (
              <button onClick={handleEndRoom} disabled={endingRoom}
                style={{ height: 40, padding: '0 14px', borderRadius: 12, background: 'rgba(255,107,107,0.12)', border: '1px solid rgba(255,107,107,0.3)', color: 'var(--accent)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {endingRoom ? '종료 중' : '방 종료'}
              </button>
            ) : (
              <button onClick={handleLeave}
                style={{ height: 40, padding: '0 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted2)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                나가기
              </button>
            )}
          </div>
        </div>

        {/* 참여 코드 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>참여 코드</span>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.2em', color: 'var(--accent)', background: 'rgba(255,107,107,0.1)', padding: '3px 10px', borderRadius: 8 }}>
            {code}
          </span>
        </div>
      </div>

      {/* 스탯 카드 */}
      <div style={{ padding: '0 20px', marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
          <div className="card" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>👥</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{state.participants.length}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>참여자</div>
          </div>
          <div className="card" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>💖</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#ff6b6b' }}>{myHearts}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>받은 하트</div>
          </div>
          <div className="card" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>⭐</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#fbbf24' }}>
              {currentMood !== undefined ? currentMood.toFixed(1) : '-'}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>분위기</div>
          </div>
          <div className="card" style={{ padding: '14px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>🔥</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#f97316' }}>{hotIndex}</div>
            <div style={{ fontSize: 10, color: 'var(--muted2)' }}>HOT</div>
          </div>
        </div>
      </div>

      {/* Hot 버튼 + 플로터 */}
      <div style={{ padding: '0 20px', marginBottom: 16, position: 'relative' }}>
        <div style={{ position: 'relative', display: 'inline-flex', width: '100%', justifyContent: 'center' }}>
          {/* 플로팅 이모지들 */}
          {hotFloaters.map(id => (
            <span key={id} className="animate-float-up" style={{
              position: 'absolute',
              bottom: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              fontSize: 32,
              pointerEvents: 'none',
              zIndex: 10,
            }}>🔥</span>
          ))}
          <button
            onClick={handleHot}
            style={{
              width: '100%',
              minHeight: 54,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #f97316, #ef4444)',
              border: 'none',
              color: '#fff',
              fontSize: hotPressed ? 30 : 26,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'font-size 0.1s ease, transform 0.1s ease',
              transform: hotPressed ? 'scale(1.06)' : 'scale(1)',
              boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              userSelect: 'none',
              WebkitUserSelect: 'none',
            }}>
            🔥 HOT!
          </button>
        </div>
      </div>

      {/* 참여자 목록 */}
      <div style={{ padding: '0 20px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted2)' }}>참여자 목록</p>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>총 {totalReactions}개 리액션</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.participants.map((p, idx) => {
            const isMe = p.id === roomData.participantId
            const heartCount = state.reactions.filter(r => r.receiver_id === p.id && r.type === 'heart').length
            const warnCount = state.warningCounts[p.id] ?? 0
            const isHost = idx === 0

            return (
              <div key={p.id} className="card" style={{
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
                borderColor: isMe ? 'rgba(255,107,107,0.25)' : undefined,
                background: isMe ? 'rgba(255,107,107,0.05)' : undefined,
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14,
                  background: isMe ? 'rgba(255,107,107,0.2)' : 'var(--card2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, fontWeight: 700, color: isMe ? 'var(--accent)' : 'var(--text2)',
                  flexShrink: 0,
                }}>
                  {p.nickname[0] ?? '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: isMe ? 'var(--accent)' : 'var(--text)' }}>
                      {p.nickname}{isMe ? ' (나)' : ''}
                    </p>
                    {isHost && (
                      <span className="badge" style={{ background: 'rgba(124,92,191,0.2)', color: 'var(--purple-light)', fontSize: 10 }}>HOST</span>
                    )}
                  </div>
                  {isMe && warnCount >= 3 && (
                    <p style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>⚠️ 자제 시그널 {warnCount}개</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {heartCount > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,107,107,0.12)', padding: '4px 10px', borderRadius: 20 }}>
                      <span style={{ fontSize: 14 }}>💖</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#ff6b6b' }}>{heartCount}</span>
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
        width: '100%', maxWidth: 448,
        padding: '16px 20px 32px',
        background: 'linear-gradient(0deg, var(--bg) 60%, transparent)',
      }}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}
          style={{ fontSize: 18, minHeight: 60, boxShadow: '0 12px 32px rgba(255,107,107,0.5)' }}>
          ✨ 지금 표현하기
        </button>
      </div>

      {/* 알림 배너 */}
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
