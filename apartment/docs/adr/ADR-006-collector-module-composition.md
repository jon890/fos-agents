## ADR-006 — collector는 module import로 조합한다

- Status: Accepted
- Date: 2026-05-19

### 맥락

collector가 같은 TypeScript runtime과 데이터 계약을 사용하므로 프로세스 경계보다 module 경계가 오류와 타입을 잘 보존한다.

### 결정

수집 진입점은 각 collector 함수를 import해 직접 호출한다.
프로세스 격리가 필요한 외부 도구만 subprocess로 실행한다.

### 거절한 대안

모든 collector를 subprocess로 호출하면 타입 정보와 오류 문맥을 잃는다.

### 결과

collector 반환 타입과 실패를 한 프로세스에서 검증할 수 있다.
