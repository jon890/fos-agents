# Phase 02. sync-profile 을 plugin 의 Claude Code 전용 스킬로 옮기고 저장소 사본을 지운다

**Execution profile**: standard

## 목표

`career-os/.claude/skills/sync-profile/` 의 스킬, 참고 문서, 폼 조작 스크립트를 `career-os/plugin/skills/sync-profile/` 로 옮긴다.
원고와 사용량 기록은 MCP 도구로, 사용량 수집은 실행기 `usage` 로 하게 바꾸고 저장소 사본을 지운다. plugin 버전을 `0.6.0` 으로 올린다.

**범위 외**: 수집기 코드는 Phase 01 이다. 원티드와 LinkedIn 을 실제로 열지 않는다. 스크립트는 옮기고 명령 위치만 바꾼다. 폼 조작 로직은 바꾸지 않는다.

## 컨텍스트

- 옮길 파일: `career-os/.claude/skills/sync-profile/SKILL.md`, `references/github.md`, `references/linkedin.md`, `references/wanted.md`, `scripts/linkedin_fill_project.sh`, `scripts/linkedin_set_paragraphs.sh`, `scripts/wanted_list_fields.sh`, `scripts/wanted_set_field.sh`, `scripts/wanted_set_period.sh`. 링크 `career-os/.codex/skills/sync-profile` 도 있다
- 다섯 스크립트는 `#!/bin/zsh` 이고 `B=~/.claude/scripts/browser-driver` 로 개인 설치 경로를 박아 둔다. `browser-driver` 는 사용자의 PATH 에 있는 명령으로 본다
- `references/wanted.md`, `references/linkedin.md` 는 `S=career-os/.claude/skills/sync-profile/scripts` 로 스크립트 위치를 정한다
- `SKILL.md` 와 `references/github.md` 의 Backend 명령과 대응하는 MCP 도구
  - `manage_profile.ts documents list|get|put` → `list_profile_documents`, `get_profile_document`, `save_profile_document`
  - `manage_profile.ts usage list` → `list_usage_snapshots`
  - `collect_usage.ts` → `<CAREER_LOCAL> usage`
  - `render_chart.ts` 와 README·SVG 반영 → `update_github_profile`(차트를 그리고 배지를 검사한다. `get_github_profile` 로 현재 값을 읽는다)
  - `manage_candidate_context.ts get --key career-status` → `get_context_document`
  - `usage put --replace` 는 MCP 도구가 없다. 기록을 고치는 일은 저장소 세션에서 한다고 적는다
  - `gh api user ...`, `gh repo create`, `gh api /markdown` 은 Claude Code 의 `gh` 로 그대로 둔다
  - `skill begin|finish sync-profile` → `<CAREER_LOCAL> workspace begin|finish sync-profile --json`. `managedSkills` 에 이미 있다
- `SKILL.md` 4단계가 `../resume-preparer/references/claim-model.md` 를 링크한다. plugin 에도 `career-os/plugin/skills/resume-preparer/references/claim-model.md` 가 있어 같은 상대 링크가 맞는다
- 테스트: `career-os/scripts/profile/sync_profile_skill_doc.test.ts` 는 저장소 사본 디렉터리를 읽고 `career-os/scripts/profile/manage_profile.ts`, `documents get`, `documents put`, `--expected-version`, `skill begin sync-profile` 이 `documents list` 뒤에 있음, github 참고에 `usage list` 와 `collect_usage.ts` 와 `render_chart.ts`, 코드 영역의 `career-os/` 경로가 실제로 있음을 단언한다. `career-os/plugin/scripts/local-skills.test.ts` 는 plugin 스킬 디렉터리 목록을 정확히 비교하고(지금 넷) 스킬별 `describe` 를 둔다. `career-os/scripts/candidate-context/skill_boundary.test.ts` 의 `skillDirectory` 는 저장소, `plugin/skills`, `plugin/connector-skills` 순으로 찾는다
- `career-os/plugin/connector-skills/career-connector/SKILL.md` 82번째 줄이 「원고만 고치고 사이트 반영은 노트북의 `sync-profile` 에서 하라고 안내한다」 다. 대화용 스킬 본문 합계 상한 8,000자와 `career-os/`, `bun `, `git ` 금지가 `connector-config.test.ts` 에 있다
- `career-os/README.md` 15번째 줄이 `/sync-profile` 을 안내한다
- 버전은 `package.json`, `.claude-plugin/plugin.json`, `src/server.ts` 의 `McpServer` 세 곳이고 지금 `0.5.0` 이다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「sync-profile」 절, `career-os/docs/flow.md` 의 「sync-profile」 절,
`career-os/docs/adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md`

