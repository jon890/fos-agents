# Workflow — health-care

## 1. Intake

- 사용자가 증상/검사/진료 내용을 제공한다.
- 원본은 `data/conditions/<track>/source-*.md`에 보존한다.
- 요약은 `current-context.md`에 업데이트한다.

## 2. Clinic prep

- 병원 제출용 1페이지 요약
- 의사에게 물어볼 질문
- 검사/MRI/재활 시작 시점 등 확인 필요 항목

## 3. Progress tracking

- 통증, 불안정감, 붓기, 가동범위, 보행/계단, 시행 조치, 다음날 반응을 기록한다.
- 악화 신호가 있으면 1개월 대기 대신 재진 기준을 다시 확인한다.

## 4. Rehab support

- 급성기에는 강화보다 보호·염증 완화·관절 강직 방지를 우선한다.
- 운동마다 중단 기준을 함께 둔다.
- 아침 체크인은 `config/knee-rehab-exercise-sets.md`에서 현재 단계에 맞는 운동 세트를 골라 짧게 안내한다.
- 운동 세트는 최대치가 아니라 안전하게 시작할 기본치로 제안한다.


## Public config policy

- `config/`에는 공개되어도 괜찮은 일반화된 정책과 플랜만 둔다.
- 원본 진료기록과 상세 증상 컨텍스트는 `data/`에만 보관한다.
- 경계가 애매하면 커밋/푸시 전에 사용자와 논의한다.

## 5. Skill flow plan

- `daily-knee-rehab-checkin`: `current-context.md` + `config/knee-running-recovery-plan.md` + `config/knee-rehab-exercise-sets.md` → 짧은 아침 체크인과 오늘의 보수적 운동 세트. 중단 기준과 재진 기준을 항상 포함한다.
- `knee-progress-intake`: 사용자 보고 → `progress-log.jsonl` append + 필요 시 `current-context.md` 업데이트 제안. 추론은 `확인 필요`로 분리한다.
- `weekly-knee-clinic-summary`: 최근 경과 + OCR 요약 + 현재 컨텍스트 → 병원 제출용 요약과 질문 리스트 초안. Claude 사용 가능하나 진단/처방은 금지한다.
