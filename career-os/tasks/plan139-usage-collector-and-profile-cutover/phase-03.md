# Phase 03. launchd 작업 틀과 설치, 제거, 상태 확인 명령을 만든다

**Execution profile**: standard

## 목표

수집기를 매일 한 번 돌리는 `launchd` 작업의 plist 틀과, 그것을 설치하고 제거하고 상태를 보는 `manage_launchd.ts` 를 만든다.
사람이 매달 기억해 실행하지 않아도 수집기가 돌게 하려는 것이다.

**범위 외**: 실제 기기에 등록하는 일은 이 phase 가 하지 않는다. `remote-verification.md` 의 항목이다. 수집기의 동작은 Phase 02 다.

## 컨텍스트

- 이 저장소에는 `launchd` 나 plist 의 선례가 없다. `git grep -n "launchd\|plist\|LaunchAgents"` 결과가 문서의 설명뿐이다. 홈서버의 예약 실행은 홈서버 인프라 저장소가 갖고 이 작업과 무관하다
- 수집기 실행 명령은 `bun --env-file=<저장소>/career-os/.env <저장소>/career-os/scripts/agent-usage/collect_usage.ts` 다. 연결값은 `.env` 에서만 읽는다. `--env-file` 을 쓰는 선례는 `career-os/.claude/skills/study-topic-recommender/references/execution.md` 다
- `launchd` 는 로그인 셸의 PATH 를 주지 않는다. `bun` 은 절대 경로로 적고, 수집기가 `python3` 을 찾도록 plist 에 PATH 를 적는다
- 수집기의 표준 출력은 달과 결과 코드뿐이라 로그 파일에 그대로 쌓아도 된다
- XML 을 읽는 `fast-xml-parser` 가 저장소 루트 `package.json` 의 의존성이다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「sync-profile」 절, `career-os/docs/flow.md` 의 「사용량 수집」 절

## 의도 메모

- **plist 에 token 과 Backend 주소를 적지 않는다.** plist 는 홈 디렉터리에 평문으로 남는다
- 홈 디렉터리와 저장소의 절대 경로를 틀에 적지 않는다. 설치할 때 자리표시자를 채운다. 공개 저장소에 환경 종속 경로를 두지 않는다
- 테스트는 `launchctl` 을 실행하지 않고 `~/Library/LaunchAgents/` 에 쓰지 않는다. 명령 실행기와 홈 디렉터리를 주입한다
- `RunAtLoad` 를 켜지 않는다. 설치하자마자 측정이 도는 것을 막는다. 처음 한 번은 사람이 수집기를 직접 실행한다
- 실행 시각은 10시다. 수집기가 UTC 로 달이 끝났는지 보므로, `Asia/Seoul` 9시 뒤에 돌아야 1일에 지난달이 대상이 된다. 기기가 잠들어 있었으면 `launchd` 가 깨어난 뒤에 돌린다

## Blocked 조건

