## ADR-004 — 워크스페이스 표준 구조 정식화

- Status: Accepted
- Date: 2026-05-18

### 맥락

career-os와 apartment 두 워크스페이스가 5문서 컨벤션 + AGENTS.md/CLAUDE.md 심링크 + tasks/plan{N}-<slug>/ 영역 + .env 워크스페이스 root + docs vs data 분리 패턴으로 수렴. 다른 워크스페이스(stock-investment, travel) 신규 추가 시 동일 청사진 필요.

기존 워크스페이스 정책 분산:

- career-os ADR-018: docs/ 운영 정책 (5문서 + adr.md 단일 누적). 워크스페이스 한정 결정.
- career-os ADR-021: Discord 알림 openclaw 경유 + .env 워크스페이스 root 격리. 워크스페이스 한정 결정.
- career-os ADR-019: scripts/ 분리. 워크스페이스 한정 예외로 보존.

분산된 워크스페이스 ADR 중 모든 워크스페이스 공통 적용 부분은 모노레포 레벨로 격상 필요.

### 결정

ai-nodes 모노레포의 워크스페이스 표준 구조를 `ai-nodes/docs/workspace-structure.md`에 정식화. 본 문서가 현재 구조 단일 출처, ADR-004는 결정의 *왜* 책임.

표준 내용:

1. 디렉터리 트리 — AGENTS.md / CLAUDE.md 심링크 / .env / .env.example / config/ / docs/ 5문서 / skills/<name>/{SKILL.md, references/, scripts/} / .claude/skills/<name>/ / tasks/plan{N}-<slug>/ / data/ / logs/. **(2026-05-19 ADR-006: skills/<name>/ 부분 폐기, scripts/<name>/ + .claude/skills/<name>/ 분리로 변경)**
2. AGENTS.md + CLAUDE.md 심링크 — Claude Code 자동 로드.
3. docs/ 5문서 — prd / data-schema / flow / code-architecture / adr.md. ADR 누적 (개별 파일 신설 금지).
4. .env 워크스페이스 root + .env.example 템플릿 — 워크스페이스별 격리.
5. tasks/plan{N}-<kebab-slug>/ — planning + plan-and-build 영구 보관.
6. skills/<name>/ 통합 구조 + native skill 우선 등록.

career-os ADR-018 (docs/ 운영 정책) / ADR-021 (.env 워크스페이스 root 부분)을 본 ADR-004로 모노레포 격상. career-os ADR 본문 Status 라인에 `Lifted to ai-nodes ADR-004 (2026-05-18)` 표기.

거절한 대안:

- 워크스페이스별 독립 ADR 유지 (격상 안 함) — 같은 결정이 4 워크스페이스 ADR에 중복 표기 → drift 위험.
- 단일 거대 ADR 대신 디렉터리·5문서·.env·docs vs data·tasks/plan 별 분리 ADR — 새 워크스페이스 추가 시 N개 ADR 동시 적용. UX 나쁨.

### 결과

- 새 워크스페이스 추가 시 `workspace-structure.md` 청사진만 따르면 됨. ADR-004는 청사진 정당화.
- career-os ADR-018/021의 공통 적용 부분은 ADR-004로 격상. 워크스페이스 한정 부분 (career-os ADR-019 scripts/ 분리, ADR-021 Discord openclaw 부분)은 워크스페이스 ADR에 남음.
- workspace-structure.md 9번 매트릭스로 각 워크스페이스 표준 준수도 추적.
- 의도된 비대칭 (career-os ADR-019)도 명시되어 표준 이탈 결정 자체로 가시화.

### 적용

- `ai-nodes/docs/workspace-structure.md` (신설, 본 ADR의 적용 청사진)
- `ai-nodes/AGENTS.md` 1번 / 3-4 / 9번 / 10번 갱신
- `career-os/docs/adr.md` ADR-018 / ADR-021 Status 라인 격상 표기
- apartment 워크스페이스가 plan001에서 본 표준의 적용 첫 사례 (career-os는 plan023까지 진행으로 이미 표준 준수)

---
