## ADR-013 — agent skill 정본과 Codex 노출 경로를 분리한다

- Status: Partially superseded by ADR-014 (2026-06-16) — repo 전역 정본 경로 부분만
- Date: 2026-06-16

### 맥락

Claude CLI 호출 비용 문제 때문에 기존 `.claude/skills` workflow를 Codex에서도 직접 실행할 필요가 생겼다.
단순 wrapper로 `claude -p`를 호출하면 비용 문제가 해결되지 않는다.
반대로 `.claude/skills`와 `.codex/skills`에 본문을 복사하면 skill 내용이 갈라질 위험이 크다.

Codex skill 선택은 `SKILL.md` 본문을 읽기 전에 frontmatter의 `name`과 `description`만 보고 이뤄진다.
따라서 본문 `When to use`에 자연어 trigger를 많이 두는 구조는 Codex 호출 정확도에 도움이 작다.

### 결정

- 모든 워크스페이스의 skill 정본은 `<workspace>/.claude/skills/<skill>/SKILL.md`로 유지한다.
- Codex 노출은 `<workspace>/.codex/skills/<skill>` 심볼릭 링크로 둔다.
- repo 전역 skill 정본은 `skills/<skill>/SKILL.md`로 유지한다.
- repo 전역 Codex 노출은 `.codex/skills/<skill>` 심볼릭 링크로 둔다.
- `SKILL.md` frontmatter에는 `name`과 `description`만 둔다.
- skill 사용 여부를 결정하는 자연어 trigger, 슬래시 호출 형태, 주요 라우팅 경계는 `description`에 둔다.
- 본문에는 이미 호출된 뒤 필요한 입력 해석, 범위 해석, 실행 절차만 둔다.
- 운영 runner의 `run_with_claude.sh`와 `claude -p` 경로는 호환 계층으로 유지할 수 있다.
  새 대화형 작업에서는 현재 에이전트가 같은 SKILL.md를 직접 읽고 실행한다.

### 결과

- Codex가 apartment, stock-investment, health-care, career-os, repo 전역 skill을 같은 본문으로 읽을 수 있다.
- skill 본문 복사로 인한 Claude/Codex drift를 피한다.
- 새 skill을 추가할 때는 `.claude/skills` 또는 `skills/` 정본을 만들고 대응 `.codex/skills` 링크를 추가하면 된다.
- description 품질이 skill 호출 정확도의 1차 기준이 된다.

### 적용

- `.codex/skills/`
- `apartment/.codex/skills/`
- `stock-investment/.codex/skills/`
- `health-care/.codex/skills/`
- `<workspace>/.claude/skills/*/SKILL.md`
- `skills/*/SKILL.md`

---
