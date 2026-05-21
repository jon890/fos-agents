# Phase 01 — agent-browser + workspace-audit 한국어화 + skill-creator 강화

## 목표

ai-nodes 모노레포 공용 skill 중 영문 2개 (`agent-browser`, `workspace-audit`) 의 SKILL.md + references/*.md 를 ai-nodes ADR-007 표준 따라 전면 한국어화하고, `/skill-creator:skill-creator` 4축 검토 결과를 동시 적용한다.

## 사전 조건

- ai-nodes/docs/adr.md ADR-007 채택.
- ai-nodes/docs/docs-style.md "8가지 형식 패턴" 숙지.
- 참조 패턴: `ai-nodes/skills/docs-check/SKILL.md` 또는 `ai-nodes/skills/planning/SKILL.md` (이미 한국어).

## 단계 (2개 skill 각각 반복)

### A. agent-browser

#### 1. 현 상태 파악

- `ai-nodes/skills/agent-browser/SKILL.md` (영문 2329 bytes) 정독.
- `ai-nodes/skills/agent-browser/references/` 안 파일 확인.
- 기존 영문 trigger keyword 추출 — 한국어 매핑 준비.

#### 2. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 산출물을 `ai-nodes/tasks/plan002-skill-korean-policy/audit/phase-01-agent-browser-skill-creator-report.md` 에 저장.

#### 3. 한국어화 + 강화 적용

- frontmatter `description` 한국어 본문 + 따옴표 trigger phrase + 슬래시 명령 + 영문 keyword 보조 (Naver Land 같은 고유명사 보존).
- 본문 H2 헤더 한국어.
- prose 한국어, 기술 식별자 (CLI 옵션, 파일 path, 도구 명령) 영문 유지.
- docs-style.md 8 패턴 적용.

#### 4. commit

메시지: `docs(ai-nodes): agent-browser SKILL.md 한국어화 + skill-creator 강화 (plan002 phase-01-A)`.

### B. workspace-audit

위 A 패턴 동일 반복:

- 현 상태 파악 (영문 9214 bytes 정독).
- skill-creator 4축 검토 → `audit/phase-01-workspace-audit-skill-creator-report.md`.
- 한국어화 + 강화 적용.
- commit: `docs(ai-nodes): workspace-audit SKILL.md 한국어화 + skill-creator 강화 (plan002 phase-01-B)`.

## 검증 기준 (성공 조건)

- 2 skill SKILL.md frontmatter `name` 만 영문, `description` 한국어.
- 본문 + references/*.md 한국어 prose.
- skill-creator 4축 리포트 2개 audit/ 에 저장됨.
- skill discovery 매칭 시뮬레이션 — 슬래시 명령 (`/workspace-audit`) 동작 확인.
- git status: ai-nodes/skills/agent-browser/, ai-nodes/skills/workspace-audit/, audit/phase-01-* 만 변경.

## 산출물

- `ai-nodes/skills/agent-browser/SKILL.md` + `references/*.md` (한국어 + 강화)
- `ai-nodes/skills/workspace-audit/SKILL.md` + `references/*.md` (한국어 + 강화)
- `ai-nodes/tasks/plan002-skill-korean-policy/audit/phase-01-agent-browser-skill-creator-report.md`
- `ai-nodes/tasks/plan002-skill-korean-policy/audit/phase-01-workspace-audit-skill-creator-report.md`

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 2 skill 각각 동일 패턴 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 ADR-007 / docs-style.md / 한국어 참조 패턴 명시 ✓.
- 5 skill-creator 평가 결과 audit trail 보존.

## 의도적으로 안 하는 것

- 워크스페이스 .claude/skills/ 영향 X (별도 plan).
- 외부 npm 의존 추가 X.
- skill 디렉터리 구조 변경 X.
- skill 본문 의미·정책 변경 X — 한국어화 + 강화만.
- agent-browser 의 CLI 옵션 / 명령 인용 부분 한국어화 금지 (기술 식별자 보존).
