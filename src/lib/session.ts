const SESSION_KEY = 'mystar_session_token'
const ROOM_KEY = 'mystar_room_data'
const COOLDOWN_PREFIX = 'mystar_cd_'

export function getSessionToken(): string {
  if (typeof window === 'undefined') return ''
  let token = localStorage.getItem(SESSION_KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, token)
  }
  return token
}

export interface StoredRoomData {
  roomId: string
  roomCode: string
  roomName: string
  participantId: string
  nickname: string
  isHost: boolean
}

export function storeRoomData(data: StoredRoomData) {
  if (typeof window === 'undefined') return
  localStorage.setItem(ROOM_KEY, JSON.stringify(data))
}

export function getRoomData(): StoredRoomData | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(ROOM_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function clearRoomData() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(ROOM_KEY)
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function getCooldownRemaining(roomId: string, type: string): number {
  if (typeof window === 'undefined') return 0
  const raw = localStorage.getItem(`${COOLDOWN_PREFIX}${roomId}_${type}`)
  if (!raw) return 0
  return Math.max(0, parseInt(raw) - Date.now())
}

export function setCooldown(roomId: string, type: string, durationMs: number) {
  if (typeof window === 'undefined') return
  localStorage.setItem(`${COOLDOWN_PREFIX}${roomId}_${type}`, String(Date.now() + durationMs))
}
