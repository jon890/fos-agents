# Phase 05. sync-profile 스킬이 원고를 Backend 에서 읽고 쓰게 바꾼다

**Execution profile**: standard

## 목표

`sync-profile` 스킬 문서를 고쳐, 원고를 `library/profiles/` 가 아니라 `manage_profile.ts` 로 읽고 쓰게 한다.
홈서버 SSH 가 닿지 않아도 프로필을 갱신하고, 노트북의 스킬과 커넥터가 같은 원고를 보게 하려는 것이다.

**범위 외**: 실행 코드는 바꾸지 않는다. `agent_usage_chart.py` 는 머리 주석만 고치고, 지우거나 TypeScript 로 옮기지 않는다. 비공개 작업본의 `library/profiles/` 파일을 지우지 않는다. `resume-preparer` 의 검증 장부가 `library/profiles/` 경로를 묶는 규칙(`career-os/.claude/skills/resume-preparer/scripts/verified-claims/store.ts`)은 건드리지 않는다.

## 컨텍스트

- 스킬 문서는 `career-os/.claude/skills/sync-profile/SKILL.md` 와 `references/` 의 셋이다. `library/profiles/` 를 적은 곳은 `SKILL.md` 의 1, 2, 7단계와 개요 표, `references/github.md` 의 「에이전트 사용량」 절, `scripts/agent_usage_chart.py` 의 머리 주석이다. `references/wanted.md` 와 `references/linkedin.md` 에는 없다
- 지금 1단계 「작업본 받기」 는 `bun career-os/scripts/career-workspace/cli.ts skill begin sync-profile --json` 으로 비공개 작업본을 받고, 7단계가 `skill finish sync-profile` 로 발행한다. 홈서버에 닿지 못하면 로컬 원고로 진행할지 묻는다
- 프로필 CLI 는 `career-os/scripts/profile/manage_profile.ts` 다. 명령은 `documents list|get|put` 과 `usage list|put` 이다. **옵션 이름은 그 파일의 사용법 문자열을 읽고 적는다.** 본보기인 `career-os/scripts/candidate-context/manage_candidate_context.ts` 는 `get --key <k> [--out <path>]`, `put --key <k> --file <path> --expected-version <n> --note <note>` 다. `--out` 은 git 저장소 안 경로를 거절한다(`career-os/scripts/candidate-context/repository-guard.ts`)
- 연결값을 넘기는 방법은 `bun --env-file=career-os/.env <스크립트>` 다. 선례는 `career-os/.claude/skills/study-topic-recommender/references/execution.md` 다
- 수집기는 `career-os/scripts/agent-usage/collect_usage.ts` 다. 표준 출력은 `<YYYY-MM> <코드>` 다
- `career-os/scripts/career-workspace/cli.ts` 의 `managedSkills` 에서 `sync-profile` 을 빼지 않는다. 원고가 없어 `applications/` 를 읽는 경우에 여전히 작업본을 받는다
- 스킬 문서를 고치기 전에 사용자 지침이 가리키는 스킬 문서 구조 기준을 읽는다. 목표, 워크플로우 개요 표, 단계별 상세의 순서를 유지한다

**근거 문서**: `career-os/docs/flow.md` 의 「sync-profile」 절과 그 아래 「사용량 수집」 절, `career-os/docs/code-architecture.md` 의 「sync-profile」 절, `career-os/docs/data-schema.md` 의 「sync-profile」 절, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- Backend 에 닿지 못할 때 로컬 파일로 대신하게 하지 않는다. 파일과 Backend 에 원고가 따로 생기면 한쪽만 고쳐진다
- 스킬이 그 자리에서 측정한 값을 프로필에 쓰게 하지 않는다. 이미 기록된 달을 다시 세면 값이 줄어든다. 숫자는 기록에서만 읽는다
- 2026-10 실측을 적은 문장 가운데 홈서버 SSH 가 닿지 않았다는 것은 지운다. 그 실패가 생기던 단계가 없어진다. 이유는 ADR-133 에 있다
- 원고를 저장소 안 파일로 받지 않는다. 개인 내용이 저장소에 남는다

## Blocked 조건

- `career-os/scripts/profile/manage_profile.ts` 가 없으면 `PHASE_BLOCKED: 프로필 CLI 가 머지되기 전` 을 출력하고 종료한다
- `career-os/scripts/agent-usage/collect_usage.ts` 가 없으면 `PHASE_BLOCKED: Phase 02 미완료` 를 출력하고 종료한다

## 작업 항목

### 1. `career-os/.claude/skills/sync-profile/SKILL.md` 수정

워크플로우 개요 표를 아래로 바꾼다. 단계 수는 일곱 그대로다. 지금 표는 `단계`, `이름`, `통과 조건`, `reference` 의 네 칸이다. **`reference` 칸을 유지한다.** 1단계와 7단계의 `reference` 는 지금처럼 비워 두고, 2 ~ 6단계는 지금 값을 그대로 둔다.