## 의도 메모

- `sync-profile` 은 Hermes 예약 실행이 쓰지 않고 다른 저장소 스킬이 import 하지 않는다. 그래서 저장소 사본을 이번에 지운다(ADR-139)
- 스크립트 실행 경로는 스킬 본문이 `${CLAUDE_PLUGIN_ROOT}/skills/sync-profile/scripts` 로 알려 주고 references 는 `<SCRIPTS>` 로 적는다. Bash 에는 그 값이 전달되지 않는다

## 작업 항목

### 1. 이동

```bash
# cwd: 저장소 루트
mkdir -p career-os/plugin/skills
git mv career-os/.claude/skills/sync-profile career-os/plugin/skills/sync-profile
git rm career-os/.codex/skills/sync-profile
```

### 2. 스크립트 다섯

- `B=~/.claude/scripts/browser-driver` 를 `B="${BROWSER_DRIVER:-browser-driver}"` 로 바꾼다. 그 밖은 바꾸지 않는다

### 3. `SKILL.md`

- 앞머리 `description` 에 「Claude Code 에서만 돈다」 를 더한다
- 본문 첫머리에 「실행 환경」 절: Claude Code 에서만, 실행기 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 를 `<CAREER_LOCAL>` 로, 폼 스크립트 디렉터리 `${CLAUDE_PLUGIN_ROOT}/skills/sync-profile/scripts` 를 `<SCRIPTS>` 로 적는다. `browser-driver` 가 PATH 에 있거나 `BROWSER_DRIVER` 로 위치를 준다
- 개요 표 1단계와 7단계, 1단계와 7단계 본문의 `manage_profile.ts` 명령을 위 대응표의 MCP 도구로 바꾼다. 「원고마다 저장소 밖 임시 경로에 받는다」 와 임시 파일 지우기 문장은 도구가 본문을 바로 돌려주므로 지운다. `version` 을 `save_profile_document` 의 `expectedVersion` 으로 넘긴다
- `skill begin|finish sync-profile` 를 `<CAREER_LOCAL> workspace begin|finish sync-profile --json` 으로. 원고가 없을 때만 받는다는 조건은 그대로다
- 2단계의 `manage_candidate_context.ts get --key career-status` 를 `get_context_document` 로
- 5단계의 「`~/.claude/scripts/browser-driver` 로 조작한다」 를 「`browser-driver` 로 조작한다」 로, 「스크립트는 `scripts/` 에 있다」 를 「스크립트는 `<SCRIPTS>` 에 있다」 로
- 「대화에서 하려면 fos-assistant 의 커리어 커넥터로도…」 는 「GitHub 의 README 와 차트는 `update_github_profile` 로 올린다」 로 바꾼다
- 「2026-10 실측으로 `CAREER_BACKEND_URL` 이 비어 있어…」 문장은 지운다
- 실행 환경 절에 `<CAREER_LOCAL> usage` 와 `workspace` 가 셸의 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 을 쓴다고 적는다. 원고가 없을 때 읽는 지원 디렉터리는 `workspace begin` 결과의 `root` 아래 `applications/` 다
- 5단계 표의 GitHub 저장 칸 `git push` 를 `update_github_profile` 로 바꾼다. 처음 프로필 저장소를 만드는 `github.md` 의 `gh repo create` 절차는 그대로 둔다
- 「임시 경로의 원고에 함께 남긴다」 는 「원고에 함께 남긴다」 로