- `career-os/scripts/agent-usage/collect_usage.ts` 가 없으면 `PHASE_BLOCKED: Phase 02 미완료` 를 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/agent-usage/launchd/agent-usage.plist.template` 신규

자리표시자는 `{{BUN_PATH}}`, `{{REPO_ROOT}}`, `{{LOG_DIR}}` 셋뿐이다.

| 키 | 값 |
| --- | --- |
| `Label` | `com.fos-agents.career-os.agent-usage` |
| `ProgramArguments` | `{{BUN_PATH}}`, `--env-file={{REPO_ROOT}}/career-os/.env`, `{{REPO_ROOT}}/career-os/scripts/agent-usage/collect_usage.ts` |
| `WorkingDirectory` | `{{REPO_ROOT}}` |
| `StartCalendarInterval` | `Hour` 10, `Minute` 0 |
| `EnvironmentVariables` | `PATH` 하나다. `/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin` |
| `StandardOutPath`, `StandardErrorPath` | `{{LOG_DIR}}/agent-usage.log` |
| `RunAtLoad` | `false` |

### 2. `career-os/scripts/agent-usage/manage_launchd.ts` 신규

```ts
export const LAUNCHD_LABEL = "com.fos-agents.career-os.agent-usage";
export function renderPlist(template: string, values: { bunPath: string; repoRoot: string; logDir: string }): string;
export type LaunchdDeps = {
  home: string;                    // 기본값 os.homedir()
  uid: number;                     // 기본값 process.getuid()
  repoRoot: string;                // 기본값 resolve(import.meta.dir, "../../..")
  bunPath: string;                 // 기본값 process.execPath
  run: (command: string, args: string[]) => { status: number; stdout: string };
  write: (line: string) => void;
};
export function manageLaunchd(args: string[], deps: LaunchdDeps): number;   // 종료 코드
```

- `renderPlist` 는 세 자리표시자를 모두 바꾼다. 값은 XML 로 이스케이프한다(`&`, `<`, `>`). 바꾼 뒤에 `{{` 가 남으면 던진다. 값이 절대 경로가 아니면 던진다
- plist 경로는 `<home>/Library/LaunchAgents/com.fos-agents.career-os.agent-usage.plist`, 로그 디렉터리는 `<home>/Library/Logs/fos-career-os` 다

| 명령 | 동작 |
| --- | --- |
| `install` | `--dry-run` 이 아니고 `<repoRoot>/career-os/.env` 가 없으면 「`career-os/.env` 가 없다」 를 내고 1 로 끝낸다. 있으면 로그 디렉터리를 만들고 plist 를 쓴 뒤 `launchctl bootout gui/<uid>/<label>` 을 실행하고(실패를 무시한다. 등록돼 있지 않으면 실패한다) `launchctl bootstrap gui/<uid> <plist 경로>` 를 실행한다. `bootstrap` 의 status 가 0 이 아니면 1 로 끝낸다 |
| `uninstall` | `launchctl bootout gui/<uid>/<label>` 을 실행하고(실패를 무시한다) plist 파일을 지운다. 파일이 없어도 0 이다. 로그는 지우지 않는다 |
| `status` | `launchctl print gui/<uid>/<label>` 의 status 가 0 이면 `LOADED`, 아니면 `NOT_LOADED` 를 낸다. plist 파일이 있는지를 `PLIST_PRESENT` 나 `PLIST_MISSING` 으로 한 줄 더 낸다. 로그 파일이 있으면 마지막 다섯 줄을 낸다. 언제나 0 이다 |
| `help`, `--help`, `-h` | 사용법을 내고 0 이다 |

- `install --dry-run` 과 `uninstall --dry-run` 은 **파일을 쓰거나 지우지 않고 `run` 을 부르지 않는다.** `install --dry-run` 은 `career-os/.env` 가 있는지 보지 않는다. 저장소를 막 받은 기기에서도 렌더 결과를 볼 수 있게 하려는 것이다. 쓸(지울) 파일 경로와 실행할 명령을 한 줄씩 내고, `install` 은 렌더한 plist 본문도 낸다
- 모르는 명령은 사용법을 표준 오류에 내고 2 로 끝낸다. 종료 코드 규칙은 `career-os/scripts/lib/cli.ts` 의 머리 주석과 같다
- `import.meta.main` 일 때 기본 `deps` 로 `manageLaunchd(process.argv.slice(2), ...)` 를 부르고 그 값으로 끝낸다. 기본 `run` 은 `Bun.spawnSync` 다

### 3. 이 phase 를 검증하는 테스트

`career-os/scripts/agent-usage/manage_launchd.test.ts` 신규. **`launchctl` 을 실행하지 않고 실제 홈 디렉터리에 쓰지 않는다.** `home` 과 `repoRoot` 는 `mkdtempSync` 로 만든 임시 디렉터리이고 `run` 은 받은 명령을 배열에 모으는 대역이다.

틀의 내용 검사다. 틀 파일을 읽어 지어낸 값(`/opt/example/bin/bun`, `/opt/example/repo`, `/opt/example/logs`)으로 렌더한 뒤 `fast-xml-parser` 로 파싱한다.

- 렌더한 문자열에 `{{` 가 없다
- 렌더한 문자열과 틀 원문 어디에도 `CAREER_BACKEND` 와 `TOKEN` 이 없다
- `<!DOCTYPE` 으로 시작하는 줄을 뺀 나머지에 `http` 가 없다. plist 의 DOCTYPE 이 Apple 의 DTD 주소를 담으므로 그 한 줄만 허용한다
- 틀 원문에 `/Users/` 가 없다
- `Label` 이 `LAUNCHD_LABEL` 과 같다
- `ProgramArguments` 가 순서대로 `/opt/example/bin/bun`, `--env-file=/opt/example/repo/career-os/.env`, `/opt/example/repo/career-os/scripts/agent-usage/collect_usage.ts` 다
- `StartCalendarInterval` 의 `Hour` 가 10, `Minute` 가 0 이다
- 자리표시자 값에 `&` 가 든 경로를 넣어도 파싱에 성공한다
- 상대 경로를 넣으면 `renderPlist` 가 던진다

설치 스크립트의 dry-run 검사다.

- `install --dry-run`: 임시 `repoRoot` 에 `career-os/.env` 를 만들지 않고 실행한다. 종료 코드 0, `run` 대역이 0 번 불리고, 임시 `home` 아래에 `Library` 디렉터리가 생기지 않는다. 출력에 plist 경로와 `launchctl bootstrap gui/<uid>` 가 있다
- `uninstall --dry-run`: 미리 써 둔 plist 파일이 그대로 남고 `run` 대역이 0 번 불린다

실제 동작 검사다. 임시 디렉터리 안에서만 쓴다.

- `install`: 임시 `repoRoot` 에 `career-os/.env` 를 빈 파일로 만들고 실행하면 plist 파일이 생기고, `run` 대역이 받은 명령이 순서대로 `launchctl bootout ...`, `launchctl bootstrap gui/<uid> <plist 경로>` 다
- `install` 실패: `career-os/.env` 가 없으면 1 이고 plist 파일이 생기지 않고 `run` 대역이 0 번 불린다
- `uninstall`: plist 파일이 지워진다. 파일이 없을 때 다시 실행해도 0 이다
- `status`: `run` 대역이 status 0 을 주면 `LOADED`, 1 을 주면 `NOT_LOADED` 다
- 모르는 명령은 2 다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/agent-usage/measure.test.ts career-os/scripts/agent-usage/agent_usage_script.test.ts career-os/scripts/agent-usage/collect_usage.test.ts career-os/scripts/agent-usage/manage_launchd.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
PATH="$HOME/.bun/bin:$PATH" bun career-os/scripts/agent-usage/manage_launchd.ts install --dry-run
! grep -rnE "CAREER_BACKEND|/Users/" career-os/scripts/agent-usage/launchd
```

모두 종료 코드 0 이어야 한다. 환경값은 필요 없다. `install --dry-run` 은 `.env` 검사를 건너뛰므로 `career-os/.env` 가 없어도 0 으로 끝나고, 실행 뒤 `~/Library/LaunchAgents/com.fos-agents.career-os.agent-usage.plist` 가 생기지 않아야 한다. `python3` 이 PATH 에 있어야 한다(같은 디렉터리의 Phase 01 테스트가 쓴다).

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/agent-usage/launchd/agent-usage.plist.template` | 신규 |
| `career-os/scripts/agent-usage/manage_launchd.ts` | 신규 |
| `career-os/scripts/agent-usage/manage_launchd.test.ts` | 신규 |
