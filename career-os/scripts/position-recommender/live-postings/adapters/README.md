# Live Posting Source Adapters

새 채용 source는 이 디렉터리에 `SourceAdapter` 구현으로 추가한다.

규칙:

- adapter는 source-specific fetch, parsing, active/open evidence만 담당한다.
- adapter는 추천 순위, fit/gap, 커리어 서사 판단을 하지 않는다. 그 판단은 `/position-recommender` LLM 리포트 책임이다.
- adapter output은 공통 `active-validator.ts`를 다시 통과해야 한다.
- career article, company home, search page 같은 lead는 final snapshot에 넣지 않는다.
- 새 adapter를 daily 기본값에 넣기 전에는 shadow 또는 명시 옵션으로 관찰한다.
