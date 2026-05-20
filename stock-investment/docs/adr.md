# ADR — stock-investment

stock-investment 워크스페이스 아키텍처 결정 누적.
새 결정은 가장 아래에 추가.

형식: `## ADR-N — 제목` + Status / Date 라인 + 맥락 / 결정 / 결과 3섹션.

모노레포 레벨 ADR: `../docs/adr.md`.

History: 기존 `docs/decisions/001~007.md` 는 plan004에서 git rm 완료 — 자료는 plan001 phase-01에서 5문서 (prd/data-schema/flow/code-architecture/adr)로 재분배됨.

---

## Quick Index

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | 워크스페이스 ai-nodes 표준 구조 적용 시작 | Accepted | 5문서 + AGENTS 한글화 + CLAUDE 심링크 + tasks/ (plan001). 분리 패턴 (plan002) + AGENTS 강화 (plan003) + decisions 폐기 (plan004) 시리즈 완료 |

---

## ADR-001 — 워크스페이스 ai-nodes 표준 구조 적용 시작

**Status**: Accepted
**Date**: 2026-05-20

### 맥락

stock-investment는 2026-05-05 운영 시작 이후 ai-nodes 표준 구조 (ADR-004) 미적용 상태로 유지됐다.
발견 시점 (2026-05-20 audit):

- 5문서 부재 (`docs/decisions/*` 7개만 — 기존 ADR 형식, 모노레포 표준 ADR-006 미적용)
- AGENTS.md 영문 짧음 (라우팅 / 외부 의존성 명세 미흡)
- CLAUDE.md 심링크 부재 (Claude Code 자동 로드 미활용)
- `tasks/` 부재 (plan 시스템 미운영)
- `.claude/skills/` 부재 (3 skill native 진입점 미등록)
- `skills/<name>/scripts/` 통합 패턴 (ai-nodes ADR-006 분리 표준 미적용)

워크스페이스 격리 원칙상 stock-investment를 *의도된 비대칭*으로 둘 수 있으나, 활성 운영 (매일 data 누적) 워크스페이스가 표준 부재 상태로 반복 audit drift 발생.
표준화로 전환한다.

### 결정

ai-nodes 표준 구조 적용 시리즈 시작. 3 plan 분할:

1. **plan001 (본 plan)**: docs 영역.
   - 5문서 신설
   - AGENTS.md 한글화
   - CLAUDE.md 심링크
   - `tasks/` 신설
   - `decisions/*` 7개는 5문서로 재분배 후 plan004에서 git rm 완료.
2. **plan002**: ADR-006 분리 패턴 마이그.
   - `skills/<name>/scripts/` → `scripts/<name>/` + `.claude/skills/<name>/{SKILL.md, references/}`
   - 3 skill 모두 적용.
3. **plan003**: AGENTS.md 강화 (4-1 진실 출처 + 4-2 투자 컨텍스트 + cron 시점 표).
4. **plan004**: `decisions/*` 7 파일 git rm + workspace-structure.md 매트릭스 stock-investment 항목 ?→O 갱신. .env는 plan001 phase-02 시점에 사용자 직접 신설 완료.

거절한 대안:

- 의도된 비대칭 공식화 ADR — 활성 운영 + audit drift 누적 상태에서 비표준 유지 비용 > 표준화 비용.
- 단일 큰 plan — 4-5 phase 한 번에 처리. rollback 복잡 + cron 영향 phase 안에 섞임. 시리즈가 안전.
- `decisions/*` 그대로 유지 + adr.md만 신규 — ai-nodes ADR-018 (개별 ADR 파일 신설 금지) 위반.

### 결과

- 워크스페이스 5문서 활성화 — drift 추적 단일 출처.
- Claude Code 자동 로드 → `claude -p "/<skill>"` 진입점 (plan002 후).
- `ai-nodes/docs/workspace-structure.md` 표에서 stock-investment 항목 갱신 (plan003 완료 후).
- 향후 plan 사이클 (`tasks/plan{N}-<slug>/`) 운영 가능.
- cron 운영 중단 없음 — plan001은 docs only. plan002 분리 마이그 시 cron 호출 경로 갱신 필요 (별도 plan에서 결정).

적용: plan001 (5문서 + AGENTS) → plan002 (분리 패턴) → plan003 (AGENTS 강화) → plan004 (decisions/ git rm + workspace-structure ✓).
