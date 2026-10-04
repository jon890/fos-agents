# Phase 01. 대화용 스킬 셋을 connector-skills 로 옮긴다

**Execution profile**: standard

## 목표

`career-os/plugin/skills/` 의 대화용 스킬 셋을 `career-os/plugin/connector-skills/` 로 옮기고, `plugin.json` 의 `skills` 가 그 디렉터리를 가리키게 한다.
fos-assistant 가 대화용 스킬만 지침으로 합치고, 뒤 phase 의 Claude Code 전용 스킬이 `skills/` 에 들어가도 8,000자 상한에 들지 않게 하려는 것이다.

**범위 외**: Claude Code 전용 스킬과 로컬 실행기는 Phase 03, 04 다. 스킬 본문의 문장은 이 phase 에서 바꾸지 않는다. plugin 버전 올리기는 Phase 05 다.

## 컨텍스트

- fos-assistant 는 `.claude-plugin/plugin.json` 의 `skills`(문자열 또는 문자열 배열, 없으면 `"./skills"`) 아래 각 `<스킬>/SKILL.md` 본문을 이름 순으로 합친다. 경로는 plugin 안의 링크 없는 디렉터리여야 한다
- Claude Code 는 기본 `skills/` 를 늘 읽고 `plugin.json` 의 `skills` 경로를 더해 읽는다. 그래서 `connector-skills/` 의 스킬은 Claude Code 에서도 보인다
- 지금 `career-os/plugin/.claude-plugin/plugin.json` 에는 `skills` 키가 없다
- `career-os/plugin/scripts/connector-config.test.ts` 의 `skillsDirectory` 상수(`join(import.meta.dir, "..", "skills")`)가 지침 합계 8,000자와 도구 이름 포함을 검사한다. 「새 스킬은 셸과 저장소 경로를 쓰지 않고…」 테스트도 같은 상수로 `interview-practice`, `study-topic-recommender` 를 읽는다

**근거 문서**: `career-os/docs/adr/ADR-139-plugin-의-대화용-스킬과-claude-code-전용-스킬을-디렉터리로-나눈다.md`,
`career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절과 「커넥터 설치 계약」 절

## 의도 메모

- `plugin.json` 의 `skills` 를 배열이 아닌 문자열 `"./connector-skills"` 로 둔다. fos-assistant 는 둘 다 받지만, 배열에 `./skills` 를 함께 넣으면 Claude Code 전용 스킬이 지침에 섞인다
- 디렉터리를 옮기는 것은 `git mv` 로 한다. 이력을 잇기 위해서다
- `skills/` 디렉터리는 이 phase 뒤에 비게 된다. 빈 디렉터리는 git 이 추적하지 않으므로 따로 만들지 않는다. Phase 04 가 스킬을 넣는다

## 작업 항목

### 1. 디렉터리 이동

```bash
# cwd: 저장소 루트
git mv career-os/plugin/skills career-os/plugin/connector-skills
```

옮긴 뒤 `career-os/plugin/connector-skills/` 아래에 `career-connector/SKILL.md`, `interview-practice/SKILL.md`, `study-topic-recommender/SKILL.md` 셋만 있다.

### 2. `career-os/plugin/.claude-plugin/plugin.json` 수정

`"skills": "./connector-skills"` 를 더한다. 다른 키는 바꾸지 않는다.

### 3. `career-os/plugin/scripts/connector-config.test.ts` 수정

- `skillsDirectory` 를 `connectorSkillsDirectory = join(import.meta.dir, "..", "connector-skills")` 로 이름과 값을 바꾸고 쓰는 곳을 모두 맞춘다
- 새 테스트 「plugin.json 의 skills 는 connector-skills 하나만 가리킨다」: `read(".claude-plugin/plugin.json").skills` 가 `"./connector-skills"` 와 같다
- 새 테스트 「Claude Code 전용 skills 와 대화용 connector-skills 에 같은 이름의 스킬이 없다」: `join(import.meta.dir, "..", "skills")` 가 있으면 그 하위 디렉터리 이름과 `connector-skills` 의 하위 디렉터리 이름의 교집합이 빈 배열이다. `skills` 가 없으면 통과한다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun test ./career-os/plugin/scripts/connector-config.test.ts
bun test ./career-os/plugin
bun run --cwd career-os/plugin typecheck
claude plugin validate career-os/plugin
test ! -e career-os/plugin/skills/career-connector
```

기대값: 모두 종료 코드 0. `claude plugin validate` 가 `skills` 키를 경고 없이 받는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/connector-skills/career-connector/SKILL.md` | 신규 |
| `career-os/plugin/connector-skills/interview-practice/SKILL.md` | 신규 |
| `career-os/plugin/connector-skills/study-topic-recommender/SKILL.md` | 신규 |
| `career-os/plugin/skills/career-connector/SKILL.md` | 삭제 |
| `career-os/plugin/skills/interview-practice/SKILL.md` | 삭제 |
| `career-os/plugin/skills/study-topic-recommender/SKILL.md` | 삭제 |
| `career-os/plugin/.claude-plugin/plugin.json` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
