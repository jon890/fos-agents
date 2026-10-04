# Phase 05. 대화용 스킬의 안내를 plugin 스킬로 돌리고 plugin 버전을 0.3.0 으로 올린다

**Execution profile**: standard

## 목표

대화용 스킬이 「저장소를 연 노트북 세션의 스킬」 로 안내하던 일을 Claude Code 의 plugin 스킬로 안내하게 고치고, plugin 버전을 `0.3.0` 으로 올린다.
README 가 plugin 의 새 구성을 가리키게 한다.

**범위 외**: `career-connector` 의 `sync-profile` 안내와 공고 추천, 이력서 스킬은 다른 계획이다. 실행기와 Claude Code 전용 스킬의 본문은 Phase 03, 04 다.

## 컨텍스트

- `career-os/plugin/connector-skills/interview-practice/SKILL.md` 의 「6. 이 대화에서 하지 않는 일」 끝 줄이 「두 가지는 저장소를 연 노트북 세션의 `interview-practice` 에서 하라고 안내한다.」 다. 저장소의 그 스킬은 Phase 04 가 지웠다
- `career-os/plugin/connector-skills/study-topic-recommender/SKILL.md` 의 「6. 이 대화에서 하지 않는 일」 끝 줄이 「세 가지는 저장소를 연 노트북 세션의 `study-topic-recommender` 에서 하라고 안내한다.」 다
- 두 스킬은 fos-assistant 의 지침에 합쳐진다. `career-os/plugin/scripts/connector-config.test.ts` 가 `connector-skills/` 본문 합계 8,000자와 본문에 `career-os/`, `bun `, `git ` 이 없음을 검사한다
- 버전은 `career-os/plugin/package.json`, `career-os/plugin/.claude-plugin/plugin.json` 의 `version` 과 `career-os/plugin/src/server.ts` 의 `new McpServer({ name: "fos-career", version: "0.2.0" })` 세 곳에 있다. `connector-config.test.ts` 의 「plugin.json 과 package.json 의 version 이 같다」 가 앞의 둘을 대조한다
- `career-os/README.md` 13번째 줄이 `/interview-practice <tech|behavioral>` 를, 18번째 줄이 「`interview-practice`는 공개 질문 보강도 내부 유지보수 절차로 처리한다.」 를 적고 있다. 21번째 줄이 fos-assistant 커넥터 안내다. 열린 PR #145 가 28번째 줄을 고치므로 그 줄은 건드리지 않는다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절, 「로컬 실행기」 절, 「커넥터 설치 계약」 절,
`career-os/docs/flow.md` 의 「대화에서 면접 연습」 절과 「대화에서 공부 추천」 절

## 의도 메모

- 대화용 스킬 본문에 `${CLAUDE_PLUGIN_ROOT}` 나 실행기 명령을 쓰지 않는다. 연결용 에이전트에는 셸이 없다. 스킬 이름만 안내한다
- 도구 목록은 바뀌지 않는다. 그래도 Claude Code 가 새 디렉터리와 실행기를 읽게 하려면 버전을 올려야 설치본이 갱신된다

## 작업 항목

### 1. 대화용 스킬 안내

- `connector-skills/interview-practice/SKILL.md` 의 「6. 이 대화에서 하지 않는 일」 끝 줄을 「공고별 질문 연습과 외부 자료에서 개인 질문을 찾는 일은 Claude Code 에서 이 plugin 의 `interview-question-prep` 스킬로 하라고 안내한다. 공개 질문 은행은 대화에서 고치지 않는다.」 로
- `connector-skills/study-topic-recommender/SKILL.md` 의 끝 줄을 「세 가지는 Claude Code 에서 이 plugin 의 `study-collection` 스킬로 하라고 안내한다.」 로

### 2. 버전 올리기

- `package.json`, `.claude-plugin/plugin.json` 의 `version` 을 `0.3.0` 으로
- `server.ts` 의 `McpServer` 버전을 `"0.3.0"` 으로
- `plugin.json` 의 `description` 을 「후보자 맥락 문서와 프로필 원고를 고치고 GitHub 프로필을 갱신하며, 면접 연습 기록과 공부 추천을 커리어 Backend 에 남긴다. Claude Code 에서는 공고별 질문 연습과 읽을거리 수집, 리포트도 한다.」 로

### 3. `career-os/README.md` 수정

- 13번째 줄을 「- 기술·인성 면접을 연습할 때: plugin 의 `interview-practice`. 공고별 질문으로 연습하거나 질문을 더 찾을 때: plugin 의 `interview-question-prep`」 로
- 18번째 줄을 「공개 질문 보강은 [`public/question-bank/MAINTENANCE.md`](public/question-bank/MAINTENANCE.md)의 저장소 유지 절차로 한다.」 로
- 21번째 줄 다음에 「Claude Code 에서는 `plugin/` 을 설치해 같은 스킬과 로컬 실행기를 쓴다. 실행기가 읽는 환경 변수는 [`docs/data-schema.md`](docs/data-schema.md#로컬-실행기-환경-변수)를 따른다.」 를 더한다

### 4. 테스트

- `career-os/plugin/scripts/connector-config.test.ts` 수정: 「새 스킬은 셸과 저장소 경로를 쓰지 않고…」 테스트 안에 `interview-practice` 본문은 `interview-question-prep` 을, `study-topic-recommender` 본문은 `study-collection` 을 담고 「노트북 세션」 을 담지 않는다는 단언을 더한다

### 5. 번들 재생성

`bun run --cwd career-os/plugin build` 로 다시 만든다. `server.ts` 의 버전이 바뀌어 `dist/career-mcp.js` 가 바뀐다. `server.ts` 는 `dist/career-local.js` 에 들어가지 않으므로 그 파일은 바뀌지 않아야 한다.

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/plugin/scripts/connector-config.test.ts
bun test ./career-os/scripts ./career-os/plugin ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
claude plugin validate career-os/plugin
python3 -c "import re,glob;print(sum(len(re.sub(r'^---\n.*?\n---\n','',open(f).read(),flags=re.S).strip())+2 for f in sorted(glob.glob('career-os/plugin/connector-skills/*/SKILL.md'))))"
```

기대값: 명령이 모두 종료 코드 0 이고 마지막 줄이 8000 이하의 수를 찍는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/connector-skills/interview-practice/SKILL.md` | 수정 |
| `career-os/plugin/connector-skills/study-topic-recommender/SKILL.md` | 수정 |
| `career-os/plugin/package.json` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
| `career-os/README.md` | 수정 |
