'use client'

import { useState, useEffect } from 'react'
import { Participant } from '@/lib/supabase/types'

interface Props {
  participants: Participant[]
  myParticipantId: string
  round: number
  onSend: (receiver_id: string, type: 'heart' | 'warning' | 'star', value?: number) => Promise<{ error?: string; warningCount?: number }>
  onClose: () => void
}

type Mode = 'select' | 'heart' | 'warning' | 'star'

const MOOD_LABELS = ['', '😴 좀 쳐지네요', '😐 평범한 편', '😊 괜찮아요', '😄 꽤 좋아요!', '🔥 완전 핫해요!!']

function parseCooldownMinutes(error: string): number | null {
  const m = error.match(/(\d+)\s*분 후 가능/)
  return m ? parseInt(m[1]) : null
}

function fmtMs(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function InteractionModal({ participants, myParticipantId, round, onSend, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('select')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [starValue, setStarValue] = useState(0)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; cooldownMs?: number } | null>(null)
  const [remainMs, setRemainMs] = useState<number | null>(null)

  useEffect(() => {
    if (result?.cooldownMs == null) return
    setRemainMs(result.cooldownMs)
    const interval = setInterval(() => {
      setRemainMs(prev => {
        if (prev == null || prev <= 1000) { clearInterval(interval); return 0 }
        return prev - 1000
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [result])

  const others = participants.filter(p => p.id !== myParticipantId)

  const handleSend = async () => {
    if (mode !== 'star' && !selectedId) return
    if (mode === 'star' && starValue === 0) return
    setSending(true)
    try {
      const receiverId = mode === 'star'
        ? (others[0]?.id ?? myParticipantId)
        : selectedId!
      const res = await onSend(receiverId, mode === 'star' ? 'star' : mode as 'heart' | 'warning', mode === 'star' ? starValue : undefined)
      if (res?.error) {
        const mins = parseCooldownMinutes(res.error)
        setResult({
          success: false,
          message: res.error,
          cooldownMs: mins != null ? mins * 60 * 1000 : undefined,
        })
      } else {
        const msgs: Record<Mode, string> = {
          select: '',
          heart: '💖 하트를 보냈어요!',
          warning: '🤫 조용히 전달했어요',
          star: `⭐ ${starValue}점 투표 완료!`,
        }
        setResult({ success: true, message: msgs[mode] })
      }
    } finally { setSending(false) }
  }

  if (result) {
    const canRetry = result.cooldownMs != null && remainMs === 0
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px', background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="card animate-bounce-in" style={{ width: '100%', padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>{result.success ? '✨' : '😅'}</div>
          <p style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            {result.success ? result.message : result.message.split('(')[0].trim()}
          </p>
          {!result.success && remainMs != null && remainMs > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 8 }}>다음 전송까지</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
                {fmtMs(remainMs)}
              </p>
            </div>
          )}
          {(result.success || canRetry || result.cooldownMs == null) && (
            <button className="btn btn-primary" style={{ marginBottom: result.success ? 0 : 8 }} onClick={onClose}>확인</button>
          )}
          {!result.success && !canRetry && remainMs != null && remainMs > 0 && (
            <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>닫기</button>
          )}
          {canRetry && (
            <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={() => { setResult(null); setRemainMs(null) }}>다시 시도하기</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(16px)' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '56px 24px 24px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <span className="badge" style={{ background: 'rgba(255,107,107,0.15)', color: 'var(--accent)', marginBottom: 8, display: 'inline-flex' }}>
              ROUND {round}
            </span>
            <h2 style={{ fontSize: 26, fontWeight: 800 }}>지금 표현해볼까요?</h2>
          </div>
          <button onClick={onClose}
            style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--muted2)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            ✕
          </button>
        </div>

        {mode === 'select' && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { m: 'heart' as Mode, emoji: '💖', label: '호감 표현', desc: '누군가에게 하트를 익명으로', color: '#ff6b6b', bg: 'rgba(255,107,107,0.1)', border: 'rgba(255,107,107,0.25)' },
              { m: 'warning' as Mode, emoji: '🤫', label: '자제 시그널', desc: '살짝 과하다 싶을 때 익명으로', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
              { m: 'star' as Mode, emoji: '⭐', label: '만족도 별점', desc: '지금 이 자리, 몇 점짜리?', color: 'var(--purple-light)', bg: 'rgba(124,92,191,0.1)', border: 'rgba(124,92,191,0.25)' },
            ].map(({ m, emoji, label, desc, color, bg, border }) => (
              <button key={m} onClick={() => setMode(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '18px 20px', borderRadius: 18,
                  background: bg, border: `1.5px solid ${border}`,
                  cursor: 'pointer', textAlign: 'left',
                }}>
                <span style={{ fontSize: 36 }}>{emoji}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted2)' }}>{desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {(mode === 'heart' || mode === 'warning') && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <button onClick={() => { setMode('select'); setSelectedId(null) }}
              style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 14, cursor: 'pointer', marginBottom: 20, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
              ← 뒤로
            </button>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
              {mode === 'heart' ? '💖 하트 보낼 사람' : '🤫 시그널 보낼 사람'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 20 }}>익명으로 전달돼요</p>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}>
              {others.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0' }}>아직 다른 참여자가 없어요</p>
              ) : others.map(p => {
                const sel = selectedId === p.id
                const ac = mode === 'heart' ? '#ff6b6b' : '#f59e0b'
                return (
                  <button key={p.id} onClick={() => setSelectedId(p.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '14px 16px', borderRadius: 16,
                      background: sel ? `rgba(${mode === 'heart' ? '255,107,107' : '245,158,11'},0.12)` : 'var(--card)',
                      border: `1.5px solid ${sel ? ac : 'var(--border)'}`,
                      cursor: 'pointer',
                    }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: sel ? `rgba(${mode === 'heart' ? '255,107,107' : '245,158,11'},0.2)` : 'var(--card2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: sel ? ac : 'var(--text2)' }}>
                      {p.nickname[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 600, color: sel ? ac : 'var(--text)' }}>{p.nickname}</span>
                    {sel && <span style={{ fontSize: 20 }}>{mode === 'heart' ? '💖' : '🤫'}</span>}
                  </button>
                )
              })}
            </div>

            <button className="btn" onClick={handleSend} disabled={!selectedId || sending}
              style={{
                marginTop: 16, fontSize: 17,
                background: selectedId ? (mode === 'heart' ? 'linear-gradient(135deg,#ff6b6b,#ee4444)' : 'linear-gradient(135deg,#f59e0b,#d97706)') : 'var(--card)',
                color: '#fff',
                boxShadow: selectedId ? `0 8px 24px rgba(${mode === 'heart' ? '255,107,107' : '245,158,11'},0.4)` : 'none',
                opacity: !selectedId ? 0.4 : 1,
              }}>
              {sending ? '전송 중...' : mode === 'heart' ? '💖 하트 보내기' : '🤫 시그널 보내기'}
            </button>
          </div>
        )}

        {mode === 'star' && (
          <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <button onClick={() => { setMode('select'); setStarValue(0) }}
              style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 14, cursor: 'pointer', marginBottom: 20, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 6 }}>
              ← 뒤로
            </button>
            <p style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>⭐ 지금 만족도 몇 점?</p>
            <p style={{ fontSize: 13, color: 'var(--muted2)', marginBottom: 40 }}>전체 평균이 실시간으로 업데이트돼요</p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setStarValue(n)}
                  style={{
                    fontSize: 48, background: 'none', border: 'none', cursor: 'pointer',
                    transition: 'all 0.15s',
                    transform: starValue >= n ? 'scale(1.25)' : 'scale(1)',
                    filter: starValue >= n ? 'brightness(1) drop-shadow(0 0 8px rgba(251,191,36,0.6))' : 'brightness(0.25)',
                  }}>
                  ⭐
                </button>
              ))}
            </div>

            {starValue > 0 && (
              <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: '#fbbf24', marginBottom: 32 }}>
                {MOOD_LABELS[starValue]}
              </p>
            )}

            <div style={{ flex: 1 }} />
            <button className="btn" onClick={handleSend} disabled={starValue === 0 || sending}
              style={{
                fontSize: 17,
                background: starValue > 0 ? 'linear-gradient(135deg,#7c5cbf,#6d28d9)' : 'var(--card)',
                color: '#fff',
                boxShadow: starValue > 0 ? '0 8px 24px rgba(124,92,191,0.4)' : 'none',
                opacity: starValue === 0 ? 0.4 : 1,
              }}>
              {sending ? '투표 중...' : `⭐ ${starValue > 0 ? starValue + '점' : '?점'} 투표하기`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
