# Phase 01 — apartment-daily-report 한국어화 + skill-creator 강화

## 목표

`apartment/.claude/skills/apartment-daily-report/` 의 SKILL.md + references/*.md 를 ai-nodes ADR-007 표준 따라 전면 한국어화하고, `/skill-creator:skill-creator` 4축 검토 결과를 동시 적용한다.

## 사전 조건

- ai-nodes/docs/adr.md ADR-007 채택 (선행 docs commit 완료 가정).
- ai-nodes/docs/docs-style.md "8가지 형식 패턴" 숙지.
- 참조 패턴: `career-os/.claude/skills/interview-coffeechat-prep/SKILL.md` 의 description (한국어 본문 + 따옴표 trigger phrase + 슬래시 명령).

## 단계

### 1. 현 상태 파악

- `apartment/.claude/skills/apartment-daily-report/SKILL.md` 본문 + frontmatter 정독.
- `apartment/.claude/skills/apartment-daily-report/references/` 안 파일 목록 + 본문 확인.
- 기존 영문 trigger keyword 추출 (description 의 "Use when ..." 절) — 한국어 trigger phrase 매핑 준비.

### 2. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 입력: 현 SKILL.md 본문. 받을 산출물:

- trigger keyword 적정성 평가
- workflow 명확도 평가
- boundary (do/don't) 누락 항목
- SKILL.md 비대 압축 후보

검토 리포트를 `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-01-skill-creator-report.md` 에 저장 — audit trail.

### 3. 한국어화 + 강화안 동시 적용

skill-creator 강화안 + 한국어 리라이트를 한 번에 적용:

- frontmatter `description` — 한국어 본문 + 따옴표 trigger phrase + 슬래시 명령. 영문 keyword 가 필요하면 본문 뒤에 짧게 추가.
- 본문 H2 헤더 한국어 (`## 개요`, `## 워크플로`, `## 출력`, `## 경계` 등).
- prose 한국어. 기술 식별자 (파일 path, command, env var, function·variable name) 영문 유지.
- docs-style.md 8 패턴 적용 — semantic line break / enumerated inline 금지 / 괄호 중첩 회피 / 표 셀 br / 헤더+본문 구조.
- references/*.md 동일 정책 적용.

### 4. 검증

- skill discovery 매칭 시뮬레이션 — `claude -p "/apartment-daily-report"` 슬래시 명령 동작 확인 (사용자 수동 또는 plan-and-build verifier).
- 한국어 trigger phrase 호출 매칭 가능성 self-check.
- markdown 렌더 후 코드 블록·표·인용 정상 확인.

### 5. commit

- 메시지: `docs(apartment): apartment-daily-report SKILL.md 한국어화 + skill-creator 강화 (plan008 phase-01)`.
- 본문에 변경 요약 + skill-creator 4축 평가 항목 적용 여부 짧게.

## 검증 기준 (성공 조건)

- SKILL.md frontmatter `name` 만 영문, `description` 한국어 (영문 keyword 보조 OK).
- 본문 + references/*.md 한국어 prose.
- skill-creator 4축 리포트 audit/ 에 저장됨.
- git status 의 modified 파일이 `apartment/.claude/skills/apartment-daily-report/` 안 + audit/phase-01-* 만 포함.

## 산출물

- `apartment/.claude/skills/apartment-daily-report/SKILL.md` (한국어 + 강화)
- `apartment/.claude/skills/apartment-daily-report/references/*.md` (한국어)
- `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-01-skill-creator-report.md` (audit trail)

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5 self-check:

- 1 모호한 task 명세 X — 4축 항목 + 검증 기준 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 의존성 (선행 docs ADR-007 / docs-style.md / career-os 참조 패턴) 명시 ✓.
- 5 critic 반복 지적 회피 — skill-creator 평가 결과를 audit trail 로 보존하여 *왜 이 강화안을 적용했는지* 기록.

## 의도적으로 안 하는 것

- 다른 워크스페이스 skill 영향 X.
- 외부 npm 의존 추가 X.
- skill 디렉터리 구조 변경 X.
- skill 본문 의미·정책 변경 X — 한국어화 + 표현 강화만, 기능·트리거 의미는 보존.
- references/ 안 외부 도구 출력 인용·코드 블록·기술 표준 인용 부분은 원어 유지.
