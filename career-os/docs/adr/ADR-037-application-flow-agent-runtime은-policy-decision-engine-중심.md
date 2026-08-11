## ADR-037 — application-flow-agent는 policy decision engine을 중심으로 둔다

- Status: Accepted
- Date: 2026-05-26

### 맥락

지원 후보의 중복, 마감, 쿨다운, review 결과에 따른 다음 행동이 skill 호출 순서에 흩어져 있었다.
LLM이 상태 전이까지 직접 결정하면 잘못된 전이를 코드로 차단하기 어렵다.

### 결정

- 실행 루프는 `state → policy decision → action → validation → state update`로 구성한다.
- 상태 전이와 다음 행동 선택은 TypeScript policy와 validator가 결정한다.
- LLM은 분석, 작성, 추천 근거 생성을 담당한다.
- 실제 제출, 외부 전송, 계정 로그인, 공개 발행은 사용자 승인 없이 실행하지 않는다.

### 거절한 대안

- LLM에게 상태 전이 전체를 맡기면 할루시네이션과 컨텍스트 누락을 강제할 수 없다.

### 결과

상태 변경은 코드로 검증하고 작성 품질이 필요한 부분에만 LLM을 사용한다.