### 4. references

- `wanted.md`, `linkedin.md`: `S=career-os/.claude/skills/sync-profile/scripts` 를 `S=<SCRIPTS>` 로, `B=~/.claude/scripts/browser-driver`(`wanted.md` 12줄, `linkedin.md` 9줄)를 `B="${BROWSER_DRIVER:-browser-driver}"` 로, `wanted.md` 8줄의 「`~/.claude/scripts/browser-driver` 로 연다」 를 「`browser-driver` 로 연다」 로
- `github.md`: `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts usage list` 를 `list_usage_snapshots` 도구로, `collect_usage.ts` 명령을 `<CAREER_LOCAL> usage` 로, `render_chart.ts` 명령 블록과 그 설명을 「차트와 Tokens 배지는 `update_github_profile` 이 기록으로 그리고 검사한다」 로 바꾼다. `python3 career-os/scripts/agent-usage/agent_usage.py --months 2` 단가 확인은 저장소 세션의 일로 한 줄 남기고 경로를 지운다. `usage put --replace` 는 저장소 세션에서 한다고 적는다. 「`career-os/docs/data-schema.md` 의 「차트와 Tokens 배지」」 참조는 지운다
- 모든 `.md` 에서 `career-os/`, `--env-file`, `git rev-parse`, `~/.claude/scripts` 가 없어진다

### 5. 그 밖의 안내

- `career-connector/SKILL.md` 82번째 줄을 「원고만 고치고 사이트 반영은 Claude Code 에서 이 plugin 의 `sync-profile` 로 하라고 안내한다」 로
- `career-os/README.md` 15번째 줄을 「- 원티드, LinkedIn, GitHub 프로필을 갱신할 때: plugin 의 `sync-profile` (Claude Code)」 로

### 6. 버전 올리기

- 세 곳을 `0.6.0` 으로. `plugin.json` 의 `description` 끝 문장을 「Claude Code 에서는 공고 추천, 이력서 준비, 프로필 동기화, 공고별 질문 연습, 읽을거리 수집과 리포트도 한다.」 로
- `bun run --cwd career-os/plugin build` 로 `dist/career-mcp.js` 를 다시 만든다. `dist/career-local.js` 는 바뀌지 않아야 한다

### 7. 테스트

- `career-os/scripts/profile/sync_profile_skill_doc.test.ts` 수정
  - `skillDirectory` 를 `career-os/plugin/skills/sync-profile` 로
  - 「원고를 manage_profile.ts 로 읽고 쓴다」 를 「원고를 MCP 도구로 읽고 쓴다」 로: `list_profile_documents`, `get_profile_document`, `save_profile_document`, `expectedVersion` 이 본문에 있다
  - 「작업본 받기가 첫 동작이 아니다」 는 `workspace begin sync-profile` 이 `list_profile_documents` 뒤에 있다로
  - 「사용량은 기록을 읽고 수집기로 채운다」 는 github 참고에 `list_usage_snapshots` 와 `<CAREER_LOCAL> usage` 가 있다로
  - 「차트는 TypeScript CLI 로 그리고…」 는 github 참고에 `update_github_profile` 이 있고 `render_chart.ts` 와 `agent_usage_chart` 가 없다로
  - 「코드 영역의 career-os 경로가 실제로 있다」 는 「references 의 `$S/<이름>.sh` 로 부르는 스크립트가 스킬의 `scripts/` 에 실제로 있다」 로 바꾼다. 찾은 이름이 1개 이상이라는 단언을 함께 둔다
  - 새 테스트: 다섯 스크립트에 `~/.claude/scripts` 가 없고 `BROWSER_DRIVER` 가 있다
