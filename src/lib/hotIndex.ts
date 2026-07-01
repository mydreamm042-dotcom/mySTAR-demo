export const HOT_HOLD_MS = 5 * 60 * 1000
export const HOT_DECAY_MS = 10 * 60 * 1000
export const HOT_TOTAL_MS = HOT_HOLD_MS + HOT_DECAY_MS
export const HOT_PER_TAP = 5

// 탭 사이 경과 시간(elapsed)만큼 값을 감쇠시킨다: HOT_HOLD_MS 동안은 그대로 유지,
// 이후 HOT_DECAY_MS에 걸쳐 0까지 선형 감소, 그 이후는 0.
function decayValue(value: number, elapsed: number): number {
  if (elapsed < HOT_HOLD_MS) return value
  if (elapsed < HOT_TOTAL_MS) return value * (1 - (elapsed - HOT_HOLD_MS) / HOT_DECAY_MS)
  return 0
}

/**
 * HOT 지수 계산: 탭이 하나씩 발생할 때마다, 그 시점까지 감쇠된 현재 값에
 * HOT_PER_TAP만큼 더해가는 방식으로 처음부터 순서대로 누적 시뮬레이션한다.
 * (평생 누적 탭 "개수" 기반이 아니라서, 오래 조용하다가 탭 1번만 눌러도
 * 과거 히스토리 때문에 100%로 튀지 않고, 식는 중이라면 그 시점의 감쇠된
 * 값에서 딱 한 번 오르는 만큼만 더해진다)
 * `now`를 인자로 받아 과거 임의 시점의 지수도 재구성할 수 있다 (결과 화면 시간별 차트용).
 */
export function calcHotIndex(
  hotReactions: { created_at: string }[],
  now: number = Date.now(),
): number {
  const times = hotReactions
    .map(r => new Date(r.created_at).getTime())
    .filter(t => t <= now)
    .sort((a, b) => a - b)
  if (times.length === 0) return 0

  let value = 0
  let lastTapTime = -Infinity
  for (const t of times) {
    const decayed = decayValue(value, t - lastTapTime)
    value = Math.min(100, decayed + HOT_PER_TAP)
    lastTapTime = t
  }

  return Math.max(0, Math.round(decayValue(value, now - lastTapTime)))
}
