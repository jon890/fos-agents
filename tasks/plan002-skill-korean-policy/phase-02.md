# Phase 02 — docs-check + plan-and-build + planning skill-creator 4축 강화

## 목표

ai-nodes 모노레포 공용 skill 중 이미 한국어인 3개 (`docs-check` 9516 bytes, `plan-and-build` 9539 bytes, `planning` 18430 bytes) 에 `/skill-creator:skill-creator` 4축 검토를 적용하여 강화. **한국어 본문 자체는 보존** — frontmatter description trigger phrase 보강 + workflow 명확도 + boundary 누락 + 비대 압축만.

## 사전 조건

- phase-01 완료 (agent-browser + workspace-audit 한국어화 패턴 정착).
- ai-nodes ADR-007 채택.
- 본 phase 의 3 skill 은 이미 한국어이므로 *리라이트가 아닌 강화*.

## 단계 (3개 skill 각각 반복)

### A. docs-check (9516 bytes)

#### 1. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 산출물을 `ai-nodes/tasks/plan002-skill-korean-policy/audit/phase-02-docs-check-skill-creator-report.md` 에 저장.

#### 2. 강화안 적용

- trigger keyword 적정성 — 누락된 자연어 trigger 추가 (예: "stale ADR", "ADR 정리").
- workflow 명확도 — sub-step 명료화.
- boundary 누락 — do/don't 명시.
- 비대 압축 — 12KB+ 임계는 미달이지만 9KB 라 *비대 위험 신호*. 본문 중복 / 길어진 prose 압축 후보 도출.

#### 3. commit

메시지: `docs(ai-nodes): docs-check SKILL.md skill-creator 강화 (plan002 phase-02-A)`.

### B. plan-and-build (9539 bytes)

위 A 패턴 동일:

- skill-creator 4축 검토 → `audit/phase-02-plan-and-build-skill-creator-report.md`.
- 강화안 적용.
- commit: `docs(ai-nodes): plan-and-build SKILL.md skill-creator 강화 (plan002 phase-02-B)`.

### C. planning (18430 bytes — *압축 후보 1순위*)

planning SKILL.md 는 18KB 로 12KB+ 압축 후보 임계 초과. 단 *plan 생성 워크플로 자체의 본문 정책 단일 출처* 라 단순 압축 X — skill-creator 가 *어떤 부분을 references/task-create.md 로 분리할 수 있는지* 도출.

- skill-creator 4축 검토 → `audit/phase-02-planning-skill-creator-report.md`.
- 압축 후보:
  - "ADR 작성 원칙" 섹션 → 별도 `references/adr-writing.md` 분리 검토.
  - "5문서 공통 작성 원칙" 섹션 → 별도 `references/5docs-policy.md` 분리 검토.
- 압축 적용 여부는 audit 리포트 + 사용자 검토 후 결정. 압축이 *plan 사이클 동작* 에 영향을 주면 보류.
- commit: `docs(ai-nodes): planning SKILL.md skill-creator 강화 (plan002 phase-02-C)`.

## 검증 기준 (성공 조건)

- 3 skill 모두 skill-creator 4축 리포트 audit/ 에 저장됨.
- 강화안 적용 — trigger keyword / workflow / boundary / 비대 4축 중 *최소 2축* 개선.
- 한국어 본문 의미 보존 (drift 0).
- skill discovery 매칭 (`/docs-check`, `/planning` 슬래시 명령) 정상 동작.

## 산출물

- `ai-nodes/skills/docs-check/SKILL.md` (강화)
- `ai-nodes/skills/plan-and-build/SKILL.md` (강화)
- `ai-nodes/skills/planning/SKILL.md` (강화) — 압축 시 `references/` 추가 가능
- `ai-nodes/tasks/plan002-skill-korean-policy/audit/phase-02-{docs-check, plan-and-build, planning}-skill-creator-report.md` 3 파일

## 차단 조건 (block)

- planning SKILL.md 압축이 *plan 사이클 동작 영향* 줌 → 압축 보류, 강화만.
- skill-creator 가 *큰 구조 변경* 제안 (디렉터리 분리 등) → 사용자 확인 후 결정.

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 3 skill 각각 패턴 + planning 특수 처리 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 (최소 2축 개선) ✓.
- 4 phase-01 의존성 명시 ✓.
- 5 한국어 본문 보존 명시 — drift 회피.

## 의도적으로 안 하는 것

- 한국어 본문 *리라이트* X — 강화만.
- skill 본문 의미·정책 변경 X.
- 워크스페이스 .claude/skills/ 영향 X.
- planning skill 의 *plan 사이클 동작* 변경 X — 표현 강화만.
