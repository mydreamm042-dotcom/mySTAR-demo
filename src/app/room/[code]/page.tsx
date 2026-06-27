'use client'

import { useEffect, useState, use } from 'react'
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

  useEffect(() => {
    if (!roomData || roomData.roomCode !== code) {
      router.replace(`/join?code=${code}`)
    }
  }, [code, roomData, router])

  const { state, sendReaction, dismissNotification } = useRoom(
    roomData?.roomId ?? '',
    code
  )

  useEffect(() => {
    if (state.reactions.length > prevReactionCount && prevReactionCount > 0) {
      const latest = state.reactions[0]
      if (!latest) return
      const myId = roomData?.participantId
      if (latest.receiver_id === myId) {
        if (latest.type === 'heart') {
          showToast({ emoji: '💖', message: '누군가 하트를 보냈어요!', color: '#f43f5e' })
        } else if (latest.type === 'warning') {
          const count = state.warningCounts[myId] ?? 0
          if (count >= 3) {
            showToast({ emoji: '⚠️', message: '잠깐, 오늘 좀 과한 것 같아요', color: '#f59e0b' })
          }
        }
      }
    }
    setPrevReactionCount(state.reactions.length)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.reactions.length])

  const handleEndRoom = async () => {
    if (!confirm('방을 종료할까요? 결과 화면으로 이동합니다.')) return
    setEndingRoom(true)
    await fetch(`/api/rooms/${code}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host_session: getSessionToken(), status: 'ended' }),
    })
    router.push(`/room/${code}/result`)
  }

  const currentMood = state.moodAverages[state.currentRound]
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const joinUrl = `${appUrl}/join?code=${code}`

  if (!roomData) return null

  return (
    <main className="flex flex-col min-h-dvh pb-6">
      <div className="px-5 pt-10 pb-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-xs font-medium" style={{ color: '#a78bfa' }}>ROUND {state.currentRound}</p>
            <h1 className="text-xl font-bold">{roomData.roomName}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowQR(true)}
              className="w-10 h-10 flex items-center justify-center rounded-2xl text-lg"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}
            >
              📱
            </button>
            {roomData.isHost && (
              <button
                onClick={handleEndRoom}
                disabled={endingRoom}
                className="px-3 h-10 flex items-center justify-center rounded-2xl text-xs font-bold"
                style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}
              >
                {endingRoom ? '종료 중' : '방 종료'}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className="text-xs" style={{ color: '#6b7280' }}>참여 코드</span>
          <span className="text-sm font-bold tracking-widest px-3 py-1 rounded-lg"
            style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
            {code}
          </span>
        </div>
      </div>

      {currentMood !== undefined && (
        <div className="mx-5 mb-4 glass-card px-4 py-3 flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="text-xs" style={{ color: '#6b7280' }}>현재 분위기</p>
            <p className="text-lg font-bold" style={{ color: '#a78bfa' }}>
              {currentMood.toFixed(1)}점
            </p>
          </div>
          <div className="flex gap-0.5 ml-2">
            {[1,2,3,4,5].map(n => (
              <span key={n} className="text-sm" style={{ filter: n <= Math.round(currentMood) ? 'brightness(1)' : 'brightness(0.25)' }}>⭐</span>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 px-5">
        <p className="text-sm font-medium mb-3" style={{ color: '#6b7280' }}>
          참여자 {state.participants.length}명
        </p>

        <div className="space-y-2">
          {state.participants.map(p => {
            const isMe = p.id === roomData.participantId
            const heartCount = state.reactions.filter(r => r.receiver_id === p.id && r.type === 'heart').length
            const warnCount = state.warningCounts[p.id] ?? 0

            return (
              <div
                key={p.id}
                className="glass-card px-4 py-3 flex items-center gap-3"
                style={isMe ? { borderColor: 'rgba(124,58,237,0.4)' } : {}}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: isMe ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.08)', color: isMe ? '#a78bfa' : '#9ca3af' }}>
                  {isMe ? (roomData.nickname[0] ?? '나') : '누'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {isMe ? `${roomData.nickname} (나)` : '누군가'}
                    {p.id === state.participants[0]?.id && <span className="ml-1 text-xs" style={{ color: '#a78bfa' }}>호스트</span>}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  {heartCount > 0 && (
                    <span style={{ color: '#f43f5e' }}>💖 {heartCount}</span>
                  )}
                  {isMe && warnCount >= 3 && (
                    <span style={{ color: '#f59e0b' }}>⚠️ {warnCount}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="px-5 pt-6">
        <button
          onClick={() => setShowModal(true)}
          className="btn-touch w-full glow-purple"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#fff',
            fontSize: '18px',
            minHeight: '60px',
          }}
        >
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
          round={state.currentRound}
          onSend={sendReaction}
          onClose={() => setShowModal(false)}
        />
      )}

      {showQR && (
        <div className="fixed inset-0 flex items-end justify-center z-50"
          style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowQR(false)}>
          <div className="glass-card p-6 w-full max-w-md animate-slide-up" onClick={e => e.stopPropagation()}>
            <QRCodeDisplay url={joinUrl} code={code} roomName={roomData.roomName} />
            <button onClick={() => setShowQR(false)} className="btn-touch w-full mt-4"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af', fontSize: '16px' }}>
              닫기
            </button>
          </div>
        </div>
      )}

      <HeartToast />
    </main>
  )
}