| 단계 | 이름 | 통과 조건 | reference |
| --- | --- | --- | --- |
| 1 | 원고 받기 | `documents list` 의 응답을 받았고, 있는 원고마다 `documents get` 으로 받은 본문과 `version` 이 있다 | |
| 2 | 원본과 대상 확인 | 그대로다 | 그대로다 |
| 3 | 공개 범위 결정 | 그대로다 | 그대로다 |
| 4 | 근거 확인 | 그대로다 | 그대로다 |
| 5 | 반영 | 그대로다 | 그대로다 |
| 6 | 저장 검증 | 그대로다 | 그대로다 |
| 7 | 원고 저장 | 고친 원고마다 `documents put` 의 응답에 올라간 `version` 이 있다 | |

1단계 「원고 받기」 의 본문이다.

- `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts documents list` 로 있는 원고와 `version` 을 본다
- 원고마다 `documents get --key <wanted|linkedin|github> --out "${TMPDIR:-/tmp}/<key>-profile.md"` 로 저장소 밖 임시 경로에 받는다. 받은 `version` 을 7단계의 `--expected-version` 으로 쓴다
- **Backend 에 닿지 못하면 멈추고 사용자에게 알린다.** 로컬 파일로 대신하지 않는다
- 원고가 없는 대상이 있으면 가장 최근 지원의 `evidence/resume-draft.md` 를 출발점으로 삼는다. **이때만** `skill begin sync-profile` 로 작업본을 받는다. `applications/` 를 읽기 때문이다. 지금의 `TRANSPORT_UNAVAILABLE` 안내는 이 경우의 설명으로 남기되, 「로컬 원고로 진행할지 묻는다」 는 「새 원고를 만들지 못한다고 알린다」 로 바꾼다. 그 아래 「진행하면 보고에 적는 두 가지」 목록(로컬 원고를 받은 날짜를 `ls -la career-os/library/profiles/` 로 보는 줄과 원고가 이 기기에만 남는다는 줄)은 지운다. 로컬 원고로 진행하는 경로가 없어진다
- `export PATH="$HOME/.bun/bin:$PATH"` 안내는 남긴다

2단계에서 고치는 것이다.

- 「대상별 원고를 `library/profiles/` 에 둔다」 와 파일 이름 셋을 적은 문장을 지우고, 원고는 1단계에서 받은 것이라고 적는다
- 「GitHub 의 에이전트 사용량. 지난달 측정값이 없으면 지금 측정한다」 를 「지난달 기록이 없으면 수집기를 한 번 실행한다」 로 바꾼다. 방법은 `references/github.md` 가 갖는다

5단계의 스크립트 표는 그대로다. `agent_usage.py` 줄은 Phase 01 이 이미 지웠다.

7단계 「원고 저장」 의 본문이다.

- 반영한 내용과, 폼 제약으로 원고와 다르게 넣은 것과 그 이유를 임시 경로의 원고에 적는다. 지금 문단을 그대로 쓴다
- `documents put --key <key> --file <임시 경로> --expected-version <1단계의 version> --note <무엇을 바꿨는지>` 로 저장한다. 새 원고는 `--expected-version 0` 이다
- 저장이 `409` 로 거절되면 다른 곳에서 원고가 바뀐 것이다. 다시 받아 차이를 사용자에게 보여 준 뒤에 저장한다. 덮어쓰지 않는다
- 저장한 뒤 임시 파일을 지운다
- 1단계에서 작업본을 받았을 때만 `skill finish sync-profile` 을 실행한다. `RESTORE_REQUIRED` 안내는 지운다. 로컬 원고로 진행하는 경로가 없어진다

### 2. `career-os/.claude/skills/sync-profile/references/github.md` 의 「에이전트 사용량」 절 수정

- 「측정값은 `library/profiles/github-agent-usage-snapshots.md` 에 달마다 한 줄로 적는다」 문단을 지우고 아래를 적는다
  - 기록은 `bun --env-file=career-os/.env career-os/scripts/profile/manage_profile.ts usage list` 로 읽는다
  - 지난달 기록이 없으면 `bun --env-file=career-os/.env career-os/scripts/agent-usage/collect_usage.ts` 를 한 번 실행한다. `CREATED` 면 다시 읽는다. `NO_SESSIONS` 면 그 달은 세션 기록이 이 기기에 없는 것이라 차트에서 뺀다
  - **스킬이 측정한 값을 프로필에 직접 쓰지 않는다.** `agent_usage.py` 를 직접 돌린 결과는 단가를 확인할 때만 본다
  - 기록을 고쳐야 하면 사용자에게 사유를 받아 `usage put` 에 `replace` 를 준다. 옵션 이름은 `manage_profile.ts` 의 사용법을 따른다
- 차트 명령의 설명을 고친다. `--month` 의 두 수는 `usage list` 가 준 그 달의 Claude Code 와 Codex 토큰을 십억으로 나눠 소수 한 자리로 적은 값이다. 예시의 `--month 2026.07=1.3,11.6 --month 2026.08=18.9,5.7` 은 지어낸 달과 값(`--month 2025.01=0.4,2.1 --month 2025.02=3.0,1.0`)으로 바꾼다
- 「기록이 없는 달이 섞이면 그 수치는 배지에서 뺀다」 는 「환산 비용이나 세션 수가 빈 달이 섞이면」 으로 고친다. 2026-10 실측 문장은 남긴다
- `python3 career-os/scripts/agent-usage/agent_usage.py --months 2` 블록은 단가표를 확인하는 방법으로만 남긴다

