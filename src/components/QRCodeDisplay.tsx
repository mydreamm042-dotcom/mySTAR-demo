'use client'

import { QRCodeSVG } from 'qrcode.react'

interface Props {
  url: string
  code: string
  roomName: string
}

export default function QRCodeDisplay({ url, code, roomName }: Props) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="flex flex-col items-center">
      <p className="text-lg font-bold mb-1">{roomName}</p>
      <p className="text-sm mb-5" style={{ color: '#6b7280' }}>QR코드로 스캔하거나 코드를 공유하세요</p>

      <div className="p-4 rounded-2xl mb-4" style={{ background: '#fff' }}>
        <QRCodeSVG value={url} size={180} />
      </div>

      <div className="text-3xl font-bold tracking-[0.3em] mb-4" style={{ color: '#a78bfa' }}>
        {code}
      </div>

      <button
        onClick={handleCopy}
        className="btn-touch w-full"
        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontSize: '15px' }}
      >
        🔗 링크 복사하기
      </button>
    </div>
  )
}
