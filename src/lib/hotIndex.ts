export const HOT_HOLD_MS = 5 * 60 * 1000
export const HOT_DECAY_MS = 10 * 60 * 1000
export const HOT_TOTAL_MS = HOT_HOLD_MS + HOT_DECAY_MS
export const HOT_PER_TAP = 5

/**
 * HOT 지수 계산: 평생 누적 탭 수가 아니라, 가장 최근 탭 직전 HOT_HOLD_MS(5분) 동안
 * 몰린 탭 개수로 피크를 정한다. (누적 방식이면 조용하다가 탭 1번만 눌러도 그동안
 * 쌓인 전체 히스토리 때문에 100%까지 튀어오르는 문제가 있었음)
 * 참여자 수와도 무관하다 — 참여자가 나갔다 들어와도 지수가 흔들리지 않도록.
 * 마지막 탭 이후 HOT_HOLD_MS 동안은 피크를 유지하다가 이후 HOT_DECAY_MS에 걸쳐 0까지 선형 감소한다.
 * `now`를 인자로 받아 과거 임의 시점의 지수도 재구성할 수 있다 (결과 화면 시간별 차트용).
 */
export function calcHotIndex(
  hotReactions: { created_at: string }[],
  now: number = Date.now(),
): number {
  const pastTimes = hotReactions
    .map(r => new Date(r.created_at).getTime())
    .filter(t => t <= now)
  if (pastTimes.length === 0) return 0

  const lastTapTime = Math.max(...pastTimes)
  const recentCount = pastTimes.filter(t => t > lastTapTime - HOT_HOLD_MS).length
  const peak = Math.min(100, recentCount * HOT_PER_TAP)
  const elapsed = now - lastTapTime

  if (elapsed < HOT_HOLD_MS) return peak
  if (elapsed < HOT_TOTAL_MS) {
    const decayProgress = (elapsed - HOT_HOLD_MS) / HOT_DECAY_MS
    return Math.max(0, Math.round(peak * (1 - decayProgress)))
  }
  return 0
}
