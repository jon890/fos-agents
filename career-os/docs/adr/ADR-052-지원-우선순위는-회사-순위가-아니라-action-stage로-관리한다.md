## ADR-052 — 지원 우선순위는 회사 순위가 아니라 action stage로 관리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

사용자는 절대적인 회사 선호 순위보다 지원 준비 행동을 관리하고 싶어 한다.
LLM 추천은 매 실행마다 바뀔 수 있으므로, LLM이 만든 추천 초안과 사용자가 최종 확인한 우선순위를 같은 필드에 덮어쓰면 안 된다.

### 결정

- priority는 회사 ranking이 아니라 action-oriented stage(`prepare-now`, `investigate`, `monitor`, `low-priority`, `hold`, `excluded`)로 저장한다.
- LLM은 `recommendation_snapshot`을 생성한다.
  이 snapshot에는 action stage, next action, risk flags, fit/gap 요약이 포함된다.
- 사용자가 확정한 값은 `user_confirmed_priority`에 별도로 저장한다.
  LLM refresh는 이 필드를 덮어쓰지 않는다.
- 기존 application-agent와 dashboard 흐름을 버리지 않고 그 위에 priority layer를 얹는다.

### 결과

- 매일 바뀌는 LLM 추천과 사용자가 확정한 진행 우선순위가 분리된다.
- "1순위 회사"보다 "지금 준비", "조사", "모니터링", "보류", "제외" 같은 행동 중심 운영이 가능해진다.
- 단점: recommendation snapshot과 user-confirmed priority의 병합 규칙이 필요하며, UI는 두 값의 차이를 명확히 보여줘야 한다.
