## ADR-047 — position-recommender collector adapter를 모듈 경계로 승격한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`scripts/position-recommender/collect_live_postings.ts`는 [[ADR-043]] 이후 source adapter와 active validator 개념을 갖췄지만, 실제 파일은 Wanted 수집, Toss 수집, 공통 역할 필터, active validator, markdown renderer, CLI 처리가 한 파일에 모여 있다.
새 채용 source를 추가하기 전에 물리적 모듈 경계를 만들지 않으면 source별 HTML/API 파싱과 공통 정책이 다시 섞일 가능성이 높다.

또한 사용자는 추천 판단을 LLM에 최대한 맡기고 싶다고 명시했다. 따라서 collector는 "지원 가능한 active/open 개별 공고 후보"를 깨끗하게 만드는 역할까지만 담당하고, 순위·fit/gap·커리어 서사 판단은 LLM 기반 position-recommender가 맡는다.

### 결정

- `collect_live_postings.ts`는 기존 CLI 호환을 유지하는 얇은 entrypoint로 축소한다.
- collector 구현은 `scripts/position-recommender/live-postings/` 아래로 분리한다.
  - `types.ts` — `Posting`, `SourceAdapter`, `CollectContext`, `CollectResult`.
  - `policy.ts` — 수집 가능성 필터. 서버/AI 실무 개발 역할, 계약직/인턴/비서버 직군 제외, 제외 회사 필터만 담당한다.
  - `active-validator.ts` — `link_type=direct_posting`, `posting_status=active/open`, active evidence 같은 snapshot gate.
  - `render.ts` — markdown snapshot 출력만 담당한다.
  - `cli.ts` — arg parsing, adapter 실행, 파일 쓰기.
  - `adapters/wanted.ts`, `adapters/toss.ts`, `adapters/index.ts` — source별 수집과 registry.
- 이번 plan에서는 새 source를 추가하지 않는다. Wanted/Toss 동작 보존과 구조 분리에 집중한다.
- 새 source 추가는 후속 plan에서 adapter만 추가하는 방식으로 진행한다.
- 구현 phase는 `career-os/docs/adr.md`, `docs/code-architecture.md`, `docs/flow.md`를 수정하지 않는다. 구현 중 docs drift가 발견되면 phase는 `PHASE_BLOCKED`로 멈추고 메인 세션에서 planning/docs를 다시 조정한다.

### 결과

- Wanted/Toss 수집 로직을 독립적으로 변경·검증할 수 있다.
- KakaoPay, KakaoPay Securities, Greenhouse, Lever 같은 source는 후속 plan에서 adapter 단위로 추가 가능하다.
- collector가 추천 판단까지 과하게 떠안지 않고, LLM 추천 흐름과 책임 경계가 분명해진다.
- daily runner는 기존 `collect_live_postings.ts` 경로를 계속 호출하므로 cron 진입점 변경이 작다.

### 적용

- `tasks/plan040-position-recommender-collector-modularization/` — 구현 계획 5 phase.
- `docs/code-architecture.md` — collector 모듈 구조.
- `docs/flow.md` — position-recommender 수집 흐름.
