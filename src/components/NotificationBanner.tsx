'use client'

interface Props {
  round: number
  onOpen: () => void
  onDismiss: () => void
}

export default function NotificationBanner({ round, onOpen, onDismiss }: Props) {
  void round
  return (
    <div className="animate-slide-up" style={{
      position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 448,
      padding: '52px 16px 16px',
      zIndex: 40,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(255,107,107,0.98), rgba(238,68,68,0.98))',
        borderRadius: 20,
        padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 12px 40px rgba(255,107,107,0.5)',
        backdropFilter: 'blur(12px)',
        pointerEvents: 'auto',
      }}>
        <div style={{ fontSize: 30 }}>🔔</div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 1 }}>분위기 체크 타임!</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>지금 마음을 표현해보세요</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onOpen}
            style={{ padding: '8px 14px', borderRadius: 10, background: '#fff', color: '#ff6b6b', fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none' }}>
            표현하기
          </button>
          <button onClick={onDismiss}
            style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 16, cursor: 'pointer', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
