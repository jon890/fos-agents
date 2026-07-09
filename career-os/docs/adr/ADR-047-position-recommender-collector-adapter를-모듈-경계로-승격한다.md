## ADR-047 — position-recommender collector를 source adapter 모듈 경계로 승격·확장한다

- Status: Accepted
- Date: 2026-06-06
- Supersedes: ADR-043(공고 수집은 source adapter + active validator로 분리, 2026-06-05), ADR-051(target source coverage는 adapter-owned entrypoint로 확장, 2026-06-07) — 세 결정 모두 collector adapter 경계 형성의 연속 단계라 본 ADR에 통합, 두 파일 제거(plan094)

### 맥락

세 결정은 같은 collector 서브시스템이 3주 안에 걸친 연속 진화다: 개념 분리(043) → 물리적 모듈 경계(047, 본 ADR) → source coverage 확장(051).

**1단계 — 개념 분리 배경(구 ADR-043, 2026-06-05)**

[[ADR-039]]로 추천 단위는 개별 active/open 공고로 고정됐다.
그러나 당시 수집기는 Wanted detail 검증과 렌더링이 단일 파일에 응집돼 있었고, Toss는 커리어 아티클 feed가 먼저 노출되어 개별 공고와 혼동될 수 있었다.
사용자는 정적 도구가 공고 활성 여부를 먼저 검증하고, LLM은 후보자 fit 판단만 맡는 구조를 원했다.

**2단계 — 물리적 모듈 경계 필요성(본 ADR, 2026-06-06)**

`scripts/position-recommender/collect_live_postings.ts`는 1단계 이후 source adapter와 active validator 개념을 갖췄지만, 실제 파일은 Wanted 수집, Toss 수집, 공통 역할 필터, active validator, markdown renderer, CLI 처리가 한 파일에 모여 있다.
새 채용 source를 추가하기 전에 물리적 모듈 경계를 만들지 않으면 source별 HTML/API 파싱과 공통 정책이 다시 섞일 가능성이 높다.

또한 사용자는 추천 판단을 LLM에 최대한 맡기고 싶다고 명시했다. 따라서 collector는 "지원 가능한 active/open 개별 공고 후보"를 깨끗하게 만드는 역할까지만 담당하고, 순위·fit/gap·커리어 서사 판단은 LLM 기반 position-recommender가 맡는다.

**3단계 — coverage 확장 필요성(구 ADR-051, 2026-06-07)**

`position-recommender` 수집기는 Wanted broad scan과 Toss 일부 수집을 갖췄지만, 사용자가 실제로 챙기고 싶은 target posting은 official careers나 확인된 target URL에 더 자주 있다.
대시보드는 broad Wanted 결과만 보여주면 사용자의 실제 우선순위와 어긋날 수 있다.
2단계로 collector는 source adapter 단위로 분리됐다. 따라서 새 source를 seed 파일로 따로 흩뜨리기보다, source별 entrypoint와 known target URL은 해당 adapter가 소유하는 편이 drift를 줄인다.

### 결정

**1단계 결정(개념 분리)**

- `collect_live_postings.ts`는 source adapter 계층과 공통 active validator 계층으로 분리한다.
- adapter는 구조화된 public endpoint나 SSR data에서 개별 공고 URL, active/open 근거, JD, 지원 가능 근거, 마감 정보를 수집한다.
- validator는 `link_type=direct_posting`, `posting_status=active/open`, active evidence, backend/server 필터, 계약직/인턴 제외, 마감 임박도를 공통으로 적용한다.
- Toss는 career article 자체를 공고로 쓰지 않는다. article CTA에서 `job-detail` URL을 따라가고, job detail page의 JD와 지원 폼이 확인된 항목만 open 공고로 채택한다.
- `opened_at`처럼 값이 없는 필드는 snapshot에서 생략한다. 마감 판단에 필요한 `closes_at`, `days_until_close`, `close_urgency`는 유지한다.
- LLM은 active/open 여부를 추정하지 않는다. LLM 입력은 validator를 통과한 snapshot으로 제한하고, LLM은 fit, upside, gap, 준비 액션만 판단한다.

**2단계 결정(물리적 모듈 경계, 본 ADR 핵심)**

- `collect_live_postings.ts`는 기존 CLI 호환을 유지하는 얇은 entrypoint로 축소한다.
- collector 구현은 `live-postings/` 서브디렉터리 아래 types, policy, active-validator, render, cli, adapters 단위로 분리한다. 상세 파일 구조는 [[ADR-035]] 4레이어 컨벤션을 따른다.
- 이번 전환에서는 새 source를 추가하지 않는다. Wanted/Toss 동작 보존과 구조 분리에 집중한다.
- 새 source 추가는 후속 plan에서 adapter만 추가하는 방식으로 진행한다.

**3단계 결정(coverage 확장)**

- Wanted broad scan은 유지하고, KakaoPay, KakaoPay Securities, Toss를 primary source로 추가한다.
- Wanted URL/detail verification은 secondary path로 지원한다.
- 별도 seed 파일은 만들지 않는다. 각 source adapter가 entrypoint와 source-local seed를 소유한다.
- 모든 official listing은 import 전에 active/open evidence를 기록해야 한다.
- 한 source가 실패해도 성공한 source의 결과는 계속 import와 dashboard 표시로 이어진다.
- 대시보드는 source filter와 brief diagnostics를 보여주고, 상세 실패는 runtime output에 남긴다.

### 결과

- Toss를 포함한 공식 career 수집을 확장해도 커리어 아티클, 회사 홈, 검색 페이지가 추천 티어에 섞이지 않는다.
- source별 수집 실패와 active 검증 실패를 diagnostics로 남길 수 있다.
- application-flow-agent ingest로 넘길 후보의 품질이 높아진다.
- public endpoint 또는 SSR schema가 바뀌면 해당 adapter만 수정하면 된다.
- Wanted/Toss 수집 로직을 독립적으로 변경·검증할 수 있다.
- KakaoPay, KakaoPay Securities, Greenhouse, Lever 같은 source는 후속 plan에서 adapter 단위로 추가 가능하다.
- collector가 추천 판단까지 과하게 떠안지 않고, LLM 추천 흐름과 책임 경계가 분명해진다.
- daily runner는 기존 `collect_live_postings.ts` 경로를 계속 호출하므로 cron 진입점 변경이 작다.
- 사용자가 실제로 관심 있는 KakaoPay, KakaoPay Securities, Toss, Wanted target URL 후보가 broad scan 뒤에 묻히지 않는다.
- source별 fetch 방식과 target URL 소유권이 adapter 내부에 머물러 새 source 추가 비용이 작다.
- dashboard는 source별 coverage 상태를 짧게 보여주되, 실패 원문과 디버깅 상세는 collector runtime에 남긴다.
- 단점: adapter 내부에 source-local seed가 들어가므로 target URL 변경 시 코드 리뷰가 필요하다.

### 적용

- 현재 구조: `scripts/position-recommender/collect_live_postings.ts`(CLI 호환 entrypoint) + `live-postings/`(types, policy, active-validator, render, cli, adapters).
- `docs/code-architecture.md`의 `collect_live_postings.ts` 항목은 본 ADR(047)만 인용한다.
