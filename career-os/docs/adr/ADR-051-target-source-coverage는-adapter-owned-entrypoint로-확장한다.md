## ADR-051 — target source coverage는 adapter-owned entrypoint로 확장한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

`position-recommender` 수집기는 Wanted broad scan과 Toss 일부 수집을 갖췄지만, 사용자가 실제로 챙기고 싶은 target posting은 official careers나 확인된 target URL에 더 자주 있다.
대시보드는 broad Wanted 결과만 보여주면 사용자의 실제 우선순위와 어긋날 수 있다.

ADR-047로 collector는 source adapter 단위로 분리됐다.
따라서 새 source를 seed 파일로 따로 흩뜨리기보다, source별 entrypoint와 known target URL은 해당 adapter가 소유하는 편이 drift를 줄인다.

### 결정

- Wanted broad scan은 유지한다.
- configured source set의 `all`은 등록된 모든 source를 뜻한다.
- Toss는 configured source set이 `all`이면 포함한다.
- KakaoPay official careers/GreetingHR와 KakaoPay Securities official careers를 primary source로 추가한다.
- Wanted URL/detail verification은 secondary path로 지원한다.
  source key는 `wanted`를 유지하고, discovery mode로 `broad`와 `target-url`을 구분한다.
- 별도 seed 파일은 만들지 않는다.
  각 source adapter가 entrypoint, known target URL, source-local seed를 소유한다.
- 모든 official listing과 seed 후보는 import 전에 detail page를 fetch하고 active/open evidence를 기록해야 한다.
- 한 source가 실패해도 성공한 source의 결과는 계속 import와 dashboard 표시로 이어진다.
- dedupe/upsert는 URL을 우선하고, URL이 불안정할 때 hash를 보조로 쓴다.
- 대시보드는 source filter와 brief diagnostics를 보여준다.
  상세 실패는 runtime output에 남긴다.

### 결과

- 사용자가 실제로 관심 있는 KakaoPay, KakaoPay Securities, Toss, Wanted target URL 후보가 broad scan 뒤에 묻히지 않는다.
- source별 fetch 방식과 target URL 소유권이 adapter 내부에 머물러 새 source 추가 비용이 작다.
- dashboard는 source별 coverage 상태를 짧게 보여주되, 실패 원문과 디버깅 상세는 collector runtime에 남긴다.
- 단점: adapter 내부에 source-local seed가 들어가므로 target URL 변경 시 코드 리뷰가 필요하다.
