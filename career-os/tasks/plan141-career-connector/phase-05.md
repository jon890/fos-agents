# Phase 05. 연결용 에이전트의 스킬 본문을 쓰고 파이썬 차트 스크립트를 지운다

**Execution profile**: standard

## 목표

`career-os/plugin/skills/career-connector/SKILL.md` 를 만든다. fos-assistant 가 이 본문을 연결용 에이전트의 지침으로 쓴다.
차트 코드가 TypeScript 한 벌만 남도록 파이썬 차트 스크립트와 그것을 직접 대조하던 테스트를 지우고, `sync-profile` 스킬과 문서가 새 경로를 가리키게 한다.

**범위 외**: fos-assistant 에 설치하고 실제 대화로 확인하는 일은 `remote-verification.md` 의 항목이다. 원티드와 LinkedIn 절차는 고치지 않는다.

## 컨텍스트

fos-assistant 가 스킬을 다루는 방법이다.

- 설치할 때 plugin 의 `skills/<스킬>/SKILL.md` 를 이름 순으로 읽어 앞머리(frontmatter)를 떼고 이어 붙인 본문을 연결용 에이전트의 지침으로 쓴다
- `SKILL.md` 밖의 파일은 읽지 않는다. 에이전트가 따를 규칙은 모두 본문에 둔다
- 합친 본문은 8,000자까지다. 넘으면 커넥터가 카탈로그에서 빠진다
- 스킬 디렉터리 아래에 심볼릭 링크가 하나라도 있거나 앞머리가 닫히지 않으면 카탈로그에서 빠진다
- 연결용 에이전트는 셸과 파일 도구가 없고 Memory 를 받지 않는다. 커넥터의 MCP 도구만 쓴다
- 승인이 필요한 도구를 부르면 실행되지 않고 승인 요청이 된다. 사용자가 승인 카드에서 승인하면 저장한 인자로 한 번 실행되고 결과가 대화로 온다. 결과가 「실행했는지 알 수 없음」 이면 다시 실행하지 말아야 한다
- 직렬화한 인자가 UTF-8 16KB 를 넘는 호출은 거절된다

본보기는 `accountbook/plugin/skills/accountbook-api/SKILL.md` 다. 앞머리의 모양, 승인 카드 안내 문단, 「오류와 완료」 절을 읽는다.
길이와 링크를 검사하는 테스트의 본보기는 `accountbook/plugin/scripts/connector-config.test.ts` 의 마지막 테스트다.

