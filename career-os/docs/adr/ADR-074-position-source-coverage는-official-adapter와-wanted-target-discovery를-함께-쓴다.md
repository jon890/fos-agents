## ADR-074 — position source coverage는 official adapter와 Wanted target discovery를 함께 쓴다

- Status: Accepted
- Date: 2026-06-11

### 맥락

포지션 추천은 NHN보다 나은 회사군을 우선 탐색해야 한다.
하지만 daily runner 기본 Wanted broad scan만으로는 카카오, 네이버, 쿠팡, 라인 같은 선호 회사의 active 공고가 자주 누락된다.
반대로 모든 회사의 공식 채용 사이트가 안정적인 API를 제공하지는 않는다.
특히 Coupang 공식 careers는 curl/agent-browser 접근에서 Cloudflare 차단을 반환할 수 있다.
다만 공식 `sitemap.xml`은 접근 가능하고 개별 job URL을 제공하며, Bun fetch detail은 일부 환경에서 통과한다.

### 결정

- official source adapter를 추가할 수 있는 회사는 source별 adapter로 수집한다.
- KakaoMobility와 NAVER Careers는 1차 official adapter로 추가한다.
- Coupang처럼 공식 detail/listing HTML이 fetch에서 차단되는 회사는 Wanted target keyword discovery를 1차 fallback으로 유지한다.
- Coupang 공식 `coupang.jobs`는 `sitemap.xml` 기반 official sitemap adapter를 추가하고, 가능한 경우 detail fetch로 JD를 보강한다.
  detail fetch 실패는 diagnostics와 risk flag에 남기고, JD 상세/근무지는 후속 browser/manual 확인 대상으로 둔다.
- Wanted adapter는 broad scan 외에 선호 회사 키워드 검색을 수행하고, detail API `status=active`로 검증된 개별 공고만 snapshot에 넣는다.
- 새 source는 `--source all` shadow 검증을 먼저 거친다.
- 2026-06-11 shadow 검증에서 active/direct guard가 통과했으므로 daily runner 기본값을 `POSITION_RECOMMENDER_SOURCE=all`로 전환한다.

### 결과

- 선호 회사군 공고가 Wanted 최신순 broad scan 뒤에 묻히는 문제를 줄인다.
- 공식 adapter가 가능한 source와 fallback discovery가 필요한 source를 분리해 운영할 수 있다.
- Coupang은 공식 direct job URL을 수집하고 detail fetch가 성공하면 JD까지 제공하되, 차단/레벨 mismatch 가능성은 추천에서 보수적으로 확인하게 한다.
- active/open direct posting guard는 기존과 동일하게 유지된다.
