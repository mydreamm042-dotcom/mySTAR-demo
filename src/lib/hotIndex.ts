export const HOT_HOLD_MS = 5 * 60 * 1000
export const HOT_DECAY_MS = 10 * 60 * 1000
export const HOT_TOTAL_MS = HOT_HOLD_MS + HOT_DECAY_MS
export const HOT_SCALE = 100 / 30

/**
 * HOT 지수 계산: 누적 탭 수(참여자 수로 정규화)를 피크로 삼고,
 * 마지막 탭 이후 HOT_HOLD_MS 동안은 피크를 유지하다가
 * 이후 HOT_DECAY_MS에 걸쳐 0까지 선형 감소한다.
 * `now`를 인자로 받아 과거 임의 시점의 지수도 재구성할 수 있다 (결과 화면 시간별 차트용).
 */
export function calcHotIndex(
  hotReactions: { created_at: string }[],
  participantCount: number,
  now: number = Date.now(),
): number {
  const pastReactions = hotReactions.filter(r => new Date(r.created_at).getTime() <= now)
  if (pastReactions.length === 0) return 0

  const n = Math.max(1, participantCount)
  const times = pastReactions.map(r => new Date(r.created_at).getTime())
  const lastTapTime = Math.max(...times)
  const peak = Math.min(100, Math.round(pastReactions.length / Math.sqrt(n) * HOT_SCALE))
  const elapsed = now - lastTapTime

  if (elapsed < HOT_HOLD_MS) return peak
  if (elapsed < HOT_TOTAL_MS) {
    const decayProgress = (elapsed - HOT_HOLD_MS) / HOT_DECAY_MS
    return Math.max(0, Math.round(peak * (1 - decayProgress)))
  }
  return 0
}
