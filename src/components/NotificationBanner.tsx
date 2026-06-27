'use client'

interface Props {
  round: number
  onOpen: () => void
  onDismiss: () => void
}

export default function NotificationBanner({ round, onOpen, onDismiss }: Props) {
  return (
    <div className="fixed top-4 left-4 right-4 z-40 animate-slide-up max-w-md mx-auto">
      <div className="glass-card px-4 py-3 flex items-center gap-3 glow-purple">
        <span className="text-2xl">✨</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Round {round} 시작!</p>
          <p className="text-xs truncate" style={{ color: '#9ca3af' }}>지금 마음을 표현해볼까요?</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpen}
            className="px-3 py-1.5 rounded-xl text-xs font-bold"
            style={{ background: 'rgba(124,58,237,0.8)', color: '#fff' }}
          >
            표현하기
          </button>
          <button
            onClick={onDismiss}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-xs"
            style={{ color: '#6b7280', background: 'rgba(255,255,255,0.06)' }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
