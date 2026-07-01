export const HOT_HOLD_MS = 5 * 60 * 1000
export const HOT_DECAY_MS = 10 * 60 * 1000
export const HOT_TOTAL_MS = HOT_HOLD_MS + HOT_DECAY_MS

// 탭 1회당 증가율은 그 탭이 발생한 순간의 참여자 수에 반비례한다 (인원이 적으면 더 크게,
// 많으면 더 작게 오른다). 기준값은 참여자 4명일 때 정확히 2%가 되도록 보정한 것.
export const HOT_BASE_INCREMENT = 4

// 탭 사이 경과 시간(elapsed)만큼 값을 감쇠시킨다: HOT_HOLD_MS 동안은 그대로 유지,
// 이후 HOT_DECAY_MS에 걸쳐 0까지 선형 감소, 그 이후는 0.
function decayValue(value: number, elapsed: number): number {
  if (elapsed < HOT_HOLD_MS) return value
  if (elapsed < HOT_TOTAL_MS) return value * (1 - (elapsed - HOT_HOLD_MS) / HOT_DECAY_MS)
  return 0
}

// 탭이 발생한 "그 순간"의 참여자 수(reaction.value에 서버가 기록해둔 값) 기준으로
// 이번 탭의 증가율을 계산한다. 이후 참여자 수가 바뀌어도 이 값은 재계산되지 않는다.
function tapIncrement(participantCountAtTap: number | null | undefined): number {
  const n = Math.max(1, participantCountAtTap ?? 1)
  return HOT_BASE_INCREMENT / Math.sqrt(n)
}

/**
 * HOT 지수 계산: 탭이 하나씩 발생할 때마다, 그 시점까지 감쇠된 현재 값에
 * 그 탭 순간의 참여자 수 기준 증가율을 더해가는 방식으로 처음부터 순서대로 누적 시뮬레이션한다.
 * (평생 누적 탭 "개수" 기반이 아니라서, 오래 조용하다가 탭 1번만 눌러도
 * 과거 히스토리 때문에 100%로 튀지 않고, 식는 중이라면 그 시점의 감쇠된
 * 값에서 딱 한 번 오르는 만큼만 더해진다. 참여자가 나갔다 들어와도 이미
 * 누적된 값은 그대로 유지되고, 앞으로의 탭 증가율만 새 인원수를 반영한다)
 * `now`를 인자로 받아 과거 임의 시점의 지수도 재구성할 수 있다 (결과 화면 시간별 차트용).
 */
export function calcHotIndex(
  hotReactions: { created_at: string; value?: number | null }[],
  now: number = Date.now(),
): number {
  const events = hotReactions
    .map(r => ({ t: new Date(r.created_at).getTime(), value: r.value }))
    .filter(e => e.t <= now)
    .sort((a, b) => a.t - b.t)
  if (events.length === 0) return 0

  let value = 0
  let lastTapTime = -Infinity
  for (const e of events) {
    const decayed = decayValue(value, e.t - lastTapTime)
    value = Math.min(100, decayed + tapIncrement(e.value))
    lastTapTime = e.t
  }

  return Math.max(0, Math.round(decayValue(value, now - lastTapTime)))
}
