## ADR-110 — frontdoor-queue를 폐기하고 "승격"을 "등록"으로 바꾼다

- Status: Accepted
- Date: 2026-07-08
- Supersedes: ADR-045

### 맥락

ADR-045는 추천 후보 순위와 사용자 선택 대기 상태를 별도 frontdoor queue에 두고, 사용자가 준비 시작을 선택한 후보만 ledger로 승격하는 대기열 단계를 세웠다.
이 대기열은 fos-career 웹 대시보드([[ADR-102]]로 폐기)가 읽는 선택 전 staging을 전제로 했다.

대시보드가 사라진 지금은 대기열 단계가 흐름을 늘리기만 한다.
파일 기반 흐름에서는 추천 결과에서 사용자가 바로 고르고, 고른 후보를 positions-queue에 넣으면 된다.
"승격(promote)"이라는 용어도 대기열에서 원장으로 올린다는 맥락이 사라져 어색하다.

### 결정

frontdoor-queue를 폐기하고 대기열 단계를 없앤다.
흐름을 "추천 → 사용자 선택 → positions-queue 등록"으로 단순화한다.

- 코드 제거 — `frontdoor_queue_builder.ts`·`frontdoor_queue_io.ts`·`frontdoor_queue_schema.ts`·`promote_frontdoor_candidate.ts`를 git rm한다.
- 흐름 정리 — application-agent flow에서 frontdoor 의존을 끊는다. frontdoor는 `apply_position_action_request`·`apply_priority_request`·`priority_recommendation`·`priority_view`·`run.ts` 등 여러 파일에 얽혀 있어(실측 13개 파일), 단순 파일 삭제가 아니라 호출 흐름을 끊는 작업이다.
- 용어 교체 — 지원 후보를 positions-queue에 넣는 동작의 "승격(promote)"을 "등록"으로 바꾼다. 코드 식별자·주석·docs 산문 전반에 적용한다.
- 데이터 파일 — `data/runtime/application-agent/frontdoor-queue.jsonl`은 물리 이동 대신 폐기한다(runtime untracked, ADR-107 스코프).

ADR-045(plan094에서 삭제, git history 보존) 전체를 본 ADR로 대체한다.

용어 교체 범위 경계:

- 이 "승격→등록"은 지원 후보를 positions-queue에 넣는 맥락에만 적용한다.
- `study-topic-recommender`의 "promote"(학습 완료 토픽을 fos-study 발행 후보로 올림)는 별개 개념이므로 건드리지 않는다.

### 거절한 대안

- frontdoor-queue 유지 — 대시보드가 없는데도 선택 전 staging 단계가 흐름을 늘린다.
- 파일만 삭제하고 용어 유지 — "승격"의 대기열 맥락이 사라져 다음 실행자가 흐름을 오해한다.

### 결과

- 지원 흐름이 "추천 → 선택 → 등록" 3단계로 줄고, 선택 전 staging 파일을 관리하지 않는다.
- 단점 — frontdoor에 얽힌 13개 파일의 호출 흐름을 끊어야 하고, ledger rename(ADR-108)보다 먼저 해야 한다. frontdoor 파일이 `./ledger_io`·`./ledger_schema`를 import하므로 순서가 어긋나면 dangling import가 생긴다.

### 적용

- Phase 06에서 frontdoor 제거 + "등록" 용어 교체를 관심사 단위로 커밋한다(ADR-108 rename보다 먼저).
- 검증은 `bun --check` + application-agent smoke + 옛 `frontdoor`·"승격" 참조 0 grep으로 한다.
- `docs/data-schema.md`·`docs/code-architecture.md`·`docs/flow.md`에서 frontdoor-queue 스키마·경로·tombstone과 "승격" 표현을 정리한다.
- `docs/adr/INDEX.md`에 본 ADR의 supersede 관계를 남긴다(ADR-045는 plan094에서 삭제, git history 보존).
