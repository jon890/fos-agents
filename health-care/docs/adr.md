# ADR — health-care

health-care에만 적용되는 살아 있는 결정을 기록한다.
공통 결정은 [루트 ADR INDEX](../../docs/adr/INDEX.md)를 따른다.

## ADR-002 — 건강 workflow는 안전 책임별 skill로 분리한다

- Status: Accepted
- Date: 2026-05-17

### 맥락

매일 안내, 사용자 상태 기록, 주간 요약, 식단 조사는 입력과 위험 수준이 다르다.
하나의 skill로 묶으면 의료 판단과 민감 정보 처리 경계가 흐려진다.

### 결정

- `daily-health-coaching`은 보수적인 일일 체크인과 공개 기준 기반 운동 안내를 담당한다.
- `knee-progress-intake`는 사용자가 말한 사실만 경과 기록에 반영한다.
- `weekly-knee-clinic-summary`는 진료 준비용 경과와 질문을 요약한다.
- `personalized-healthy-meal-research`는 공개 근거를 조사하고 개인 상태에 맞춘 선택지를 제시한다.
- 일반 운동 기준은 `config/`에 두고 개인 병력과 경과는 `private/`에 둔다.
- 모든 skill은 진단, 처방 변경, 의료진 판단 대체를 금지한다.

### 거절한 대안

- 단일 건강관리 skill은 권한과 안전 기준이 지나치게 넓어진다.
- 개인 병력을 공개 config에 두면 민감 정보 경계를 위반한다.

### 결과

각 workflow가 필요한 최소한의 개인 정보만 읽고 위험 수준에 맞는 결과를 만든다.
