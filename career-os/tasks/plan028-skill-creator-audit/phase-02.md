# Phase 02 — candidate-baseline-suggester skill-creator 4축 강화 + 압축 결정

## 목표

`career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` (12065 bytes — 12KB+ 압축 후보 2순위) 에 `/skill-creator:skill-creator` 4축 검토를 적용하고 압축 가능성을 결정한다. 한국어 본문은 보존, 강화·압축만.

## 사전 조건

- phase-01 완료 (docs-audit 강화·압축 패턴 정착).
- ai-nodes ADR-007 채택.

## 단계

### 1. 현 상태 파악

- `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` 12065 bytes 정독.
- `career-os/.claude/skills/candidate-baseline-suggester/references/` 안 파일 확인.
- 본문 구조 분석 — 어떤 섹션이 큰지 (append + 주석 마킹 패턴 / audit trail 형식 / refresh 기준).

### 2. skill-creator 4축 검토

Skill 도구로 invoke. 산출물 `audit/phase-02-candidate-baseline-suggester-skill-creator-report.md`.

특히 다음:

- trigger keyword 적정성 — "후보자 프로필 갱신", "baseline 약점·강점 평가 업데이트" 외 누락 trigger.
- workflow 명확도 — append + 주석 마킹 + audit trail 3단계 흐름이 명료한지.
- boundary 누락 — 기존 본문 *덮어쓰기 금지* / *outdated 항목 주석 마킹만* 같은 핵심 정책이 명시되어 있는지.
- 비대 압축 후보 — audit trail 산출물 형식 명세를 references/ 분리 가능성.

### 3. 압축 결정

| 압축 옵션 | 효과 | 리스크 |
|---|---|---|
| references/audit-trail-format.md 분리 | SKILL.md ~3-4KB 감소 | audit 산출물 형식이 호출 시점에 즉시 안 보임 |
| append + 주석 마킹 패턴 references/ 분리 | SKILL.md ~2KB 감소 | 동작 정책이 분리되어 trigger 시 추론 비용↑ |
| 압축 안 함 (12KB 유지) | 변경 X | 임계 초과 지속, 단 1순위 docs-audit 보다 위험도 낮음 |

phase-01 docs-audit 압축 결정 결과 + skill-creator 리포트 종합하여 결정.

### 4. 강화안 + 압축 적용

- trigger keyword 보강.
- 결정된 압축 옵션 적용 (있다면).
- docs-style.md 8 패턴 재점검.

### 5. commit

- 메시지: `docs(career-os): candidate-baseline-suggester SKILL.md skill-creator 강화 [+ references/ 분리] (plan028 phase-02)`.

## 검증 기준 (성공 조건)

- skill-creator 4축 리포트 audit/ 에 저장됨.
- 한국어 본문 의미 보존.
- 압축 시 SKILL.md ~9KB 이하 목표.
- skill discovery 매칭 동작 확인.

## 산출물

- `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` (강화)
- (압축 시) `career-os/.claude/skills/candidate-baseline-suggester/references/<new>.md`
- `career-os/tasks/plan028-skill-creator-audit/audit/phase-02-candidate-baseline-suggester-skill-creator-report.md`
- `career-os/tasks/plan028-skill-creator-audit/audit/phase-02-compaction-decision.md`

## 차단 조건 (block)

- skill-creator 가 *append + 주석 마킹 패턴 의미 변경* 권장 → 거절.
- 압축이 *audit trail 동작 영향* → 압축 보류.

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 압축 옵션 3개 표로 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 phase-01 의존성 + 12KB+ 임계 명시 ✓.
- 5 압축 결정 근거 audit trail 보존.

## 의도적으로 안 하는 것

- 한국어 본문 리라이트 X.
- append + 주석 마킹 동작 변경 X.
- 다른 career-os skill 영향 X.
- candidate-profile.md / baseline-core-files.json 형식 변경 X.
