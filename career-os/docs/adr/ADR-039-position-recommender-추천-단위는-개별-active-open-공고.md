## ADR-039 — position-recommender 추천 단위는 개별 active/open 공고

- Status: Accepted
- Date: 2026-06-04

### 맥락

사용자는 position-recommender가 단순히 "어떤 회사를 지원해보라"는 수준에 머물지 않고, 실제로 현재 올라온 구체적인 공고만 분석해 알려주기를 원한다. application-flow-agent와 `data/applications/ledger.jsonl`의 입력은 실제 지원 가능한 공고여야 하므로, 회사명·채용홈·기술블로그·뉴스 기반 lead가 추천 티어에 섞이면 후속 지원 패키지 자동화 품질이 떨어진다.

### 결정

- 강력 추천/도전 추천의 단위는 회사가 아니라 현재 열린 개별 채용공고다.
- 추천 티어에는 다음 조건을 만족하는 항목만 올린다.
  - 개별 공고 URL 존재
  - active/open 근거 존재
  - 서버/백엔드 정규직 JD fit 확인
- 회사 채용홈, 검색 페이지, 기술블로그, 뉴스, verified-company 목록은 추천 티어가 아니라 `추가 수집 대상`으로만 둔다.
- `collect_live_postings.ts` snapshot에 `link_type`, `posting_status`, `active_evidence`를 추가한다.
- daily runner는 Claude 호출 전에 `collect_live_postings.ts --source wanted`를 직접 실행해 최신 개별 공고 snapshot을 만든다.
- `run_daily_with_claude.sh`는 강력/도전 추천 항목에 직접 공고 링크와 개별 active/open 근거가 없으면 실패 처리한다.

### 결과

- position-recommender report가 application-flow-agent ingest에 더 적합한 입력이 된다.
- 좋은 회사 lead는 보존하되, 실제 지원 후보와 섞이지 않는다.
- Wanted URL은 API active 근거가 있을 때만 추천 티어에 들어간다.
- Claude Bash 승인 게이트 때문에 collector가 실행되지 않아 stale snapshot + 회사 lead 추천으로 흐르는 실패 모드를 줄인다.
