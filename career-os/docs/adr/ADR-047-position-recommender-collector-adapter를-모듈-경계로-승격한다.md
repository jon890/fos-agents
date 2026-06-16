## ADR-047 — position-recommender collector adapter를 모듈 경계로 승격한다

- Status: Accepted
- Date: 2026-06-06

### 맥락

`scripts/position-recommender/collect_live_postings.ts`는 [[ADR-043]] 이후 source adapter와 active validator 개념을 갖췄지만, 실제 파일은 Wanted 수집, Toss 수집, 공통 역할 필터, active validator, markdown renderer, CLI 처리가 한 파일에 모여 있다.
새 채용 source를 추가하기 전에 물리적 모듈 경계를 만들지 않으면 source별 HTML/API 파싱과 공통 정책이 다시 섞일 가능성이 높다.

또한 사용자는 추천 판단을 LLM에 최대한 맡기고 싶다고 명시했다. 따라서 collector는 "지원 가능한 active/open 개별 공고 후보"를 깨끗하게 만드는 역할까지만 담당하고, 순위·fit/gap·커리어 서사 판단은 LLM 기반 position-recommender가 맡는다.

### 결정

- `collect_live_postings.ts`는 기존 CLI 호환을 유지하는 얇은 entrypoint로 축소한다.
- collector 구현은 `live-postings/` 서브디렉터리 아래 types, policy, active-validator, render, cli, adapters 단위로 분리한다.
  상세 파일 구조는 [[ADR-035]] 4레이어 컨벤션을 따른다.
- 이번 전환에서는 새 source를 추가하지 않는다. Wanted/Toss 동작 보존과 구조 분리에 집중한다.
- 새 source 추가는 후속 plan에서 adapter만 추가하는 방식으로 진행한다.

### 결과

- Wanted/Toss 수집 로직을 독립적으로 변경·검증할 수 있다.
- KakaoPay, KakaoPay Securities, Greenhouse, Lever 같은 source는 후속 plan에서 adapter 단위로 추가 가능하다.
- collector가 추천 판단까지 과하게 떠안지 않고, LLM 추천 흐름과 책임 경계가 분명해진다.
- daily runner는 기존 `collect_live_postings.ts` 경로를 계속 호출하므로 cron 진입점 변경이 작다.

