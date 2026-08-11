## ADR-110 — frontdoor queue를 폐기하고 지원 후보를 바로 등록한다

- Status: Accepted
- Date: 2026-07-08
- Supersedes: ADR-045

### 맥락

frontdoor queue는 웹 대시보드가 추천 후보를 보여주고 사용자가 선택할 때까지 대기시키는 단계였다.
파일 기반 흐름에서는 추천 결과에서 사용자가 고른 후보를 바로 positions queue에 넣을 수 있다.

### 결정

- frontdoor queue와 관련 코드·상태 파일을 유지하지 않는다.
- 지원 흐름을 `추천 → 사용자 선택 → state/positions-queue.jsonl 등록`으로 둔다.
- 대기열에서 원장으로 올린다는 `승격` 대신 `등록`을 사용한다.
- 학습 토픽을 공개 후보로 올리는 `promote`는 별개 개념으로 유지한다.

### 거절한 대안

- frontdoor queue를 남기면 소비자가 없는 상태와 전이 규칙을 계속 관리해야 한다.

### 결과

지원 후보 선택과 등록 흐름이 단순해지고 사용하지 않는 staging 상태가 사라졌다.
