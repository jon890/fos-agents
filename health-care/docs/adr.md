# ADR — health-care

## ADR-001 — health-care를 독립 ai-node로 분리

- 날짜: 2026-05-17
- 결정: 개인 건강 관리 자동화는 `~/ai-nodes/health-care` 워크스페이스에서 관리한다.
- 이유: career-os/apartment처럼 도메인별 기록·템플릿·자동화를 분리하면 장기 추적과 개인정보 경계가 명확해진다.
- 범위: 진료 준비, 증상 경과 기록, 재활 체크리스트, 위험 신호 정리.
- 비범위: 의학적 진단, 처방 변경, 의료진 판단 대체.

## ADR-002 — health-care skill은 3개 경계로 분리

- Status: accepted
- Date: 2026-05-17

### 맥락

건강관리 자동화는 매일 반복 체크인, 증상 누적, 주간/진료 전 요약의 성격이 다르다. 하나의 큰 skill로 묶으면 의료 판단 범위가 흐려지고, 민감정보 처리와 Claude 사용 경계도 불명확해진다.

### 결정

초기 health-care skill 설계는 `daily-knee-rehab-checkin`, `knee-progress-intake`, `weekly-knee-clinic-summary` 세 경계로 나누었고, 2026-06-29 이후 아침 체크인은 `daily-health-coaching`으로 확장한다. 매일 체크인은 보수적 규칙 기반으로 시작하고, Claude는 주간/진료 전 요약처럼 분석 가치가 큰 작업에 제한적으로 사용한다.

### 결과

일일 안내는 짧고 안전하게 유지되고, 경과 누적은 사용자 보고 중심으로 분리된다. 주간 요약은 더 풍부한 분석을 하되 진단/처방 대체를 금지한다. 단점은 초기 구현 파일 수가 늘어나지만, 의료/개인정보 경계가 명확해진다.

## ADR-003 — 아침 체크인에 단계별 재활 운동 세트를 포함

- Status: accepted
- Date: 2026-05-26

### 맥락

사용자가 일반 계단 하강은 회복 중이나 빠른 계단 하강은 아직 무리될 수 있다고 보고했고, 재발 방지를 위한 근력 강화 운동을 매일 아침 안내받고 싶다고 요청했다.

### 결정

`daily-health-coaching`은 기존 무릎 상태 체크와 재활 운동 세트에 더해 건강검진 기반 식단·체중·저충격 운동 코칭을 포함한다. 운동 세트의 일반 기준은 `config/knee-rehab-exercise-sets.md`에 둔다. 개인 경과와 수술 이력은 계속 `private/conditions/knee-patellar-instability/current-context.md`에만 보관한다.

### 결과

아침 cron은 같은 스킬 진입점을 유지하면서, 매일 현재 단계에 맞는 운동 세트를 짧게 안내할 수 있다. 공개 가능한 운동 기준과 private 의료 컨텍스트가 분리된다. 단점은 운동 세트가 실제 의료진 처방이 아니므로 메시지마다 보수적 중단 기준과 재진 기준을 유지해야 한다.