### 3. `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` 의 머리 주석 수정

코드는 바꾸지 않는다. 이 스크립트는 파일을 읽지 않고 `--month <월>=<Claude Code>,<Codex>` 인자로만 값을 받는다.

- 「값은 `library/profiles/github-agent-usage-snapshots.md` 의 측정 기록에서 가져온다.」 를 「값은 `manage_profile.ts usage list` 의 기록에서 가져온다. 그 달의 Claude Code 와 Codex 토큰을 십억으로 나눠 적는다.」 로 바꾼다
- 사용법 예시의 `--month 2026.07=1.3,11.6 --month 2026.08=19.0,5.7` 은 지어낸 달과 값(`--month 2025.01=0.4,2.1 --month 2025.02=3.0,1.0`)으로 바꾼다. `references/github.md` 의 예시와 같게 둔다
- 「지난 달을 `agent_usage.py` 로 다시 세어 넣지 않는다」 문장은 남긴다

### 4. `career-os/AGENTS.md` 수정

자리 표의 `library/profiles/` 줄을 아래로 바꾼다. `career-os/CLAUDE.md` 는 이 파일을 가리키는 심볼릭 링크라 따로 고치지 않는다.

```markdown
| 커리어 Backend 의 프로필 원고    | 대상별 프로필 원고. `manage_profile.ts documents get` 으로 읽는다 |
```

표의 열 너비는 다른 줄에 맞춘다. 같은 파일의 「조회할 것」 표는 고치지 않는다.

### 5. 이 phase 를 검증하는 테스트

`career-os/scripts/profile/sync_profile_skill_doc.test.ts` 신규. 스킬 문서를 읽어 단언한다. 본보기는 `career-os/scripts/candidate-context/skill_boundary.test.ts`(스킬 디렉터리의 파일을 모두 읽는 방법)와 `career-os/scripts/position-recommender/skill_doc.test.ts` 다.

- `career-os/.claude/skills/sync-profile/` 아래 `.md` 파일과 `scripts/agent_usage_chart.py` 어디에도 `library/profiles` 가 없다
- `SKILL.md` 의 워크플로우 개요 표 머리 줄에 `reference` 칸이 있다
- `SKILL.md` 에 `career-os/scripts/profile/manage_profile.ts`, `documents get`, `documents put`, `--expected-version` 이 있다
- `SKILL.md` 에서 `skill begin sync-profile` 이 나오는 자리가 `documents list` 가 나오는 자리보다 뒤다. 작업본 받기가 첫 동작이 아니라는 것을 확인한다
- `references/github.md` 에 `usage list` 와 `career-os/scripts/agent-usage/collect_usage.ts` 가 있다
- 스킬 문서의 코드 영역에서 `career-os/` 로 시작하고 자리표시자(`<...>`)가 없는 경로를 뽑아, `career-os/.env` 를 뺀 모두가 실제로 있는지 확인한다. 옮긴 스크립트의 옛 경로가 남으면 이 단언이 잡는다
- `career-os/AGENTS.md` 에 `library/profiles/` 가 없다

`career-os/scripts/candidate-context/skill_boundary.test.ts` 는 `sync-profile` 의 파일에 `brain-search`, `brain-add`, `private brain` 이 없는지를 본다. 이 phase 가 그 말을 더하지 않으므로 고칠 것이 없다. 깨지지 않는지만 아래 명령으로 확인한다. `career-os/docs/code-architecture.md` 의 스킬 구성 표(`sync-profile` 의 `scripts/` 6)는 이미 맞춰져 있다. `ls career-os/.claude/skills/sync-profile/scripts | wc -l` 이 6 인지 확인한다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/profile career-os/scripts/candidate-context career-os/scripts/profile/sync_profile_skill_doc.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -n "library/profiles" -- career-os/.claude/skills/sync-profile career-os/AGENTS.md
test "$(ls career-os/.claude/skills/sync-profile/scripts | wc -l | tr -d ' ')" = "6"
python3 ~/personal/fos-skills/korean-check/scripts/korean-style-check.py career-os/.claude/skills/sync-profile/SKILL.md career-os/.claude/skills/sync-profile/references/github.md
python3 career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py --month 2025.01=0.4,2.1 --month 2025.02=3.0,1.0 --out "${TMPDIR:-/tmp}/agent-usage-check.svg"
```

모두 종료 코드 0 이어야 한다. 환경값은 필요 없다. 마지막 명령의 검사기가 그 경로에 없으면 사용자 지침이 가리키는 한국어 점검 스킬의 검사기를 쓴다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/sync-profile/SKILL.md` | 수정 |
| `career-os/.claude/skills/sync-profile/references/github.md` | 수정 |
| `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` | 수정 |
| `career-os/AGENTS.md` | 수정 |
| `career-os/scripts/profile/sync_profile_skill_doc.test.ts` | 신규 |
