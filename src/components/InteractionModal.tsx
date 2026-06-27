'use client'

import { useState } from 'react'
import { Participant } from '@/lib/supabase/types'

interface Props {
  participants: Participant[]
  myParticipantId: string
  round: number
  onSend: (receiver_id: string, type: 'heart' | 'warning' | 'star', value?: number) => Promise<{ error?: string; warningCount?: number }>
  onClose: () => void
}

type Mode = 'select' | 'heart' | 'warning' | 'star'

export default function InteractionModal({ participants, myParticipantId, round, onSend, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [starValue, setStarValue] = useState(0)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const others = participants.filter(p => p.id !== myParticipantId)

  const handleSend = async () => {
    if (!selectedId && mode !== 'star') return
    if (mode === 'star' && starValue === 0) return
    setSending(true)

    try {
      let res
      if (mode === 'star') {
        res = await onSend(myParticipantId, 'star', starValue)
      } else {
        res = await onSend(selectedId!, mode as 'heart' | 'warning')
      }

      if (res?.error) {
        setResult({ success: false, message: res.error })
      } else {
        if (mode === 'heart') {
          setResult({ success: true, message: '💝 하트를 보냈어요!' })
        } else if (mode === 'warning') {
          setResult({ success: true, message: '🤫 조용히 전달했어요' })
        } else {
          setResult({ success: true, message: `⭐ ${starValue}점을 투표했어요!` })
        }
      }
    } finally {
      setSending(false)
    }
  }

  if (result) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 px-6"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="glass-card p-8 w-full text-center animate-bounce-in">
          <div className="text-6xl mb-4">{result.success ? '✨' : '⚠️'}</div>
          <p className="text-xl font-bold mb-6">{result.message}</p>
          <button onClick={onClose} className="btn-touch w-full"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)', color: '#a78bfa', fontSize: '16px' }}>
            닫기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col z-50"
      style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)' }}>
      <div className="flex-1 flex flex-col px-6 py-8 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs font-medium" style={{ color: '#a78bfa' }}>ROUND {round}</p>
            <h2 className="text-2xl font-bold">지금 표현해볼까요?</h2>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#9ca3af' }}>
            ✕
          </button>
        </div>

        {mode === 'select' && (
          <div className="space-y-4 animate-fade-in">
            <button onClick={() => setMode('heart')} className="btn-touch w-full px-5"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1.5px solid rgba(244,63,94,0.3)', justifyContent: 'flex-start', gap: '16px' }}>
              <span className="text-3xl">💖</span>
              <div className="text-left">
                <div className="font-bold text-base">호감 표현</div>
                <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>누군가에게 하트를 익명으로 보내요</div>
              </div>
            </button>

            <button onClick={() => setMode('warning')} className="btn-touch w-full px-5"
              style={{ background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.3)', justifyContent: 'flex-start', gap: '16px' }}>
              <span className="text-3xl">🤫</span>
              <div className="text-left">
                <div className="font-bold text-base">자제 시그널</div>
                <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>살짝 과하다 싶은 사람에게 익명으로 신호를</div>
              </div>
            </button>

            <button onClick={() => setMode('star')} className="btn-touch w-full px-5"
              style={{ background: 'rgba(124,58,237,0.12)', border: '1.5px solid rgba(124,58,237,0.3)', justifyContent: 'flex-start', gap: '16px' }}>
              <span className="text-3xl">⭐</span>
              <div className="text-left">
                <div className="font-bold text-base">분위기 별점</div>
                <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>지금 이 모임, 몇 점짜리인가요?</div>
              </div>
            </button>
          </div>
        )}

        {(mode === 'heart' || mode === 'warning') && (
          <div className="animate-fade-in flex-1 flex flex-col">
            <button onClick={() => setMode('select')} className="mb-4 text-sm flex items-center gap-1" style={{ color: '#6b7280' }}>
              ← 뒤로
            </button>
            <p className="text-lg font-bold mb-1">
              {mode === 'heart' ? '💖 하트 보낼 사람' : '🤫 시그널 보낼 사람'}
            </p>
            <p className="text-xs mb-6" style={{ color: '#6b7280' }}>
              {mode === 'heart' ? '이번 라운드에 1명에게만 보낼 수 있어요' : '받는 사람은 누가 보냈는지 알 수 없어요'}
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pb-4">
              {others.length === 0 ? (
                <p className="text-center py-8" style={{ color: '#6b7280' }}>아직 다른 참여자가 없어요</p>
              ) : others.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className="btn-touch w-full px-5"
                  style={{
                    background: selectedId === p.id
                      ? mode === 'heart' ? 'rgba(244,63,94,0.2)' : 'rgba(245,158,11,0.2)'
                      : 'rgba(255,255,255,0.05)',
                    border: `1.5px solid ${selectedId === p.id ? (mode === 'heart' ? 'rgba(244,63,94,0.6)' : 'rgba(245,158,11,0.6)') : 'rgba(255,255,255,0.08)'}`,
                    justifyContent: 'space-between',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
                      누
                    </div>
                    <span className="font-medium">누군가</span>
                  </div>
                  {selectedId === p.id && <span>{mode === 'heart' ? '💖' : '🤫'}</span>}
                </button>
              ))}
            </div>

            <button
              onClick={handleSend}
              disabled={!selectedId || sending}
              className="btn-touch w-full mt-4"
              style={{
                background: selectedId ? (mode === 'heart' ? 'linear-gradient(135deg, #f43f5e, #e11d48)' : 'linear-gradient(135deg, #f59e0b, #d97706)') : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '17px',
              }}
            >
              {sending ? '전송 중...' : mode === 'heart' ? '💖 하트 보내기' : '🤫 시그널 보내기'}
            </button>
          </div>
        )}

        {mode === 'star' && (
          <div className="animate-fade-in flex-1 flex flex-col">
            <button onClick={() => setMode('select')} className="mb-4 text-sm flex items-center gap-1" style={{ color: '#6b7280' }}>
              ← 뒤로
            </button>
            <p className="text-lg font-bold mb-1">⭐ 지금 분위기 몇 점?</p>
            <p className="text-xs mb-10" style={{ color: '#6b7280' }}>제출하면 전체 평균이 실시간으로 업데이트돼요</p>

            <div className="flex justify-center gap-4 mb-12">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setStarValue(n)}
                  className="text-5xl transition-all duration-150"
                  style={{ transform: starValue >= n ? 'scale(1.2)' : 'scale(1)', filter: starValue >= n ? 'brightness(1)' : 'brightness(0.3)' }}
                >
                  ⭐
                </button>
              ))}
            </div>

            {starValue > 0 && (
              <p className="text-center text-sm mb-8" style={{ color: '#a78bfa' }}>
                {['', '😴 좀 쳐지네요', '😐 평범한 편', '😊 괜찮아요', '😄 꽤 좋아요!', '🔥 완전 핫해요!!'][starValue]}
              </p>
            )}

            <button
              onClick={handleSend}
              disabled={starValue === 0 || sending}
              className="btn-touch w-full"
              style={{
                background: starValue > 0 ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                fontSize: '17px',
              }}
            >
              {sending ? '투표 중...' : `⭐ ${starValue}점 투표하기`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