도구의 이름, 입력, 결과, 오류 코드는 `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절이, 대화의 순서와 갈라지는 곳은 `career-os/docs/flow.md` 의 「fos-career 커넥터」 절이 정한다. 본문은 이 두 절과 어긋나지 않게 쓴다.

지울 것과 그것을 가리키는 곳이다. 앞선 작업이 이 파일들을 고쳤을 수 있으므로 아래 명령으로 지금의 줄을 찾는다.

```bash
# cwd: 저장소 루트
git grep -n "agent_usage_chart" -- career-os ':!career-os/tasks' ':!career-os/docs/adr' ':!career-os/plugin/scripts/connector-config.test.ts' ':!career-os/scripts/profile/sync_profile_skill_doc.test.ts'
```

이 계획서를 쓸 때 그 결과는 아래 넷이었다.

- `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` 자신
- `career-os/.claude/skills/sync-profile/SKILL.md` 의 「5. 반영」 절 스크립트 표의 한 줄
- `career-os/.claude/skills/sync-profile/references/github.md` 의 「에이전트 사용량」 절. `python3 "$A/agent_usage_chart.py" --month ... --out "$OUT"` 명령과 그 아래 설명
- `career-os/docs/code-architecture.md` 의 「sync-profile」 절 표의 두 줄(`agent_usage_chart.py` 와 `library/profiles/github-agent-usage.svg`)

`career-os/docs/code-architecture.md` 의 「스킬 폴더」 절에 스킬별 `scripts/` 파일 수를 적은 표가 있다. `sync-profile` 줄의 수가 파일 하나만큼 줄어야 한다.

**근거 문서**: `career-os/docs/flow.md` 의 「fos-career 커넥터」 절, `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절, `career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절과 「sync-profile」 절, `career-os/docs/prd.md` 의 「fos-career 커넥터」 절, `career-os/docs/adr/ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md`

## 의도 메모

- 이 스킬을 `career-os/.claude/skills/` 에 링크하지 않는다. 노트북의 에이전트에는 이 MCP 도구가 없고 프로필 갱신은 `sync-profile` 이 맡는다. 가계부 커넥터와 다른 점이다
- 본문에 실제 수치, 저장소 이름, 주소를 쓰지 않는다. 예시는 지어낸 값이다
- 본문은 도구의 입력 스키마를 되풀이하지 않는다. 순서, 승인 규칙, 하지 않는 일을 적는다. 8,000자 가운데 절반 안팎으로 쓴다
- fixture 테스트(`chart.test.ts`)는 남긴다. 파이썬이 없어진 뒤에 출력을 고정하는 것은 그 테스트다
- 스킬 본문만 바뀌는 phase 라 번들은 바뀌지 않는다. 그래도 번들 일치 검사를 돌려 확인한다

## Blocked 조건

- `career-os/plugin/src/github.ts` 가 없으면 `PHASE_BLOCKED: GitHub 도구가 아직 없다` 를 출력하고 종료한다
- `career-os/scripts/profile/sync_profile_skill_doc.test.ts` 가 없으면 `PHASE_BLOCKED: plan139 가 이 브랜치에 없다. plan139 를 머지한 main 으로 rebase 한다` 를 출력하고 종료한다
- `python3` 이 PATH 에 없으면 `PHASE_BLOCKED: python3 이 없어 agent-usage 테스트를 돌릴 수 없다` 를 출력하고 종료한다
- `career-os/scripts/agent-usage/render_chart.ts` 가 없으면 `PHASE_BLOCKED: 파이썬 스크립트를 대신할 CLI 가 없다` 를 출력하고 종료한다

## 작업 항목

### 1. `career-os/plugin/skills/career-connector/SKILL.md`

앞머리는 `name: career-connector` 와 `description` 이다. `description` 에는 무엇을 하는지와 「프로필 갱신」, 「GitHub 프로필 업데이트」, 「후보자 맥락 문서 수정」, 「사용량 기록 보여 줘」 같은 요청에 쓴다는 것을 적는다.

본문은 한국어 평서체다. 아래 절을 이 순서로 둔다.

| 절 | 담을 것 |
| --- | --- |
| 머리 문단 | `career` MCP 도구만 쓴다. 셸, 파일 쓰기, HTTP 직접 호출을 하지 않는다. token 을 사용자에게 묻거나 대화에 붙여 넣게 하지 않는다 |
| 승인 | 저장과 GitHub 갱신은 승인 카드에서 승인한 것만 실행된다. 도구를 부르면 승인 요청이 만들어지고 같은 도구를 다시 부르지 않는다. 결과를 받기 전에 반영됐다고 말하지 않는다. 결과가 실행했는지 알 수 없다고 오면 다시 부르지 않고 읽기 도구로 확인한다. 대화에서 받은 확인으로 승인 카드를 대신하지 않는다 |
| 읽기 | 도구 일곱(`check_connection` 포함)이 무엇을 읽는지 한 줄씩. 문서 키 넷과 셋 |
| 문서 고치기 | 1. `get_*_document` 로 현재 본문과 `version` 을 읽는다. 2. 변경 전후를 보여 준다. 3. 확인받는다. 4. 저장 도구를 한 번 부른다. `body` 는 문서 전체이고 `expectedVersion` 은 읽은 `version`, 새 문서는 0 이다. `note` 에 바꾼 이유를 적는다. `CAREER_VERSION_CONFLICT` 면 다시 읽고 변경을 검토한 뒤 새로 승인받는다. `CAREER_NOT_FOUND` 는 아직 만들지 않은 문서다 |
| GitHub 프로필 갱신 | `career-os/docs/flow.md` 의 「대화에서 프로필 갱신」 여섯 단계. 숫자를 직접 계산하지 않는다. `list_usage_snapshots` 의 기록에 없는 달은 넣지 않는다. 배지 값은 `update_github_profile` 의 결과나 `CAREER_BADGE_MISMATCH` 의 `expected` 로 맞춘다. `months` 는 1개에서 6개다. 올린 뒤 README 를 `save_profile_document` 의 `github` 원고로 저장한다 |
| 하지 않는 일 | 원티드와 LinkedIn 사이트에 반영하지 않는다. 원고만 고치고 사이트 반영은 노트북의 `sync-profile` 에서 하라고 안내한다. 사용량을 측정하거나 기록을 고치지 않는다. 지난달 기록이 없으면 세션 기록이 있는 기기의 수집기가 올릴 때까지 기다리라고 안내한다. 계정 소개를 바꾸지 않는다 |
| 큰 문서 | 저장할 본문이 길어 호출이 거절되면 다시 부르지 않고 노트북의 CLI 로 저장하라고 안내한다 |
| 공개 범위 | 프로필은 여러 회사가 상시로 본다. 사내 운영 수치, 사내 조직명과 도구 이름을 새로 넣을 때는 사용자에게 확인받는다. 이력서 원고에 없는 문장을 지어내지 않는다 |
| 오류와 완료 | 오류의 `code` 와 `message` 를 전한다. `CAREER_UNAUTHORIZED`, `CAREER_GITHUB_UNAUTHORIZED`, `CAREER_GITHUB_NOT_CONFIGURED` 는 연결 화면에서 token 을 다시 등록하라고 안내한다. `CAREER_NETWORK` 와 `CAREER_GITHUB_UNAVAILABLE`, `CAREER_GITHUB_CONFLICT` 는 다시 보내기 전에 읽기 도구로 상태를 확인한다. 문서 본문과 token 을 요약 밖으로 되풀이해 싣지 않는다 |

### 2. `career-os/plugin/scripts/connector-config.test.ts` 에 스킬 검사

본보기의 「스킬 본문은 설치하는 쪽의 지침 상한 안에 있고 링크가 없다」 테스트와 같은 검사를 더한다.

- `skills/` 아래 어떤 항목도 심볼릭 링크가 아니다
- 스킬마다 `SKILL.md` 가 `---\n` 으로 시작하고 앞머리가 닫힌다
- 앞머리를 뺀 본문을 이어 붙인 길이가 8,000 이하다
- 본문에 `connector.json` 의 `tools` 에 선언한 도구 열 개의 이름이 모두 나온다
- `career-os/.claude/skills/career-connector` 가 없다

### 3. 파이썬 차트 스크립트와 직접 대조 테스트 삭제

- `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` 를 지운다
- `career-os/scripts/agent-usage/chart.python-parity.test.ts` 를 지운다
- `career-os/scripts/agent-usage/fixtures/` 와 `chart.test.ts` 는 그대로 둔다
- `career-os/scripts/profile/sync_profile_skill_doc.test.ts` 의 단언에서 `scripts/agent_usage_chart.py` 를 읽는 부분을 뺀다. 대신 `github.md` 에 `render_chart.ts` 가 있고 `agent_usage_chart` 가 없다는 단언을 더한다. 이 테스트 파일은 부정 단언 때문에 `agent_usage_chart` 라는 글을 담는다

### 4. `sync-profile` 스킬 문서

`career-os/.claude/skills/sync-profile/SKILL.md`

- 스크립트 표에서 `agent_usage_chart.py` 줄을 지운다
- 「5. 반영」 절의 대상별 표(칸이 넷이다) 바로 아래에 한 문장을 더한다. 대화에서 하려면 fos-assistant 의 커리어 커넥터로도 README 와 차트를 올릴 수 있다는 문장이다. 표 칸 안에는 쓰지 않는다

`career-os/.claude/skills/sync-profile/references/github.md` 의 「에이전트 사용량」 절

- `python3 "$A/agent_usage_chart.py" ...` 명령을 아래로 바꾼다

```bash
bun --env-file=career-os/.env career-os/scripts/agent-usage/render_chart.ts --months 2031-01,2031-02 --out "$OUT"
```

- `A=career-os/.claude/skills/sync-profile/scripts` 줄은 차트 명령만 쓰던 것이므로 지운다. 다른 명령이 `$A` 를 쓰면 남긴다
- `--month` 의 두 수를 설명하던 문장을 지우고, `--months` 는 차트에 넣을 달이고 숫자는 Backend 의 사용량 기록에서 읽는다고 적는다. 기록에 없는 달을 넣으면 명령이 실패한다
- 명령이 내는 `total=` 값을 Tokens 배지에 쓴다는 문장은 남긴다. 배지 값의 모양은 `career-os/docs/data-schema.md` 의 「차트와 Tokens 배지」 를 가리킨다
- fos-assistant 의 커리어 커넥터로 올릴 때는 커넥터가 차트를 그리고 배지를 검사하므로 이 명령을 돌리지 않는다는 문장을 더한다

### 5. `career-os/docs/code-architecture.md`

- 「sync-profile」 절의 표에서 `agent_usage_chart.py` 줄을 지운다
- 같은 표에 `library/profiles/github-agent-usage.svg` 줄이 남아 있으면 지운다. 차트는 저장하지 않고 기록에서 그때마다 그린다(ADR-133)
- 「스킬 폴더」 절의 스킬별 표에서 `sync-profile` 의 `scripts/` 수를 1 줄인다. 고친 뒤 `ls career-os/.claude/skills/sync-profile/scripts | wc -l` 의 값과 같아야 한다

### 6. `career-os/README.md`

- 「시작」 절의 목록 아래에, fos-assistant 의 대화에서 문서를 고치고 GitHub 프로필을 갱신할 때는 `plugin/` 의 커리어 커넥터를 쓴다는 한 문단을 더한다. 자세한 것은 `docs/code-architecture.md` 의 「fos-career 커넥터」 를 가리킨다
- 「검증」 절에 plugin 을 고쳤을 때의 명령이 `docs/code-architecture.md` 의 같은 절에 있다는 한 줄을 더한다. 명령을 옮겨 적지 않는다

### 7. 이 phase 를 검증하는 테스트

- 작업 항목 2 의 스킬 검사가 정상 경로다
- 실패 경로: 본문이 8,001자인 `SKILL.md` 를 임시 디렉터리에 만들어 같은 검사 함수에 넣으면 실패한다. 이를 위해 검사를 `skillBodyOf(directory): string` 함수로 빼고, 테스트가 실제 `skills/` 와 임시 디렉터리 둘에 부른다
- `career-os/scripts/agent-usage/chart.test.ts` 가 파이썬 파일 없이 통과한다
- `sync_profile_skill_doc.test.ts` 가 `scripts/agent_usage_chart.py` 를 읽지 않는다. 그 단언에서 파이썬 파일을 빼고 `github.md` 에 `render_chart.ts` 가 있고 `agent_usage_chart` 가 없다는 단언을 더한다. 이 파일은 부정 단언 때문에 그 글을 담으므로 검증의 grep 에서 pathspec 으로 뺀다

개수를 상수로 단언하는 테스트를 찾는다. `sync-profile` 의 스크립트 수나 파일 목록을 단언하는 테스트가 있으면 이 phase 에서 고치고 변경 파일에 더한다.

```bash
# cwd: 저장소 루트
git grep -nE "sync-profile" -- 'career-os/**/*.test.ts'
```

plan139 를 머지한 뒤에는 `career-os/scripts/candidate-context/skill_boundary.test.ts` 와 `career-os/scripts/profile/sync_profile_skill_doc.test.ts` 가 나온다. 앞의 것은 스크립트 수를 단언하지 않는다. 뒤의 것은 `.md` 파일과 `scripts/agent_usage_chart.py` 에 `library/profiles` 가 없다고 단언하므로 그 파이썬 파일을 직접 읽는다. 파일을 지우면 이 테스트가 실패하므로 아래 「3. 파이썬 차트 스크립트와 직접 대조 테스트 삭제」 에서 함께 고친다.

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test career-os/plugin career-os/scripts/agent-usage career-os/scripts/candidate-context career-os/scripts/profile/sync_profile_skill_doc.test.ts career-os/scripts/lib career-os/plugin/scripts/connector-config.test.ts career-os/scripts/agent-usage/chart.test.ts
bun run --cwd career-os/plugin typecheck
bunx tsc --noEmit
claude plugin validate career-os/plugin
git diff --exit-code -- career-os/plugin/dist/career-mcp.js
! git grep -n "agent_usage_chart" -- career-os ':!career-os/tasks' ':!career-os/docs/adr' ':!career-os/plugin/scripts/connector-config.test.ts' ':!career-os/scripts/profile/sync_profile_skill_doc.test.ts'
test ! -e career-os/.claude/skills/career-connector
python3 ~/personal/fos-skills/korean-check/scripts/korean-style-check.py career-os/plugin/skills/career-connector/SKILL.md career-os/.claude/skills/sync-profile/references/github.md
```

모두 종료 코드 0 이어야 한다.
`bun test` 가 요구하는 환경값이 있으면 실패한 테스트 파일의 머리에서 읽고 맞춘다. 이 phase 가 만들거나 고치는 테스트는 환경값을 요구하지 않고 Backend 와 GitHub 를 부르지 않는다.
마지막 줄의 검사기가 이 기기에 없으면 그 줄만 건너뛰고, 건너뛰었다는 것을 보고에 적는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/skills/career-connector/SKILL.md` | 신규 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` | 삭제 |
| `career-os/scripts/agent-usage/chart.python-parity.test.ts` | 삭제 |
| `career-os/scripts/profile/sync_profile_skill_doc.test.ts` | 수정 |
| `career-os/.claude/skills/sync-profile/SKILL.md` | 수정 |
| `career-os/.claude/skills/sync-profile/references/github.md` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
| `career-os/README.md` | 수정 |
