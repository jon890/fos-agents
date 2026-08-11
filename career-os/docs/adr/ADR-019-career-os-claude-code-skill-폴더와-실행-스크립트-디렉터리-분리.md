## ADR-019 — skill 문서와 실행 코드를 분리한다

- Status: Accepted
- Date: 2026-05-14

### 맥락

skill 지침과 실행 코드가 한 디렉터리에 섞이면 문서 로드 비용이 커지고 코드 소유권이 불분명해진다.

### 결정

- skill의 정본은 `.claude/skills/<skill>/` 아래에 둔다.
- 실행 코드는 `scripts/<skill>/` 아래에 둔다.
- skill 이름과 script 디렉터리 이름을 가능한 한 같게 유지한다.
- skill 공유 설명은 `references/` 또는 공용 reference에 두고 실행 코드와 섞지 않는다.

### 거절한 대안

- `scripts/` 평면 구조는 이름 충돌과 소유권 불명확성을 키운다.
- skill 본문 아래에 운영 스크립트를 두면 지침과 구현 경계가 흐려진다.

### 결과

skill은 사용 계약에 집중하고 실행 코드는 독립적으로 검증할 수 있다.
