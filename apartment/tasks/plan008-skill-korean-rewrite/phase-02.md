# Phase 02 — apartment-interior-reference-digest 한국어화 + skill-creator 강화

## 목표

`apartment/.claude/skills/apartment-interior-reference-digest/` 의 SKILL.md + references/*.md 를 ai-nodes ADR-007 표준 따라 전면 한국어화하고, `/skill-creator:skill-creator` 4축 검토 결과를 동시 적용한다. **4번 진단 단계에서 이미 보강된 SKILL.md Workflow step 1·6 + config topicFocused 6개 확장은 보존**.

## 사전 조건

- phase-01 완료 (apartment-daily-report 한국어화 패턴 정착).
- 4번 진단의 SKILL.md 보강 이미 적용 — 다음 변경 보존:
  - Workflow step 1: 4 추가 docs 명시 (`lucky-5-1004-decision-summary.md`, `lucky-5-1004-field-checklist.md`, `lucky-5-1004-contractor-brief.md`, `lucky-5-1004-decision-queue.md`).
  - Workflow step 6: 한국어 제목 "오늘의 인테리어 추천" 고정 ("다이제스트" 금지).
  - config topicFocused: 6개로 확장 ("붙박이장", "작업공간/모션데스크" 추가).
- ai-nodes ADR-007 채택 (선행 docs commit 완료 가정).

## 단계

### 1. 현 상태 파악

- `apartment/.claude/skills/apartment-interior-reference-digest/SKILL.md` 정독 (4번 진단 보강 부분 식별).
- `apartment/.claude/skills/apartment-interior-reference-digest/references/` 디렉터리 안 파일 목록 + 본문 확인.
- `apartment/config/interior-reference-digest.json` 정독 — 정책 단일 출처 인지.

### 2. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 입력: 현 SKILL.md 본문 (4번 진단 보강 후 상태). 받을 산출물:

- trigger keyword 적정성 평가
- workflow 명확도 평가 (4번 진단 보강 step 들 명확도 점검)
- boundary (do/don't) 누락 항목
- SKILL.md 비대 압축 후보

검토 리포트를 `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-02-skill-creator-report.md` 에 저장.

### 3. 한국어화 + 강화안 동시 적용

phase-01 패턴 동일:

- frontmatter `description` 한국어 본문 + 따옴표 trigger phrase + 슬래시 명령.
- 본문 H2 헤더 한국어.
- prose 한국어, 기술 식별자 영문 유지.
- docs-style.md 8 패턴 적용.
- references/*.md 동일 정책.

**보존 항목** (한국어화 시 의미 유지 필수):

- Workflow step 1 의 4 추가 docs 목록 그대로.
- Workflow step 6 의 한국어 제목 고정 정책 그대로.
- "Decision queue 는 state board" 의미 보존.

### 4. 검증

- skill discovery 매칭 시뮬레이션 — `claude -p "/apartment-interior-reference-digest"` 동작 확인.
- 한국어 trigger phrase ("오늘 인테리어 추천", "구리 럭키아파트 인테리어") 매칭 가능성 self-check.
- config `topicFocused` 6개 키워드가 본문 Search guidance 섹션과 정합한지 확인.
- markdown 렌더 검증.

### 5. commit

- 메시지: `docs(apartment): apartment-interior-reference-digest SKILL.md 한국어화 + skill-creator 강화 (plan008 phase-02)`.
- 본문에 4번 진단 보강분 보존 + skill-creator 4축 적용 요약.

## 검증 기준 (성공 조건)

- SKILL.md frontmatter `name` 만 영문, `description` 한국어.
- 본문 + references/*.md 한국어 prose.
- 4번 진단 보강 (4 추가 docs + 한국어 제목 고정) 의미 보존.
- skill-creator 4축 리포트 audit/ 에 저장됨.
- git status 의 modified 파일이 본 skill 디렉터리 + audit/phase-02-* 만 포함.

## 산출물

- `apartment/.claude/skills/apartment-interior-reference-digest/SKILL.md` (한국어 + 강화)
- `apartment/.claude/skills/apartment-interior-reference-digest/references/*.md` (한국어)
- `apartment/tasks/plan008-skill-korean-rewrite/audit/phase-02-skill-creator-report.md`

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5 self-check:

- 1 모호한 task 명세 X — 보존 항목 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 phase-01 의존성 명시 ✓.
- 5 4번 진단 보강 보존 명시 — drift 회피.

## 의도적으로 안 하는 것

- config interior-reference-digest.json 변경 X (4번 진단으로 보강 완료, 추가 변경 없음).
- 다른 워크스페이스 skill 영향 X.
- skill 본문 의미·정책 변경 X.
- phase-03 의 cron payload 본문 변경 X (별도 phase 책임).
