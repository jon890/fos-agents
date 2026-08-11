## ADR-005 — 외부 HTTP 요청은 Bun fetch를 사용한다

- Status: Accepted
- Date: 2026-05-19

### 맥락

현재 수집기가 요구하는 HTTP 기능은 표준 `fetch`와 명시적인 timeout, 재시도로 충족할 수 있다.

### 결정

외부 HTTP 요청은 Bun의 표준 `fetch`를 사용한다.
재시도와 timeout은 호출 경계에서 명시한다.

### 거절한 대안

별도 HTTP package는 현재 필요한 기능보다 의존성 비용이 크다.

### 결과

추가 의존성 없이 표준 `Response` 인터페이스를 사용한다.
