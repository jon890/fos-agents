/**
 * 일을 하는 동안 정해진 간격으로 GC 를 돌린다.
 *
 * 수집은 응답 본문을 수십 MB 읽고 버린다. 그 본문은 JS 힙 밖에 잡혀 있어, 힙이 작은 동안에는
 * 엔진이 GC 를 미루고 프로세스 메모리(RSS)만 계속 는다. 메모리 한도가 있는 실행 공간에서는
 * 그 사이에 한도를 넘는다(실측: 공고 56건 수집에서 최대 RSS 253MB → 주기적 GC 로 170MB 안팎).
 * Bun 이 아니면 그냥 일을 한다.
 */
export async function withPeriodicGc<T>(work: () => Promise<T>, intervalMs = 250): Promise<T> {
  const bun = (globalThis as { Bun?: { gc(force: boolean): void } }).Bun;
  if (!bun) return work();
  const timer = setInterval(() => bun.gc(true), intervalMs);
  try {
    return await work();
  } finally {
    clearInterval(timer);
  }
}
