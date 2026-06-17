## ADR-014 — repo 전역 skill 정본을 .claude/skills로 통일

- Status: Accepted
- Date: 2026-06-16

### 맥락

ADR-013은 워크스페이스 skill 정본을 `<workspace>/.claude/skills/`로, repo 전역 skill 정본을 루트 `skills/`로 분리해 규정했다.
그 결과 루트만 본체 위치가 워크스페이스 표준과 달라 비대칭이 남았다.
`.gitignore`는 이미 `.claude/*`를 무시하되 `.claude/skills/`를 추적 예외로 둬 `.claude/skills/` 본체 커밋을 허용한다.
또 루트 `.claude/skills/`에 `docs-check` 심링크가 누락돼 Claude Code 세션에 docs-check이 노출되지 않는 문제도 있었다.

### 결정

- repo 전역 skill 정본도 `.claude/skills/<skill>/`로 둔다. 워크스페이스 표준(ADR-013)과 통일한다.
- 루트 `skills/` 디렉터리는 폐기한다.
- repo 전역 Codex 노출은 `.codex/skills/<skill>` → `../../.claude/skills/<skill>` 심링크로 재지정한다.
- ADR-013의 "repo 전역 정본 = `skills/`" 결정만 supersede한다. 워크스페이스 정본·Codex 분리 원칙은 유효하다.

### 결과

- 루트·워크스페이스 모든 skill이 `.claude/skills/` 단일 본체 패턴으로 통일된다.
- docs-check 심링크 누락이 해소돼 Claude Code 세션에 노출된다.
- `run-phases.py`의 루트 계산 깊이를 한 단계 늘리고, docs-check glob을 `.claude/skills/*`로 통합한다.

### 적용

- `.claude/skills/*` (루트 전역 5개 본체)
- `.codex/skills/*` (심링크 재지정)
- `README.md`, `AGENTS.md`, `docs/docs-style.md`, `docs/workspace-structure.md`
