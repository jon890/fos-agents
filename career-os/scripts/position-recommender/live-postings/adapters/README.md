# Live Posting Source Adapters

새 채용 source는 이 디렉터리에 `SourceAdapter` 구현으로 추가한다.

규칙:

- adapter는 source-specific fetch, parsing, active/open evidence만 담당한다.
- adapter는 추천 순위, fit/gap, 커리어 서사 판단을 하지 않는다. 그 판단은 `/position-recommender` LLM 리포트 책임이다.
- adapter output은 공통 `active-validator.ts`를 다시 통과해야 한다.
- career article, company home, search page 같은 lead는 final snapshot에 넣지 않는다.
- 새 adapter를 daily 기본값에 넣기 전에는 shadow 또는 명시 옵션으로 관찰한다.
- Coupang처럼 공식 detail/listing HTML이 fetch에서 차단되는 회사는 1차로 Wanted target keyword discovery를 유지하되, 공식 sitemap처럼 접근 가능한 direct job URL source가 있으면 별도 adapter로 사용한다.
- `coupang-careers`는 공식 sitemap direct job URL을 발견한 뒤 detail fetch로 JD를 보강한다. detail이 Cloudflare 등으로 실패하면 diagnostics에 남기고 sitemap 근거만 유지한다.
  공식 adapter는 안정적으로 active/open 개별 공고를 검증할 수 있을 때 추가한다.
