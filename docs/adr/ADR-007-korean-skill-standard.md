## ADR-007 — SKILL.md 한국어화 표준 + skill-creator 검토 정책

**Status**: Accepted
**Date**: 2026-05-21

### 맥락

ai-nodes 모노레포 21개 SKILL.md 의 한국어화 상태가 워크스페이스별로 혼재.

| 워크스페이스 | skill 수 | 현재 상태 |
|---|---|---|
| ai-nodes/skills/ | 5 | 부분 (3개 한국어, 2개 영문 — agent-browser, workspace-audit) |
| apartment | 2 | 영문 |
| career-os | 8 | 한국어 (description + 본문 정리됨) |
| stock-investment | 3 | 영문 |
| health-care | 3 | 영문 |

사용자가 "본인이 직접 함께 수정할 수 있는 형태" 를 요구.
형식 정책 (한자어·외래어 회피 + 8가지 형식 패턴) 은 `docs/docs-style.md` 단일 출처 (ADR-005).
본 ADR 은 *SKILL.md 한정 한국어화 정책 + skill-creator 검토 활용* 결정.

### 결정

1. **frontmatter `description` 한국어 본문 + trigger phrase 인용 패턴 채택**.
   career-os 의 기존 패턴을 표준으로 격상.
   - 한국어 본문 + 따옴표로 한국어 자연어 trigger phrase 명시
   - 슬래시 명령 (`/skill-name`) 명시
   - 영문 keyword 가 필요하면 본문 뒤에 짧게 추가

2. **본문 markdown 은 한국어 prose + 한국어 H2 헤더**.
   기술 식별자 (파일 path, command, function·variable name) 만 영문 유지.
   `docs/docs-style.md` 8가지 형식 패턴 따름.

3. **references/*.md 도 한국어화 대상**.
   외부 도구 출력 인용·코드 블록·기술 표준 인용 부분은 원어 유지.

4. **skill-creator 검토 동시 적용**.
   한국어화 + skill 강화 한 phase 안에서 4축 평가:
   - trigger keyword 적정성
   - workflow 명확도
   - boundary 누락
   - SKILL.md 비대 (12KB+ 압축 후보)

   career-os 8 skill 도 검토 대상 (한국어 리라이트는 제외).

5. **신규 skill 도 본 표준 따름**.
   ai-nodes/skills/ + 워크스페이스 .claude/skills/ 전체 적용.

거절한 대안:

- 완전 영문 description + 한국어 본문 — skill discovery 매칭은 좋지만 사용자 가독성 낮음.
- bilingual 병기 (영문/한국어 둘 다) — SKILL.md 비대화.
- career-os 만 한국어 + 나머지 영문 유지 — 일관성 깨짐.

### 결과

- 사용자가 직접 SKILL.md 편집 가능 — 한국어 prose 가 진입 장벽 낮춤.
- skill discovery 매칭 (영문 호출 패턴 포함) 일관성 유지.
- 21 SKILL.md 본문 + frontmatter 정합성↑.
- 단점: 미래 신규 skill 도입 시 한국어화 + skill-creator 검토 부담 추가.

### 적용

형식 정책은 `docs/docs-style.md` 따른다.

실행 task 분리 (워크스페이스 격리 원칙):

- `ai-nodes/tasks/plan002-skill-korean-policy/` — ai-nodes/skills/ 5개 (영문 2개 한국어화 + 한국어 3개 skill-creator 강화)
- `apartment/tasks/plan008-skill-korean-rewrite/` — apartment 2개 + 마지막 phase cron payload 슬림화
- `stock-investment/tasks/plan005-skill-korean-rewrite/` — stock-investment 3개
- `health-care/tasks/plan003-skill-korean-rewrite/` — health-care 3개
- `career-os/tasks/plan028-skill-creator-audit/` — career-os 8개 (한국어 X, skill-creator 강화만)

---
