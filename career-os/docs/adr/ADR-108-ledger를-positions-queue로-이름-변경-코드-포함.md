## ADR-108 — ledger를 positions-queue로 이름 변경하고 코드 심볼·파일명까지 통일한다

- Status: Accepted
- Date: 2026-07-08

### 맥락

`ledger`는 실제 지원 준비가 시작된 공고 원장을 가리키는 데이터 파일과 코드(`ledger_io.ts`·`ledger_schema.ts`, `Ledger*` 심볼)로 쓰인다.
`ledger`(원장)라는 이름은 회계 장부를 연상시켜 의미가 과하게 넓다.
실제로는 사용자가 지원을 밀고 있는 포지션들의 지속 큐다.

이름이 데이터 경로·산문뿐 아니라 코드 심볼·파일명에도 박혀 있어, 데이터 파일만 바꾸면 코드와 용어가 어긋난다.

### 결정

`ledger`를 `positions-queue`로 이름 변경하고, 데이터 파일·코드 심볼·파일명을 한 용어로 통일한다(2026-07-08 사용자 결정 M2=A).

- 데이터 파일 — `data/applications/ledger.jsonl` → `state/positions-queue.jsonl`(버킷 이동은 ADR-107).
- 코드 파일 — `scripts/application-agent/ledger_io.ts`·`ledger_schema.ts` → `positions_queue_io.ts`·`positions_queue_schema.ts`(git mv).
- 코드 심볼 — `Ledger*` 계열을 `PositionsQueue*` 계열로 rename하고, import 참조를 갱신한다(ledger 심볼은 현재 21개 파일이 참조한다).
- 산문 — docs·SKILL·주석의 "ledger" 표현을 "positions-queue"로 교체한다.

이름 변경은 큐의 책임을 바꾸지 않는다.
실제 지원 준비가 시작된 공고 원장이라는 정의와 상태 전이는 그대로 둔다.

### 거절한 대안

- 데이터 파일만 rename하고 코드는 `ledger` 유지 — 데이터 경로와 코드 식별자가 두 용어로 갈려 다음 실행자가 혼동한다.
- 이름을 그대로 두기 — `ledger`의 과한 의미 폭 문제가 남는다.

### 결과

- 데이터 파일명과 코드 심볼이 `positions-queue` 한 용어로 정렬된다.
- 단점 — 21개 파일의 심볼·import를 함께 고쳐야 하고, 순서를 지키지 않으면 dangling import가 생긴다. frontdoor 코드가 `./ledger_io`·`./ledger_schema`를 import하므로, frontdoor 제거(ADR-110)를 먼저 하고 나서 rename한다.

### 적용

- Phase 07에서 `git mv` + 심볼 rename + import 갱신을 관심사 단위로 커밋한다.
- 검증은 `bun --check` + application-agent smoke + 옛 `ledger` 참조 0 grep으로 한다.
- `docs/data-schema.md`·`docs/code-architecture.md`·`docs/flow.md`의 `ledger` 경로·심볼을 `positions-queue`로 갱신한다.
