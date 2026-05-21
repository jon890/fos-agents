# Phase 01 — health-care 3 skill 한국어화 + skill-creator 강화

## 목표

health-care 의 3 skill SKILL.md + references/*.md 를 ai-nodes ADR-007 표준 따라 전면 한국어화하고, `/skill-creator:skill-creator` 4축 검토 결과를 동시 적용한다. 의료/건강 정보 특수성 — privacy boundary + 비진단·비처방 톤 보존 필수.

## 사전 조건

- ai-nodes/docs/adr.md ADR-007 채택.
- ai-nodes/docs/docs-style.md "8가지 형식 패턴" 숙지.
- `health-care/config/public-health-care-policy.md` (privacy 정책) 정독 — 한국어화 후에도 정책 정합 유지.
- 참조 패턴: career-os 한국어 SKILL.md 또는 apartment plan008 phase-01 산출물.

## 대상 skill

| 순번 | skill | 현재 크기 | 비고 |
|---|---|---|---|
| A | daily-knee-rehab-checkin | 2006 bytes | cron 트리거 (08:30 KST 매일, openclaw `7261a9f2`) |
| B | knee-progress-intake | 2102 bytes | 사용자 보고 시 호출 |
| C | weekly-knee-clinic-summary | 2141 bytes | 주간 진료 준비 |

## 단계 (3 skill 각각 반복)

### 공통 절차 (skill A → B → C 순)

#### 1. 현 상태 파악

- 대상 SKILL.md 본문 + frontmatter 정독.
- references/ 안 파일 확인 (있으면).
- 영문 trigger keyword 추출 — 한국어 매핑 준비 ("knee rehab" → "무릎 재활", "patellar instability" → "슬개골 불안정").
- privacy boundary 표현 확인 — "Do not diagnose / prescribe", "no clinical guarantee" 같은 단정 회피 표현 한국어 매핑 ("진단·처방 금지", "임상 보장 없음" 또는 더 자연스러운 한국어).

#### 2. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 산출물을 `health-care/tasks/plan003-skill-korean-rewrite/audit/phase-01-<skill-name>-skill-creator-report.md` 에 저장.

#### 3. 한국어화 + 강화 적용

- frontmatter `description` 한국어 본문 + 따옴표 trigger phrase + 슬래시 명령. 의학 용어 (patellar, ACL, ROM 등) 는 *한국어 + 영문 병기* 권장 — 사용자 가독성 + 의학 검색 매칭.
- 본문 H2 헤더 한국어 (`## 입력`, `## 출력`, `## 경계`).
- prose 한국어, 의학 용어는 한국어 우선 + 영문 보조.
- docs-style.md 8 패턴 적용.

**보존 항목 (한국어화 시 의미 유지 필수)**:

- 비진단·비처방 톤 — "doctor's diagnosis 대체 X" 같은 boundary 표현 한국어로 명확히.
- privacy boundary — Discord ID, 병원 식별자, raw 의무 기록 노출 금지 정책.
- catching/locking >90도 같은 *임상 신호 한계* 명시 — 한국어 "걸림/잠김 90도 이상" 같이 직역.
- 보존적 (conservative) 톤 — 운동 강도·횟수 권장은 항상 안전 우선.

#### 4. commit

skill 별 분리:

- A: `docs(health-care): daily-knee-rehab-checkin SKILL.md 한국어화 + skill-creator 강화 (plan003 phase-01-A)`
- B: `docs(health-care): knee-progress-intake SKILL.md 한국어화 + skill-creator 강화 (plan003 phase-01-B)`
- C: `docs(health-care): weekly-knee-clinic-summary SKILL.md 한국어화 + skill-creator 강화 (plan003 phase-01-C)`

## 검증 기준 (성공 조건)

- 3 skill SKILL.md frontmatter `name` 만 영문, `description` 한국어 (의학 용어 영문 병기).
- 본문 + references/*.md 한국어 prose.
- privacy boundary 표현 보존 (`public-health-care-policy.md` 와 충돌 0).
- skill-creator 4축 리포트 3개 audit/ 에 저장됨.
- skill discovery 매칭 — `/daily-knee-rehab-checkin` 슬래시 명령 동작 확인.
- openclaw cron `7261a9f2-...` payload 의 trigger 와 정합 유지.
- git: 3 commit 분리.

## 산출물

- `health-care/.claude/skills/daily-knee-rehab-checkin/SKILL.md` (한국어 + 강화)
- `health-care/.claude/skills/knee-progress-intake/SKILL.md` (한국어 + 강화)
- `health-care/.claude/skills/weekly-knee-clinic-summary/SKILL.md` (한국어 + 강화)
- 각 skill references/*.md 한국어
- audit/phase-01-{daily-knee-rehab-checkin, knee-progress-intake, weekly-knee-clinic-summary}-skill-creator-report.md 3 파일

## 차단 조건 (block)

- skill-creator 가 *진단·처방 톤 강화* 권장 → 거절 (health-care 워크스페이스 정책 위반).
- skill-creator 가 *cron payload 변경* 권장 → 본 plan 범위 밖, 별도 task.
- privacy boundary 한국어 표현이 모호해짐 → 사용자 검토 후 결정.

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 3 skill 동일 패턴 + privacy 보존 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 ADR-007 / docs-style.md / public-health-care-policy.md 의존성 명시 ✓.
- 5 의학 용어 영문 병기 + 비진단 톤 보존 — 의료 도메인 함정 회피.

## 의도적으로 안 하는 것

- 다른 워크스페이스 영향 X.
- `public-health-care-policy.md` 정책 변경 X.
- openclaw cron payload 변경 X (별도 task).
- 진단·처방·예후 단정 표현 추가 X.
- raw 의무 기록 / 병원명 / Discord ID 노출 X.
- 의학 용어 한국어 단독 표기 X (영문 병기 필수).
