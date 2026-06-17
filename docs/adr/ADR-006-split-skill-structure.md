## ADR-006 — 워크스페이스 표준 패턴 변경: 통합 → 분리 (.claude/skills 본체화)

**Status**: Accepted
**Date**: 2026-05-19

### 맥락

ai-nodes ADR-004는 워크스페이스 표준을 `skills/<name>/{SKILL.md, references/, scripts/}` 통합 패턴으로 정식화.
하지만 career-os ADR-019는 분리 패턴 (의도된 비대칭).
두 패턴 공존 + apartment plan007에서 분리 패턴 포팅 결정 (apartment ADR-004) → 모든 active 워크스페이스가 분리로 수렴.

통합 표준이 *실제로는 비표준* — 비대칭 (career-os) + apartment 한정 적용 (plan007 전까지).
새 워크스페이스 추가 시 청사진이 *실제 사용 패턴*과 어긋남.

### 결정

ai-nodes 워크스페이스 표준 패턴을 **분리**로 변경:

- 표준: `<workspace>/scripts/<name>/` 실행 파일 + `<workspace>/.claude/skills/<name>/{SKILL.md, references/}` 컨텍스트 자산.
- career-os ADR-019 비대칭이 표준으로 격상. workspace-structure.md 의도된 비대칭 표에서 제거.
- ADR-004 *Partially superseded* — `skills/<name>/` 통합 표준 부분만. 5문서·.env·tasks/plan·CLAUDE 심링크 정책은 유효.
- workspace-structure.md 청사진 + 매트릭스 갱신.

거절한 대안:

- ADR-004 통합 표준 유지 + 워크스페이스별 비대칭 — 청사진 모호 지속.
- apartment 한정 단일 통합 (`.claude/skills/<name>/` + scripts 포함) — 세 번째 패턴, 정합 더 나쁨.

### 결과

- 모든 워크스페이스 분리 패턴 수렴 — career-os 이미 분리, apartment plan007에서 마이그.
- ai-nodes ADR-004 Status: `Partially superseded by ADR-006 (2026-05-19) — skills/<name>/ 통합 표준 부분`.
- career-os ADR-019 Status: `Lifted to ai-nodes ADR-006 (2026-05-19) — 비대칭이 표준으로 격상`.
- stock-investment / travel은 audit 시 본 표준 따름.
- native skill 단일 진입점 (`claude -p "/<name>"`) 일관.

**적용**: `apartment/tasks/plan007-skills-folder-retirement` phase-04 — workspace-structure.md 갱신 + ai-nodes/AGENTS.md 1-1 비대칭 표 제거. career-os 영향 없음 (이미 분리 패턴).
