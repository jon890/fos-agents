# Code Architecture — health-care

## 레이어

- `config/`: 공개 가능한 정책과 일반화된 재활 플랜.
- `data/`: 민감한 개인 의료 컨텍스트와 경과 기록. gitignore 대상.
- `docs/`: 제품 범위, 데이터 책임, 흐름, 아키텍처, ADR.
- `.claude/skills/`: Claude native skill 컨텍스트 자산 (SKILL.md + references/). ADR-006 분리 표준 적용 (plan002 phase-02).
- `tasks/`: planning/plan-and-build 실행 계획.

## 예정 skill 경계

### `.claude/skills/daily-knee-rehab-checkin/`

- 입력: `data/conditions/knee-patellar-instability/current-context.md`, `config/knee-running-recovery-plan.md`
- 추가 입력: `config/knee-rehab-exercise-sets.md`
- 출력: Discord용 짧은 체크인 메시지와 오늘의 재활 운동 세트 또는 `data/.../daily-checkins/` 저장본
- 원칙: Claude 없이도 동작 가능한 보수적 안내. 판단 최소화. 불확실하면 낮은 단계 운동 세트를 선택.

### `.claude/skills/knee-progress-intake/`

- 입력: 사용자가 채널에 남긴 증상/운동/다음날 반응
- 출력: `progress-log.jsonl` append 및 `current-context.md`의 최신 상태 갱신 제안
- 원칙: 사용자가 말한 사실만 구조화. 추론은 `확인 필요`로 분리.

### `.claude/skills/weekly-knee-clinic-summary/`

- 입력: `current-context.md`, `progress-log.jsonl`, 최근 daily checkin, OCR 요약
- 출력: `weekly-summaries/YYYY-MM-DD.md` 및 Discord 요약
- 원칙: Claude 사용 가능. 진단/처방 금지, 병원 질문과 경과 요약 중심.

## 알림/cron

- 매일 아침 체크인은 OpenClaw cron이 담당한다.
- cron payload는 `/daily-knee-rehab-checkin` 또는 동등한 스킬 호출로 유지하고, 운동 세트 변경은 skill/config 문서에서 관리한다.
- 플랫폼 내부 식별자는 repo 문서에 기록하지 않는다.
- 배송 대상은 OpenClaw 로컬 cron/config에서만 관리한다.
