## ADR-101 — position-recommender 산출물은 표준 JSON을 정본으로 둔다

- Status: Accepted; consumer backend parts superseded by [[ADR-102]]
- Date: 2026-06-19
- Supersedes: ADR-094

### 맥락

추천 결과의 Markdown과 파생 JSON이 각자 상태를 갖으면 어느 파일이 정본인지 불분명해진다.
다음 스킬과 리포트가 같은 결과를 재사용하려면 기계 검증 가능한 단일 계약이 필요하다.

### 결정

- `reports/latest/position-recommendation.json`을 추천 결과의 정본으로 둔다.
- `scripts/position-recommender/recommendation_schema.ts`가 스키마를 소유한다.
- Markdown과 HTML은 표준 JSON에서 만드는 표시 산출물이다.
- consumer는 정본 JSON을 읽고 자신의 표시 형태에 맞게 가공한다.
- 불완전한 중간 JSON과 별도 daily runner를 보존하지 않는다.

### 거절한 대안

- Markdown을 기계 정본으로 사용하면 서식 변경이 consumer를 깨뜨린다.
- consumer별 JSON을 따로 만들면 상태가 여러 곳에서 갈라진다.

### 결과

추천 생성, 검증, Markdown/HTML 렌더링이 같은 데이터 계약을 사용한다.
