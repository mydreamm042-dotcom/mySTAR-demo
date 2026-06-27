'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionToken, storeRoomData } from '@/lib/session'

export default function CreatePage() {
  const router = useRouter()
  const [roomName, setRoomName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError('방 이름을 입력해주세요')
      return
    }
    setLoading(true)
    setError('')

    try {
      const host_session = getSessionToken()
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim(), host_session }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      storeRoomData({
        roomId: data.room.id,
        roomCode: data.room.code,
        roomName: data.room.name,
        participantId: data.participant.id,
        nickname: '호스트',
        isHost: true,
      })

      router.push(`/room/${data.room.code}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다')
      setLoading(false)
    }
  }

  return (
    <main className="flex flex-col min-h-dvh px-6 py-10">
      <button
        onClick={() => router.back()}
        className="mb-8 w-10 h-10 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        ←
      </button>

      <div className="mb-8 animate-fade-in">
        <h1 className="text-3xl font-bold mb-2">방 만들기</h1>
        <p className="text-sm" style={{ color: '#6b7280' }}>
          오늘 모임의 이름을 정해주세요
        </p>
      </div>

      <div className="flex-1 animate-fade-in">
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: '#9ca3af' }}>
            모임 이름
          </label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="예: 팀 회식, 대학 동창 모임"
            maxLength={30}
            className="w-full px-4 py-4 rounded-2xl text-base outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(124, 58, 237, 0.3)',
              color: '#f0f0f5',
              fontSize: '16px',
            }}
            autoFocus
          />
          {error && (
            <p className="mt-2 text-sm" style={{ color: '#ef4444' }}>{error}</p>
          )}
        </div>

        <div className="glass-card p-4 mb-8">
          <p className="text-xs font-medium mb-2" style={{ color: '#a78bfa' }}>방 만들면 이런 게 생겨요</p>
          <ul className="text-sm space-y-1" style={{ color: '#9ca3af' }}>
            <li>✓ 6자리 참여 코드 + QR코드 자동 생성</li>
            <li>✓ 1시간마다 인터랙션 알림</li>
            <li>✓ 하트, 자제 시그널, 별점 익명 전송</li>
            <li>✓ 종료 시 오늘의 하이라이트 결과</li>
          </ul>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={loading || !roomName.trim()}
        className="btn-touch w-full glow-purple"
        style={{
          background: loading || !roomName.trim()
            ? 'rgba(124, 58, 237, 0.3)'
            : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
          color: '#fff',
          fontSize: '18px',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '생성 중...' : '🎉 방 만들기'}
      </button>
    </main>
  )
}
