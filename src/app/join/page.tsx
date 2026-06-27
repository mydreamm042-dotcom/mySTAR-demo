'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSessionToken, storeRoomData } from '@/lib/session'

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [code, setCode] = useState(searchParams.get('code') ?? '')
  const [nickname, setNickname] = useState('')
  const [step, setStep] = useState<'code' | 'nickname'>(searchParams.get('code') ? 'nickname' : 'code')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roomName, setRoomName] = useState('')

  useEffect(() => {
    if (code.length === 6 && step === 'code') {
      verifyCode()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const verifyCode = async () => {
    if (code.length !== 6) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/rooms/${code}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRoomName(data.room.name)
      setStep('nickname')
    } catch (e) {
      setError(e instanceof Error ? e.message : '코드를 확인해주세요')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요')
      return
    }
    setLoading(true)
    setError('')
    try {
      const session_token = getSessionToken()
      const res = await fetch(`/api/rooms/${code}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), session_token }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      storeRoomData({
        roomId: data.room.id,
        roomCode: data.room.code,
        roomName: data.room.name,
        participantId: data.participant.id,
        nickname: nickname.trim(),
        isHost: false,
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
        onClick={() => step === 'nickname' && !searchParams.get('code') ? setStep('code') : router.back()}
        className="mb-8 w-10 h-10 flex items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        ←
      </button>

      {step === 'code' ? (
        <div className="animate-fade-in">
          <h1 className="text-3xl font-bold mb-2">방 참여하기</h1>
          <p className="text-sm mb-8" style={{ color: '#6b7280' }}>
            호스트에게 받은 6자리 코드를 입력하세요
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABCD12"
            maxLength={6}
            className="w-full px-4 py-5 rounded-2xl text-center text-3xl font-bold tracking-[0.3em] outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(124, 58, 237, 0.3)',
              color: '#a78bfa',
              letterSpacing: '0.3em',
            }}
            autoFocus
          />
          {error && <p className="mt-3 text-sm text-center" style={{ color: '#ef4444' }}>{error}</p>}

          <button
            onClick={verifyCode}
            disabled={code.length !== 6 || loading}
            className="btn-touch w-full mt-6 glow-purple"
            style={{
              background: code.length === 6 ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(124,58,237,0.2)',
              color: '#fff',
              fontSize: '18px',
            }}
          >
            {loading ? '확인 중...' : '코드 확인'}
          </button>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div className="glass-card p-4 mb-8">
            <p className="text-xs" style={{ color: '#6b7280' }}>참여할 방</p>
            <p className="text-lg font-bold" style={{ color: '#a78bfa' }}>{roomName || code}</p>
          </div>

          <h2 className="text-2xl font-bold mb-2">닉네임 설정</h2>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            본인만 볼 수 있어요. 다른 사람에게는 <span style={{ color: '#a78bfa' }}>"누군가"</span>로 표시됩니다
          </p>

          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 10))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="나만 아는 이름"
            maxLength={10}
            className="w-full px-4 py-4 rounded-2xl text-base outline-none"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1.5px solid rgba(124, 58, 237, 0.3)',
              color: '#f0f0f5',
              fontSize: '16px',
            }}
            autoFocus
          />
          {error && <p className="mt-2 text-sm" style={{ color: '#ef4444' }}>{error}</p>}

          <button
            onClick={handleJoin}
            disabled={loading || !nickname.trim()}
            className="btn-touch w-full mt-6 glow-purple"
            style={{
              background: nickname.trim() ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(124,58,237,0.2)',
              color: '#fff',
              fontSize: '18px',
            }}
          >
            {loading ? '입장 중...' : '🚀 입장하기'}
          </button>
        </div>
      )}
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinContent />
    </Suspense>
  )
}
