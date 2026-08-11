# ADR — travel

travel 워크스페이스 아키텍처 결정 누적.
새 결정은 가장 아래에 추가.

형식: `## ADR-N — 제목` + Status / Date 라인 + 맥락 / 결정 / 결과 3섹션.

모노레포 공통 결정은 [루트 ADR INDEX](../../docs/adr/INDEX.md)를 따른다.

---

## Quick Index

| ADR | 제목 | Status | 한 줄 요약 |
|---|---|---|---|
| ADR-001 | 워크스페이스 ai-nodes 표준 적용 + scripts/.claude/skills/ 의도된 비대칭 | Accepted | 5문서 + AGENTS + CLAUDE 심링크 + tasks/ 적용. scripts/ + .claude/skills/는 자동화 0 + workspace-level skill 0이라 의도된 부재 |

---

## ADR-001 — 워크스페이스 ai-nodes 표준 적용 + scripts/.claude/skills/ 의도된 비대칭

**Status**: Accepted
**Date**: 2026-05-20

### 맥락

travel은 ai-nodes 5번째 워크스페이스 중 4번째까지(apartment / career-os / stock-investment / health-care) 표준 적용 완료 후 마지막 미적용 워크스페이스였다.
발견 당시 상태:

- AGENTS.md 16줄 영문 + 한글 혼합, 섹션 2개(구조 / 운영 원칙)
- CLAUDE.md 심링크 없음
- 5문서 없음 (`docs/index.md`만 존재 — trip 인덱스)
- `tasks/` 없음
- `scripts/` 없음, `.claude/skills/` 없음, `config/` 없음, `.env` 없음
- 활성 운영 중 — `trips/osaka-2026-05/` 1 trip 활성
- cron / 자동화 등록 0

travel의 본질은 *문서 워크스페이스*다.
사용자가 trip별로 의사결정·일정·예약 정보를 마크다운으로 누적한다.
다른 워크스페이스(apartment / career-os / stock-investment / health-care)는 자동화 + 일자별 산출물 + cron/Discord 알림 + Claude CLI 호출 흐름이 핵심이지만 travel은 *대화 + 문서 작성*만 책임진다.

### 결정

ai-nodes 표준을 *부분 적용*한다 — *의도된 비대칭*.

**적용 항목**:
- 5문서(`prd / data-schema / flow / code-architecture / adr`) — 워크스페이스 컨벤션 일관성 + AI 에이전트 컨텍스트 단일 출처 확보.
- AGENTS.md 한글화 + 강화(16 → 70+ 라인) — 다른 워크스페이스 수준.
- CLAUDE.md 심링크 — Claude Code 자동 로드 표준.
- `tasks/plan{N}-<slug>/` — plan 사이클 운영.

**부재 항목(의도된 비대칭)**:
- `scripts/` — runner·자동화 없음.
  - 도입 시점: trip 자동 일정 생성 / 예약 가격 수집 등 명확한 자동화 요구사항 발생 시 별도 plan에서 ADR-002 결정 후 추가.
- `.claude/skills/` — workspace-level skill 없음.
  - 단, trip-instance 안 컨텍스트(`trips/<trip-id>/docs/`)가 Claude 호출의 사실상 진입점.
- `config/` — runtime 설정 없음.
- `.env` — 선택적 실행 환경 값을 저장한다.
  - 공개 가능한 키 목록만 `.env.example`에 둔다.

**거절한 대안**:

대안 A — 완전 표준 강행(`scripts/` + `.claude/skills/` 빈 디렉터리 생성).
- 거절 이유: 빈 placeholder는 실 의미 없음.
- 향후 실 자동화 도입 시 재설계가 필요해 오히려 비용이 더 큼.
- 의도된 비대칭이 정직한 표기.

대안 B — 경량 적용(CLAUDE 심링크 + AGENTS 한글화만).
- 거절 이유: 5문서 없이는 워크스페이스 정합성 + AI 에이전트 컨텍스트 단일 출처가 미흡함.
- trip 추가 시 컨벤션 표류 위험.

### 결과

- 5문서 + AGENTS / CLAUDE 일관성 확보 — 다른 4 워크스페이스와 컨텍스트 로드 패턴 동일.
- 현재 구조는 `docs/code-architecture.md`에서 설명한다.
- 향후 자동화 도입 시 — 별도 plan에서 ADR-002(`scripts/` 도입) + ADR-003(`.claude/skills/` 도입) 추가.
- trip-instance 영역 변경 없음 — `trips/<trip-id>/` 구조는 ADR-001 적용 영역 외.
