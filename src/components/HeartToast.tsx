'use client'

import { useEffect, useState } from 'react'

interface Toast {
  id: string
  message: string
  emoji: string
  color: string
}

let addToastFn: ((toast: Omit<Toast, 'id'>) => void) | null = null

export function showToast(toast: Omit<Toast, 'id'>) {
  addToastFn?.(toast)
}

export default function HeartToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    addToastFn = (t) => {
      const id = Math.random().toString(36).slice(2)
      setToasts(prev => [...prev, { ...t, id }])
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3000)
    }
    return () => { addToastFn = null }
  }, [])

  return (
    <div className="fixed bottom-32 left-0 right-0 flex flex-col items-center gap-2 z-30 pointer-events-none max-w-md mx-auto px-6">
      {toasts.map(t => (
        <div key={t.id} className="animate-fade-in glass-card px-5 py-3 flex items-center gap-3">
          <span className="text-2xl animate-pulse-heart">{t.emoji}</span>
          <span className="text-sm font-medium" style={{ color: t.color }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
