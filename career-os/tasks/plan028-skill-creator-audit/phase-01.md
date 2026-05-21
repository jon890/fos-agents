# Phase 01 — docs-audit skill-creator 4축 강화 + 압축 결정

## 목표

`career-os/.claude/skills/docs-audit/SKILL.md` (19603 bytes — career-os 최대) 에 `/skill-creator:skill-creator` 4축 검토를 적용하고, **압축 후보 1순위** 로서 references/ 분리 가능성을 결정한다. 한국어 본문은 이미 완료이므로 리라이트 X, 강화·압축만.

## 사전 조건

- ai-nodes/docs/adr.md ADR-007 채택.
- ai-nodes/docs/docs-style.md "8가지 형식 패턴" 숙지.
- 본 skill 은 19KB 로 12KB+ 압축 후보 임계의 *1.6배 초과* — 가장 큰 비대 위험.

## 단계

### 1. 현 상태 파악

- `career-os/.claude/skills/docs-audit/SKILL.md` 19603 bytes 정독.
- `career-os/.claude/skills/docs-audit/references/` 안 파일 확인.
- 본문 구조 분석 — 어떤 섹션이 가장 큰 비중을 차지하는지 (예: 7개 축 평가 기준 / Quality Loop 모드 / sub-agent 위임 명세).

### 2. skill-creator 4축 검토

Skill 도구로 `/skill-creator:skill-creator` invoke. 산출물을 `career-os/tasks/plan028-skill-creator-audit/audit/phase-01-docs-audit-skill-creator-report.md` 에 저장. 특히 다음 질문에 답:

- trigger keyword 누락 (description 안 11개 trigger phrase 가 적절한지).
- 7개 축 평가 기준이 *본문 inline* vs *references/* 어디에 있어야 하는지.
- Quality Loop 모드 와 7축 구조 감사 분리도 — 별도 skill 후보 vs 한 skill 안 모드 분기.
- boundary 누락 (어떤 종류의 감사를 *하지 않는지*).

### 3. 압축 결정

skill-creator 리포트 + 본문 구조 분석 결과로 다음 결정:

| 압축 옵션 | 효과 | 리스크 |
|---|---|---|
| references/7-axis-detail.md 분리 | SKILL.md ~10KB 감소 | references 가독성 ↓, 호출 시 별도 로드 필요 |
| Quality Loop 모드 별도 skill 분리 (예: docs-quality-loop) | 두 skill 책임 명확 | skill 등록 추가, 사용자 혼동 가능 |
| sub-agent 위임 명세 references/ 분리 | SKILL.md ~3KB 감소 | sub-agent 호출 시 별도 로드 |
| 압축 안 함 | 변경 X | 19KB 유지 — 비대 위험 지속 |

**결정 기준**: 압축이 *skill 호출 흐름·trigger·boundary 의미* 를 해치면 보류. 가독성·trigger 매칭 영향 적으면 진행.

### 4. 강화안 + 압축 적용

- trigger keyword 보강.
- 결정된 압축 옵션 적용 (있다면).
- docs-style.md 8 패턴 재점검.

**critical**: 본 단계는 *결정만 하고 종료* 금지. 본 plan028 phase-01 첫 실행이 decision-only로 끝나 SKILL.md 무변경 + references/ 미생성 사례 있음. 재실행 시 반드시 다음을 수행:

1. compaction-decision.md 가 이미 존재하면 그 내용을 그대로 적용 (재결정 불필요).
2. SKILL.md 실제 편집 — 분리 대상 섹션을 references/<new>.md 로 이동 + 본문에 포인터 한 줄 남김.
3. references/ 디렉터리 + 새 파일 생성.
4. git diff 로 SKILL.md 크기 감소 확인 (>= 5KB 감소 목표).
5. step 5 commit 으로 마무리.

위 5단계가 *완료되지 않은 채* exit 하면 phase 실패 (PHASE_FAILED).

### 5. commit

- 메시지 (압축 X 경우): `docs(career-os): docs-audit SKILL.md skill-creator 강화 (plan028 phase-01)`.
- 메시지 (압축 O 경우): `docs(career-os): docs-audit SKILL.md skill-creator 강화 + references/ 분리 (plan028 phase-01)`.
- 본문에 4축 적용 + 압축 결정 근거.

## 검증 기준 (성공 조건)

- skill-creator 4축 리포트 audit/ 에 저장됨.
- SKILL.md frontmatter `name` 그대로, `description` 강화 (필요 시).
- 한국어 본문 의미 보존 (drift 0).
- 압축 시 SKILL.md ~10KB 이하 목표 (achievable 하면).
- skill discovery 매칭 동작 확인 — 11개 trigger phrase 영향 없음.

## 산출물

- `career-os/.claude/skills/docs-audit/SKILL.md` (강화, 압축 시 변경)
- (압축 시) `career-os/.claude/skills/docs-audit/references/<new>.md`
- `career-os/tasks/plan028-skill-creator-audit/audit/phase-01-docs-audit-skill-creator-report.md`
- `career-os/tasks/plan028-skill-creator-audit/audit/phase-01-compaction-decision.md` (압축 옵션 평가 + 결정 근거)

## 차단 조건 (block)

- skill-creator 가 *7축 의미 변경* 권장 → 거절 (본 plan 은 강화·압축만).
- 압축 결정이 *fos-study 감사 동작* 영향 → 압축 보류.

## critic / verify 사전 해소

common-pitfalls.md 섹션 1~5:

- 1 모호한 명세 X — 압축 옵션 4개 표로 명시.
- 2 산출물 위치 명시 ✓.
- 3 검증 기준 명시 ✓.
- 4 ADR-007 / 12KB+ 임계 명시 ✓.
- 5 압축 결정 근거 audit trail 보존.

## 의도적으로 안 하는 것

- 한국어 본문 리라이트 X — 강화·압축만.
- 7축 의미 / Quality Loop 동작 변경 X.
- 다른 career-os skill 영향 X.
- sub-agent 위임 명세 동작 변경 X.
