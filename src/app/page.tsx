'use client'

import { useRouter } from 'next/navigation'

export default function Home() {
  const router = useRouter()

  return (
    <main className="flex flex-col items-center justify-center min-h-dvh px-6 py-12">
      <div className="mb-12 text-center animate-fade-in">
        <div className="text-6xl mb-4">⭐</div>
        <h1 className="text-4xl font-bold tracking-tight" style={{ color: '#a78bfa' }}>
          mySTAR
        </h1>
        <p className="mt-3 text-sm" style={{ color: '#6b7280' }}>
          술자리에서 익명으로 마음을 표현해요
        </p>
      </div>

      <div className="w-full space-y-4 animate-slide-up">
        <button
          onClick={() => router.push('/create')}
          className="btn-touch w-full glow-purple"
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            color: '#fff',
            fontSize: '18px',
          }}
        >
          🍻 방 만들기
        </button>

        <button
          onClick={() => router.push('/join')}
          className="btn-touch w-full"
          style={{
            background: 'rgba(124, 58, 237, 0.12)',
            border: '1.5px solid rgba(124, 58, 237, 0.4)',
            color: '#a78bfa',
            fontSize: '18px',
          }}
        >
          🔗 방 참여하기
        </button>
      </div>

      <p className="mt-10 text-xs text-center" style={{ color: '#374151' }}>
        앱 설치 없이 링크/QR로 참여 가능
      </p>
    </main>
  )
}
