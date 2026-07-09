## ADR-111 — durable 공고 필터를 config/position-filters.json으로 통합한다

- Status: Accepted
- Date: 2026-07-09
- Supersedes: [[ADR-095]]의 preferenceExcluded 위치 결정 부분

### 맥락

position-recommender의 공고 제외 신호가 여러 파일에 흩어져 있었다.

- `preferenceExcluded`(회사 선호 제외)는 `config/verified-company-research-targets.json`에 있었다([[ADR-095]]).
- cooldown(시한부 회사 감점)은 `state/company-cooldown.json`에 있다([[ADR-109]]).
- 역할 패턴 제외(Tech Lead·모델 연구·TCP/UDP 필수 등)는 `references/position-decision-criteria.md` 산문에 있다.

여기에 새 요구가 생겼다.
사용자가 특정 개별 공고를 "내일부터 안 보이게" 영구 억제하고 싶어했다.
이건 durable 선호라 config에 담아야 하는데, 신호가 흩어진 상태에서 별도 파일을 또 만들면 필터가 더 파편화된다.

### 결정

durable 공고 필터를 `config/position-filters.json` 단일 출처로 통합한다.

- 두 필드를 둔다.
  - `excludedCompanies` — 회사 단위 선호 제외. `preferenceExcluded.companies`를 이 필드로 이관한다.
  - `suppressedPostings` — 공고 URL 단위 억제. 신규 필드다.
- 소비 단계가 다르다.
  - `excludedCompanies`는 수집 시점 필터다. `collect_live_postings.ts`가 `setExcludedCompanies`로 주입해 해당 회사를 snapshot에서 제외한다.
  - `suppressedPostings`는 추천 시점 필터다. 회사는 계속 수집하되 특정 URL만 추천 티어와 다운로드 HTML에서 숨긴다.
- cooldown은 통합하지 않는다. 시한부 운영 상태라 `state/`가 정본이다([[ADR-109]]·[[ADR-107]]). config(durable)와 state(시한부)를 한 파일에 섞지 않는다.
- 역할 패턴의 일반 제외는 계속 `references/position-decision-criteria.md` 방법론 산문이 담당한다. `suppressedPostings`는 URL 단위라 같은 회사가 다른 URL로 새 공고를 올리면 다시 노출된다.
- [[ADR-095]]의 preferenceExcluded 위치 결정만 본 ADR로 대체한다. [[ADR-095]] 본문은 동결한다.

### 거절한 대안

- 공고 억제만 담는 별도 파일 신설 — 회사 제외와 공고 억제가 여전히 두 파일로 갈려 필터 파편화가 남는다.
- 역할 패턴까지 데이터화(excludedRolePatterns) — render/preview/skill 로직이 산문 대신 데이터를 읽도록 바꿔야 해 blast radius가 크고, 과제외 위험도 커진다.
- cooldown까지 통합 — 지원 결과 이벤트가 사람 검토용 config를 자동 갱신해 config/state 구분([[ADR-107]])이 무너진다.

### 결과

- durable 공고 필터가 한 파일에 모여 "무엇을 제외하는가"의 단일 출처가 생긴다.
- 회사 제외와 공고 억제를 한 곳에서 관리하면서도, 수집·추천 두 단계의 소비 차이는 `_meta`에 명시된다.
- `verified-company-research-targets.json`은 검증군·선호·키워드 등 회사 타깃 데이터만 남는다.
- 단점 — 필터를 읽는 collector·preview 렌더러가 새 파일 경로를 참조해야 한다.

### 적용

- `config/position-filters.json` 신설 (`excludedCompanies`·`suppressedPostings`·`_meta`).
- `config/verified-company-research-targets.json`에서 `preferenceExcluded` 블록 제거, `_meta.usage` 포인터 갱신.
- `scripts/position-recommender/collect_live_postings.ts`의 `loadExcludedCompanies`가 새 파일의 `excludedCompanies`를 읽는다.
- `scripts/position-recommender/render_candidate_preview.ts`가 `suppressedPostings` URL을 전체 공고 HTML에서 제외한다.
- `scripts/position-recommender/live-postings/policy.ts` 단일 출처 주석 갱신.
- `docs/data-schema.md`에 `config/position-filters.json` 항목 추가, preferenceExcluded 행 이동.
- `docs/adr/INDEX.md`에 ADR-111 행 추가, ADR-095 Status에 supersede 관계 링크.
- position-recommender `SKILL.md`와 references의 preferenceExcluded 참조를 새 파일로 갱신.
