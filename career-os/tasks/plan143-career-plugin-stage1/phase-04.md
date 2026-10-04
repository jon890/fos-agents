# Phase 04. plugin 판을 올리고 plugin 스킬의 경계를 검사한다

**Execution profile**: standard

## 목표

Phase 02, 03 이 도구 여섯과 스킬 둘을 더한 plugin 을 `0.2.0` 으로 올린다.
plugin 스킬이 셸과 저장소 경로를 쓰지 않는다는 것과 저장소 판 스킬이 그대로 남는다는 것을 테스트로 고정한다.

**범위 외**: 저장소 판 스킬(`career-os/.claude/skills/interview-practice/`, `career-os/.claude/skills/study-topic-recommender/`)은 고치지 않는다. 지우는 일은 2단계다. 스킬 본문은 Phase 02, 03 에서 썼다.

## 컨텍스트

- 판은 `career-os/plugin/package.json`, `career-os/plugin/.claude-plugin/plugin.json`, `career-os/plugin/src/server.ts` 의 `new McpServer({ name: "fos-career", version: "0.1.0" })` 세 곳에 있다. `connector-config.test.ts` 의 「plugin.json 과 package.json 의 version 이 같다」 가 앞의 둘을 대조한다
- fos-assistant 는 `plugin/skills/` 아래 모든 `SKILL.md` 본문을 이름 순으로 합쳐 8,000자까지 받는다. `connector-config.test.ts` 의 `skillBodyOf` 가 그 합계를 계산한다
- 노트북 세션은 `career-os/.claude/skills/` 의 저장소 판을 쓴다. plugin 스킬을 그 폴더에 링크하지 않는다(`career-os/docs/code-architecture.md` 의 「커넥터 설치 계약」)

**근거 문서**: `career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절과 「커넥터 설치 계약」 절,
`career-os/docs/adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md`

## 의도 메모

- 저장소 판 스킬이 실제 디렉터리인지 단언하는 이유: 저장소 판이 plugin 판을 가리키게 바뀌면 노트북 세션의 로컬 단계(공고별 질문, 수집, HTML 리포트)가 사라진다
- 스킬 본문에 `career-os/`, `bun `, `git ` 이 없어야 하는 이유: 연결용 에이전트에는 셸이 없고, 3단계에서 plugin 이 다른 저장소로 옮겨진다

## 작업 항목

### 1. 판 올리기

- `career-os/plugin/package.json`, `career-os/plugin/.claude-plugin/plugin.json` 의 `version` 을 `0.2.0` 으로
- `career-os/plugin/src/server.ts` 의 `new McpServer({ name: "fos-career", version: "0.1.0" })` 을 `"0.2.0"` 으로
- `plugin.json` 의 `description` 을 「후보자 맥락 문서와 프로필 원고를 고치고 GitHub 프로필을 갱신하며, 면접 연습 기록과 공부 추천을 커리어 Backend 에 남긴다.」 로
- `connector.json` 의 `description` 을 「후보자 맥락 문서와 프로필 원고를 고치고, 면접 연습과 공부 추천을 기록하며, GitHub 프로필을 갱신합니다.」 로

### 2. `career-os/README.md` 수정

- 「fos-assistant 의 대화에서 문서를 고치고 GitHub 프로필을 갱신할 때는 `plugin/` 의 커리어 커넥터를 쓴다.」 를 「fos-assistant 의 대화에서 문서를 고치고, 면접을 연습하고, 공부 주제를 고르고, GitHub 프로필을 갱신할 때는 `plugin/` 의 커리어 커넥터를 쓴다.」 로 바꾼다

### 3. 테스트

- `career-os/plugin/scripts/connector-config.test.ts` 수정
  - 기존 「스킬 본문은…」 테스트가 세 스킬을 합쳐 확인하는지 본다. 지금 구현이 디렉터리를 모두 읽으므로 그대로 통과해야 한다
  - 새 테스트: 두 새 `SKILL.md` 본문에 `career-os/`, `bun `, `git ` 이 없다. 앞머리의 `name` 이 디렉터리 이름과 같다. `description` 이 1,024자 이하다
  - 「스킬을 노트북 에이전트의 스킬 폴더에 링크하지 않는다」 를 넓혀 `career-os/.claude/skills/interview-practice` 와 `study-topic-recommender` 가 심볼릭 링크가 아닌 실제 디렉터리임을 단언한다. 저장소 판이 plugin 판을 가리키게 바뀌면 노트북 세션의 로컬 단계가 사라지기 때문이다

### 4. `career-os/plugin/dist/career-mcp.js` 재생성

`server.ts` 의 판이 바뀌었으므로 다시 만든다.

## 검증

```bash
# cwd: 저장소 루트
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/plugin/scripts/connector-config.test.ts
bun test ./career-os/plugin ./career-os/scripts ./career-os/.claude/skills
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
claude plugin validate career-os/plugin
python3 -c "import re,glob;print(sum(len(re.sub(r'^---\n.*?\n---\n','',open(f).read(),flags=re.S).strip())+2 for f in sorted(glob.glob('career-os/plugin/skills/*/SKILL.md'))))"
```

기대값: 명령이 모두 종료 코드 0 이고 마지막 줄이 8000 이하의 수를 찍는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/package.json` | 수정 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/plugin/src/server.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
| `career-os/README.md` | 수정 |
