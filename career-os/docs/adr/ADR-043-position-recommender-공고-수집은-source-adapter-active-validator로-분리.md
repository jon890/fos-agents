## ADR-043 — position-recommender 공고 수집은 source adapter + active validator로 분리

- Status: Accepted
- Date: 2026-06-05

### 맥락

ADR-039로 추천 단위는 개별 active/open 공고로 고정됐다.
그러나 당시 수집기는 Wanted detail 검증과 렌더링이 단일 파일에 응집돼 있었고, Toss는 커리어 아티클 feed가 먼저 노출되어 개별 공고와 혼동될 수 있었다.
사용자는 정적 도구가 공고 활성 여부를 먼저 검증하고, LLM은 후보자 fit 판단만 맡는 구조를 원했다.

### 결정

- `collect_live_postings.ts`는 source adapter 계층과 공통 active validator 계층으로 분리한다.
- adapter는 구조화된 public endpoint나 SSR data에서 개별 공고 URL, active/open 근거, JD, 지원 가능 근거, 마감 정보를 수집한다.
- validator는 `link_type=direct_posting`, `posting_status=active/open`, active evidence, backend/server 필터, 계약직/인턴 제외, 마감 임박도를 공통으로 적용한다.
- Toss는 career article 자체를 공고로 쓰지 않는다.
  article CTA에서 `job-detail` URL을 따라가고, job detail page의 JD와 지원 폼이 확인된 항목만 open 공고로 채택한다.
- `opened_at`처럼 값이 없는 필드는 snapshot에서 생략한다.
  마감 판단에 필요한 `closes_at`, `days_until_close`, `close_urgency`는 유지한다.
- LLM은 active/open 여부를 추정하지 않는다.
  LLM 입력은 validator를 통과한 snapshot으로 제한하고, LLM은 fit, upside, gap, 준비 액션만 판단한다.

### 결과

- Toss를 포함한 공식 career 수집을 확장해도 커리어 아티클, 회사 홈, 검색 페이지가 추천 티어에 섞이지 않는다.
- source별 수집 실패와 active 검증 실패를 diagnostics로 남길 수 있다.
- application-flow-agent ingest로 넘길 후보의 품질이 높아진다.
- public endpoint 또는 SSR schema가 바뀌면 해당 adapter만 수정하면 된다.
