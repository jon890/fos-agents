## ADR-101 position-recommender 추천 JSON을 기준 데이터로 사용한다

- Status: Accepted
- Date: 2026-06-19

### 맥락

추천 결과를 Markdown과 JSON에서 각각 관리하면 두 결과가 달라질 수 있다.
다음 skill과 리포트가 같은 추천을 재사용하려면 기계적으로 검증할 수 있는 계약이 필요하다.

### 결정

- 실행별 시스템 임시 경로의 `recommendation.json`을 해당 실행의 추천 기준 데이터로 사용한다.
- `scripts/position-recommender/recommendation_schema.ts`가 형식을 검증한다.
- Markdown과 HTML은 검증된 JSON에서 만든다.
- 불완전한 중간 JSON과 별도 일일 실행기는 보존하지 않는다.

### 거절한 대안

- Markdown을 기계 입력으로 사용하면 서식 변경이 소비 코드를 깨뜨린다.
- 소비자마다 JSON을 만들면 같은 실행 결과가 여러 상태로 갈라진다.

### 결과

추천 생성, 검증, Markdown·HTML 렌더링이 같은 데이터 계약을 사용한다.
게시 검증이 끝나면 기준 JSON과 파생 산출물을 함께 삭제한다.
