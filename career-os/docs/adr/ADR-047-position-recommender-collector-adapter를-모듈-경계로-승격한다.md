## ADR-047 — position-recommender collector를 source adapter 경계로 나눈다

- Status: Accepted
- Date: 2026-06-06
- Supersedes: ADR-043, ADR-051

### 맥락

공고 수집, source별 parsing, active 검증, 공통 필터, 표시 로직이 한 파일에 모여 있었다.
새 source를 추가할 때 수집 규칙과 추천 판단이 섞이지 않도록 경계가 필요했다.

### 결정

- `collect_live_postings.ts`는 호환 CLI entrypoint로 유지한다.
- source별 수집은 `scripts/position-recommender/live-postings/adapters/`가 소유한다.
- 공통 validator는 개별 공고 URL, active/open 근거, 역할, 고용 형태, 마감일을 검증한다.
- collector는 지원 가능한 후보까지 만들고 fit, 간격, 우선순위는 LLM에 맡긴다.
- 한 source가 실패해도 성공한 source의 결과는 계속 사용한다.
- 실패 원문과 디버그 정보는 runtime에 두고 사용자 리포트에는 요약만 보여준다.

### 거절한 대안

- 모든 source를 하나의 parser에 두면 외부 응답 변경이 공통 정책에 전파된다.
- collector가 fit과 순위까지 결정하면 수집 규칙과 추천 정책이 섞인다.

### 결과

외부 source 변경은 해당 adapter에 격리되고 추천 입력의 품질은 공통 validator로 유지된다.
