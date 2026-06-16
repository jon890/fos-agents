## ADR-075 — position daily runner는 TS를 정본으로 하고 sh는 shim으로 둔다

- Status: Accepted
- Date: 2026-06-11

### 맥락

`run_daily_with_claude.sh`는 collector 실행, Claude 호출, stale output 검증, active recommendation 검증, Discord 알림까지 여러 책임을 갖고 있었다.
awk와 shell string 처리로 추천 항목을 파싱하면 변경이 커질수록 검증과 유지보수가 어렵다.
career-os runner는 대부분 Bun TypeScript로 모이는 추세이며, position runner도 같은 방향으로 맞춘다.

### 결정

- `scripts/position-recommender/run_daily_with_claude.ts`를 daily runner 정본으로 둔다.
- 기존 `.sh` 경로는 cron과 수동 호출 호환을 위해 TS runner를 호출하는 얇은 shim으로 유지한다.
- 기존 CLI/env 계약을 유지한다.
  `--validate-existing`, `POSITION_RECOMMENDER_SOURCE`, `POSITION_RECOMMENDER_NOTIFY`, `POSITION_RECOMMENDER_NOTIFY_DRY_RUN`을 그대로 지원한다.
- report/runtime freshness check와 강력/도전 추천 active link 검증은 TS parser로 수행한다.
- cron command를 TS 직접 호출로 바꾸는 일은 TS runner 검증 후 별도 변경으로 처리한다.

### 결과

- runner 로직을 TypeScript에서 테스트·확장하기 쉬워진다.
- 기존 sh 호출자는 깨지지 않는다.
- cron 전환 전후를 분리해 운영 위험을 줄인다.

### 적용

- `scripts/position-recommender/run_daily_with_claude.ts`
- `scripts/position-recommender/run_daily_with_claude.sh`
- `docs/flow.md`
