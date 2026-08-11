## ADR-003 — 수집과 정규화에 TypeScript와 Bun을 사용한다

- Status: Accepted
- Date: 2026-05-19

### 맥락

아파트 데이터 수집은 구조화된 JSON 처리와 runtime 검증이 많다.
저장소가 이미 사용하는 TypeScript와 Bun으로 구현하면 타입과 실행 환경을 함께 재사용할 수 있다.

### 결정

apartment의 결정론적 수집과 정규화 코드는 TypeScript와 Bun으로 구현한다.
agent 해석과의 공통 경계는 [루트 ADR-021](../../../docs/adr/ADR-021-deterministic-agent-boundary.md)을 따른다.

### 거절한 대안

JSON 처리를 shell에 넣으면 형식 검증과 오류 문맥 보존이 어렵다.

### 결과

수집 단계에서 타입과 오류를 확인하고 저장소의 기존 runtime을 재사용한다.
