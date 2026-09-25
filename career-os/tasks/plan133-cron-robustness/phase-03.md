# Phase 03. 정리와 도움말을 CLI 가 맡고, cron 이 막는 명령을 스킬에서 없앤다

**Execution profile**: standard

## 목표

cron 실행에서 hermes 가 막는 명령을 모델이 쓰지 않아도 되게 한다. 임시 디렉터리 정리는 CLI 하위 명령으로 옮기고, 스킬 문서에서 막히는 명령을 부르는 지시를 없앤다.

**범위 외**: `.agents/skills/report-publisher/` 는 루트 공용 스킬이라 고치지 않는다. hermes 이미지에 `jq` 를 넣는 것은 fos-home-infra 의 일이다.

## 컨텍스트

2026-09-25 두 cron 실행에서 hermes 가 막은 명령이다. 사람이 승인할 수 없는 cron 실행이라 위험해 보이는 명령을 거절한다.

| 막힌 명령 | 횟수 | 모델이 하려던 일 | 나온 곳 |
| --- | --- | --- | --- |
| `rm -rf` 류 삭제 | 4 | 실행 디렉터리 정리 | 포지션 `SKILL.md` 「결과와 공개 경계」 끝의 「검증과 전달이 끝나면 `<RUN_DIR>`을 삭제한다」, 공부 `SKILL.md` 의 「불필요한 임시 파일을 정리한다」 |
| `bun -e`, `python -c`, heredoc, `execute_code` | 5 | JSON 을 읽거나 고치는 즉석 스크립트 | 스킬에 지시 없음 |
| `.pages.dev` 주소 직접 조회 | 2 | 게시 결과 확인 | report-publisher 스크립트가 이미 확인한다 |
| `morning_reading_cli.ts --help` | 1 | 사용법 확인 | CLI 가 `지원하지 않는 옵션: --help` 로 거절한다 |

실행 디렉터리는 두 가지다.

- 포지션: `career-os/scripts/position-recommender/position_run.ts` 의 `createRunDirectory` 가 시스템 임시 디렉터리 아래에 `position-recommendation-` 접두사로 만든다
- 공부: `career-os/scripts/study-topic-recommender/runtime-paths.ts` 의 `validateRunRoot` 가 시스템 임시 디렉터리 아래의 `study-topic-recommender.` 접두사만 받는다

`bun <스크립트 파일>` 실행은 hermes 가 막지 않는다. 막는 것은 명령줄에서 코드를 바로 넘기는 형태와 삭제 명령이다.

**근거 문서**: `docs/flow.md` 의 포지션 추천과 공부 추천 흐름 절

## 의도 메모

- **정리 명령은 지울 경로를 스스로 검증한다.** 시스템 임시 디렉터리 바로 아래이고 접두사가 맞을 때만 지운다. 그 밖의 경로는 지우지 않고 종료 코드 2 로 끝낸다
- `finalize` 안에서 지우는 안은 기각했다. 모델은 `finalize` 뒤에 HTML 을 게시하고 결과를 전달하므로, 그 전에 지우면 안 된다
- 스킬 문서에는 「즉석 스크립트를 쓰지 않는다」를 한 줄로 적고, 대신 읽을 것(CLI stdout, 큐 파일)을 적는다. 금지만 적으면 모델이 다른 우회를 찾는다
- 게시 확인은 report-publisher 가 돌려준 결과로 판단한다고 두 스킬에 적는다

## 작업 항목

### 1. 포지션 `cleanup` 하위 명령

`position_run.ts` 의 `COMMANDS` 에 `cleanup` 을 더한다. `--run <RUN_DIR>` 이 필요하다.
경로 검증을 통과하면 디렉터리를 지우고 `정리 완료: <디렉터리 이름>` 을 낸다. 도움말 `HELP` 에 한 줄을 더한다.

### 2. 공부 `--cleanup` 동작과 `--help`

`morning_reading_cli.ts` 의 `actionFlags` 와 `booleanOptions` 에 `--cleanup` 을 더한다. `resolveStudyRunRoot` 로 실행 경로를 검증하고 그 디렉터리를 지운다.
`--help` 와 `-h` 가 있으면 다른 인자 검사 전에 사용법을 stdout 에 내고 종료 코드 0 으로 끝낸다. 사용법에는 하위 동작 플래그와 값 옵션을 적는다.

### 3. 스킬 문서

- `career-os/.claude/skills/position-recommender/SKILL.md`
  - 「검증과 전달이 끝나면 `<RUN_DIR>`을 삭제한다」를 `bun career-os/scripts/position-recommender/position_run.ts cleanup --run <RUN_DIR>` 로 정리한다는 문장으로 바꾼다
  - 「실행」 절에 두 줄을 더한다. JSON 을 다루려고 `bun -e`, `python -c`, heredoc 같은 즉석 스크립트를 쓰지 않고 CLI stdout 과 큐 파일을 읽는다는 것, 게시 확인은 report-publisher 결과로 한다는 것이다
- `career-os/.claude/skills/study-topic-recommender/SKILL.md`
  - 「불필요한 임시 파일을 정리한다」를 `--cleanup --run-dir <RUN_DIR>` 로 정리한다는 문장으로 바꾼다. 「사용자가 결과를 확인하기 전에 유일한 HTML 파일을 삭제하지 않는다」는 그대로 둔다
  - 같은 두 줄을 더한다
- `career-os/.claude/skills/study-topic-recommender/references/execution.md` 의 명령 목록에 `--cleanup` 과 `--help` 를 더한다

### 4. 테스트

- `career-os/scripts/position-recommender/position_run.test.ts`
  - 임시 디렉터리 아래 `position-recommendation-` 디렉터리는 `cleanup` 이 지운다
  - 다른 경로(예: 임시 디렉터리 밖, 접두사가 다른 디렉터리)는 지우지 않고 종료 코드 2 다
- `career-os/scripts/lib/cli-contract.test.ts` 의 아침 읽을거리 절
  - `--help` 는 종료 코드 0 이고 stdout 이 사용법으로 시작한다
  - `--cleanup` 에 임시 디렉터리 밖 경로를 주면 종료 코드 2 이고 아무것도 지우지 않는다
- 스킬 문서 테스트 `career-os/scripts/position-recommender/skill_doc.test.ts`, `career-os/scripts/study-topic-recommender/skill_doc.test.ts` 에 정리 명령 문장이 있는지 확인을 더한다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "RUN_DIR>\`을 삭제한다|불필요한 임시 파일을 정리한다" -- career-os/.claude
```

기대값: 모두 종료 코드 0.

## 마무리

검증이 통과하면 `career-os/tasks/plan133-cron-robustness/index.json` 의 이 phase 를 완료로 표시하고 `status` 를 `completed` 로 바꾼다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/position_run.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/study-topic-recommender/references/execution.md` | 수정 |
| 위 테스트 파일 넷 | 수정 |