- `career-os/plugin/scripts/local-skills.test.ts` 수정: 공통 테스트 「본문이 가리키는 references 파일이 모두 있다」 의 정규식이 `](references/` 나 `` `references/ `` 로 시작하는 링크만 잡게 고친다. 지금은 `../resume-preparer/references/claim-model.md` 에서 `claim-model.md` 를 뽑아 실패한다. 「넷 있다」 를 「다섯 있다」 로, 기대 목록에 `sync-profile` 을 이름 순으로. `sync-profile` 전용 `describe`: 디렉터리의 모든 파일에 `brain-search`, `brain-add`, `private brain`, `manage_profile.ts`, `~/.claude/scripts` 가 없다. `../resume-preparer/references/claim-model.md` 링크 말고는 `](../` 가 없다
- `career-os/plugin/scripts/connector-config.test.ts` 수정: 「스킬을 노트북 에이전트의 스킬 폴더에 링크하지 않는다」 에 `career-os/.claude/skills/sync-profile` 이 없다는 단언을 더하고, `career-connector` 본문이 「노트북의 `sync-profile`」 을 담지 않는다는 단언을 더한다. 89번째 줄의 「노트북의 CLI 로 저장하라고」 는 큰 문서를 저장소 CLI 로 저장하라는 안내라 그대로 둔다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/scripts/profile/sync_profile_skill_doc.test.ts ./career-os/plugin/scripts/local-skills.test.ts ./career-os/plugin/scripts/connector-config.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
claude plugin validate career-os/plugin
for f in career-os/plugin/skills/sync-profile/scripts/*.sh; do zsh -n "$f" || exit 1; done
test ! -e career-os/.claude/skills/sync-profile
test ! -e career-os/.codex/skills/sync-profile
```

기대값: 모두 종료 코드 0.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/skills/sync-profile/SKILL.md` | 신규 |
| `career-os/plugin/skills/sync-profile/references/github.md` | 신규 |
| `career-os/plugin/skills/sync-profile/references/linkedin.md` | 신규 |
| `career-os/plugin/skills/sync-profile/references/wanted.md` | 신규 |
| `career-os/plugin/skills/sync-profile/scripts/linkedin_fill_project.sh` | 신규 |
| `career-os/plugin/skills/sync-profile/scripts/linkedin_set_paragraphs.sh` | 신규 |
| `career-os/plugin/skills/sync-profile/scripts/wanted_list_fields.sh` | 신규 |
| `career-os/plugin/skills/sync-profile/scripts/wanted_set_field.sh` | 신규 |
| `career-os/plugin/skills/sync-profile/scripts/wanted_set_period.sh` | 신규 |
| `career-os/.claude/skills/sync-profile/SKILL.md` | 삭제 |
| `career-os/.claude/skills/sync-profile/references/github.md` | 삭제 |
| `career-os/.claude/skills/sync-profile/references/linkedin.md` | 삭제 |
| `career-os/.claude/skills/sync-profile/references/wanted.md` | 삭제 |
| `career-os/.claude/skills/sync-profile/scripts/linkedin_fill_project.sh` | 삭제 |
| `career-os/.claude/skills/sync-profile/scripts/linkedin_set_paragraphs.sh` | 삭제 |
| `career-os/.claude/skills/sync-profile/scripts/wanted_list_fields.sh` | 삭제 |
| `career-os/.claude/skills/sync-profile/scripts/wanted_set_field.sh` | 삭제 |
| `career-os/.claude/skills/sync-profile/scripts/wanted_set_period.sh` | 삭제 |
| `career-os/.codex/skills/sync-profile` | 삭제 |
| `career-os/scripts/profile/sync_profile_skill_doc.test.ts` | 수정 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/connector-skills/career-connector/SKILL.md` | 수정 |
| `career-os/README.md` | 수정 |
| `career-os/plugin/package.json` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
