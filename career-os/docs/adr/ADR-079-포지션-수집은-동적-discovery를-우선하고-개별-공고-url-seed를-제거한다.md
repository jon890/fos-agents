## ADR-079 — 포지션 수집은 동적 discovery를 우선하고 개별 공고 URL seed를 제거한다

- Status: Accepted
- Date: 2026-06-14

### 맥락

AI 전환 직무를 더 넓게 보려면 Toss, Wanted, 카카오계열, NAVER 계열, Coupang의 active 공고를 폭넓게 수집해야 한다.
기존 adapter 일부는 listing/API 수집을 보강하기 위해 특정 공고 URL을 `KNOWN_TARGET_URLS` 형태로 들고 있었다.
이 방식은 bootstrap 단계에서는 빠르게 검증할 수 있지만, 공고가 닫히면 stale URL이 diagnostics와 검증 흐름을 오염시킨다.
또한 "왜 이 공고만 계속 보는가"가 코드에 숨겨져 source coverage를 왜곡한다.

### 결정

- adapter의 기본 발견 방식은 official listing, official API, sitemap, keyword search다.
- 개별 공고 URL이나 Wanted 공고 ID는 adapter 코드에 하드코딩하지 않는다.
- 허용되는 URL 상수는 source discovery에 필요한 root entrypoint다.
  예: careers listing URL, public API URL, sitemap URL.
- 특정 공고 URL은 테스트 fixture, 문서 예시, 과거 리포트 검증 자료로만 둔다.
- Toss는 공식 `job-groups` API를 1차 source로 유지한다.
- Wanted는 broad scan과 keyword search로 선호 회사와 AI 전환 직무를 수집한다.
- 카카오계열은 GreetingHR 또는 공식 careers listing에서 detail URL을 발견하는 adapter를 계열사별로 확장한다.
- NAVER 계열은 공식 careers listing/API가 확인된 source만 adapter에 추가한다.
- Coupang은 공식 sitemap source를 유지하고, detail fetch 차단 시 diagnostics와 risk flag로 남긴다.
- stale 개별 공고 URL 부재는 phase block 사유가 아니다.
  block은 snapshot 후보가 0개이거나 active/open direct posting guard가 깨질 때만 발생한다.

### 결과

- 닫힌 과거 공고가 daily queue와 phase 검증을 막지 않는다.
- source별 coverage는 코드에 박힌 공고 ID가 아니라 발견 가능한 active 공고로 결정된다.
- AI/Backend 전환 직무 recall은 keyword/API/listing coverage로 높이고, 추천 티어는 여전히 active/open 개별 공고만 허용한다.
- 단점은 공식 listing/API 구조가 바뀔 때 source별 parser 유지보수가 필요하다는 점이다.

### 적용

- `scripts/position-recommender/live-postings/adapters/`
- `scripts/position-recommender/live-postings/adapters/README.md`
- `scripts/position-recommender/live-postings/policy.ts`
- `scripts/position-recommender/collect_live_postings.ts`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
