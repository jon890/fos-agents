# Phase 02. Claude Code 전용 position-recommender 스킬을 더하고 plugin 버전을 0.4.0 으로 올린다

**Execution profile**: standard

## 목표

`career-os/plugin/skills/position-recommender/` 를 더해 Claude Code 에 plugin 만 설치한 곳에서도 공고 추천 일일 실행을 하게 한다.
판정 기준 문서는 저장소 사본과 같은 내용을 두고, 둘이 어긋나지 않는다는 것을 테스트로 고정한다.

**범위 외**: 실행기 코드는 Phase 01 이다. 저장소 사본 `career-os/.claude/skills/position-recommender/` 는 홈서버 Hermes 예약 실행이 쓰므로 고치거나 지우지 않는다(ADR-139). 대화용 스킬(`connector-skills/`)은 바꾸지 않는다.

## 컨텍스트

- Claude Code 전용 스킬의 형식은 `career-os/plugin/skills/interview-question-prep/SKILL.md` 와 `career-os/plugin/skills/study-collection/SKILL.md` 를 따른다. 본문 첫머리에 「Claude Code 에서만」 을 두고, 실행기 명령 `bun --no-env-file "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js"` 를 알려 준 뒤 본문과 `references/` 에서 `<CAREER_LOCAL>` 로 적는다
- `career-os/plugin/scripts/local-skills.test.ts` 가 `plugin/skills/` 의 모든 디렉터리를 검사한다. 앞머리 `name` 과 디렉터리 이름 일치, `description` 1,024자 이하, 본문의 실행기 명령과 「Claude Code 에서만」, 모든 `.md` 에 `career-os/`, `git rev-parse`, `--env-file` 이 없음, `<CAREER_LOCAL> <이름>` 의 이름이 `PLUGIN_LOCAL_EXECUTORS` 에 있음, 본문의 `references/<파일>.md` 링크가 존재함이다
- 원본은 `career-os/.claude/skills/position-recommender/SKILL.md` 와 `references/judgment.md`, `references/failures.md` 다. 두 references 에는 저장소 경로가 없다
- Phase 01 이 `workspace paths --json` 결과에 `evidenceDir` 를 더했다. 공고 분석의 프로젝트 근거는 그 디렉터리에서 읽는다
- 버전은 `career-os/plugin/package.json`, `career-os/plugin/.claude-plugin/plugin.json` 의 `version` 과 `career-os/plugin/src/server.ts` 의 `new McpServer({ name: "fos-career", version: "0.3.0" })` 세 곳이다

**근거 문서**: `career-os/docs/flow.md` 의 「position-recommender」 절과 「Claude Code 에서 공고 추천」 절,
`career-os/docs/code-architecture.md` 의 「로컬 실행기」 절,
`career-os/docs/adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md`

## 의도 메모

- 판정 기준(`judgment.md`, `failures.md`)은 저장소 사본과 같은 내용을 복사한다. 저장소 사본이 남은 동안 둘을 함께 고쳐야 하므로, 내용이 같다는 테스트를 둔다. 저장소 사본을 지울 때 그 테스트도 지운다
- 게시 수단을 저장소 스킬 이름으로 고정하지 않는다

## 작업 항목

### 1. `career-os/plugin/skills/position-recommender/SKILL.md` 신규

원본 `SKILL.md` 의 목표, 판단 근거, 실행, 결과와 공개 경계, 최종 답변을 옮기고 아래만 바꾼다.

- 앞머리 `name: position-recommender`. `description` 은 원본 문장에 「Claude Code 에서만 돈다」 를 더한다. 1,024자 이하
- 「경로」 절을 「실행 환경」 절로 바꾼다. Claude Code 에서만 돌고, 실행기 명령과 `<CAREER_LOCAL>` 자리표시, 셸 환경의 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, 선택 `CAREER_DART_API_KEY` 를 적는다. 시작할 때 `<CAREER_LOCAL> workspace paths --json` 으로 `evidenceDir` 를 확인한다
- 판단 근거 링크는 `references/judgment.md`, `references/failures.md` 상대 경로로 쓴다
- 「구체적인 프로젝트 근거는 읽기 전용인 `career-os/sources/fos-study/task/`에서 확인한다.」 를 「구체적인 프로젝트 근거는 `evidenceDir` 에서 읽기 전용으로 확인한다. 디렉터리가 없거나 비었으면 근거가 없다고 밝히고 추측하지 않는다.」 로
- 명령 네 줄과 정리 명령을 `<CAREER_LOCAL> position <하위 명령> [--run <RUN_DIR>]` 로
- 「출력이 알려 주는 `manage_candidate_context.ts put` 명령으로 문서를 만들도록 안내하고」 를 「`save_context_document` 도구로 문서를 저장하도록 안내하고」 로
- `report-publisher` 를 「사용자가 가진 게시 수단」 으로. 「게시 확인은 `report-publisher`가 반환한 결과로 판단한다.」 는 「게시한 URL 이 열리는지 확인한다.」 로
- 「cron 실행과 수동 실행에 같은 형식을 적용한다.」 는 그대로 둔다

### 2. `career-os/plugin/skills/position-recommender/references/` 신규

- `judgment.md`, `failures.md` 를 원본에서 그대로 복사한다. 내용을 바꾸지 않는다

### 3. 버전 올리기

- `package.json`, `.claude-plugin/plugin.json` 의 `version` 을 `0.4.0` 으로, `server.ts` 의 `McpServer` 버전을 `"0.4.0"` 으로
- `plugin.json` 의 `description` 끝 문장을 「Claude Code 에서는 공고 추천, 공고별 질문 연습, 읽을거리 수집과 리포트도 한다.」 로
- `bun run --cwd career-os/plugin build` 로 `dist/career-mcp.js` 를 다시 만든다. `dist/career-local.js` 는 바뀌지 않아야 한다

### 4. 테스트

- `career-os/plugin/scripts/local-skills.test.ts` 수정
  - 「Claude Code 전용 스킬이 둘 있다」 를 「셋 있다」 로 바꾸고 기대 목록에 `position-recommender` 를 이름 순으로 더한다
  - `career-os/scripts/candidate-context/skill_boundary.test.ts` 는 저장소 사본을 먼저 찾아 plugin 사본을 검사하지 않는다. 그래서 plugin 의 `position-recommender` 디렉터리의 모든 파일에 `brain-search`, `brain-add`, `private brain` 이 없다는 단언을 이 파일에 더한다
  - `position-recommender` 본문에 `<CAREER_LOCAL> position collect`, `commit-company-tiers`, `commit-analyses`, `finalize`, `cleanup` 이 모두 있다
  - `career-os/plugin/skills/position-recommender/references/` 의 `judgment.md`, `failures.md` 가 `career-os/.claude/skills/position-recommender/references/` 의 같은 파일과 바이트 단위로 같다. 저장소 사본이 없으면 이 단언을 건너뛰지 않고 실패한다. 사본을 지울 때 이 단언도 함께 지운다는 주석을 둔다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/plugin/scripts/local-skills.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
claude plugin validate career-os/plugin
```

기대값: 모두 종료 코드 0.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/skills/position-recommender/SKILL.md` | 신규 |
| `career-os/plugin/skills/position-recommender/references/judgment.md` | 신규 |
| `career-os/plugin/skills/position-recommender/references/failures.md` | 신규 |
| `career-os/plugin/scripts/local-skills.test.ts` | 수정 |
| `career-os/plugin/package.json` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
