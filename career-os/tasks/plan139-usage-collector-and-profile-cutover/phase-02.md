# Phase 02. 기록이 없는 끝난 달만 측정해 올리는 수집기를 만든다

**Execution profile**: standard

## 목표

`career-os/scripts/agent-usage/collect_usage.ts` 를 만든다. Backend 의 사용량 기록을 읽어 기록이 없는 끝난 달만 측정해 올린다.
세션 기록은 시간이 지나면 기기에서 지워지므로, 사람이 기억하지 않아도 달이 끝난 직후의 값이 남아야 한다.

**범위 외**: `launchd` 등록은 Phase 03 이다. 기존 파일의 값을 옮기는 것은 Phase 04 다. Backend 와 `career-os/scripts/profile/` 의 코드는 고치지 않는다.

## 컨텍스트

- Backend 의 계약이다. 기본 경로는 `/api/profile/v1` 이다
  - `GET /api/profile/v1/usage-snapshots` 는 `{ snapshots: [...] }` 를 달 오름차순으로 준다
  - `PUT /api/profile/v1/usage-snapshots/:month` 는 `{ snapshot, created }` 를 준다. 기록이 없으면 만들고 `created: true` 다. 기록이 있고 요청에 `replace` 가 없으면 **값을 바꾸지 않고** `created: false` 로 기존 값을 준다. 오류가 아니다
  - 아직 끝나지 않은 달과 미래의 달은 400 이다. 기준 시각대는 `Asia/Seoul` 이다
- client 와 zod 계약은 `career-os/scripts/profile/` 에 있다. **요청 칸의 실제 이름과 client 의 메서드 이름은 그 디렉터리의 계약 파일과 client 파일을 열어 읽고 쓴다.** 이 문서는 칸을 저장 표의 이름(`claude_tokens`, `measured_on` 처럼)으로 부른다. 코드의 이름이 이 문서와 다르면 코드가 맞다
- 연결값은 `career-os/scripts/lib/career-backend-config.ts` 의 `resolveCareerBackendConnection(process.env)` 가 `CAREER_BACKEND_URL` 과 `CAREER_BACKEND_TOKEN`(또는 `CAREER_BACKEND_TOKEN_FILE`)에서 읽는다. 수집기가 `.env` 를 직접 읽지 않는다. 실행하는 쪽이 `bun --env-file=career-os/.env` 로 넘긴다
- HTTP 오류는 `career-os/scripts/lib/career-backend-http.ts` 의 `CareerBackendHttpError` 다. `status` 가 `null` 이면 닿지 못한 것이다. 오류를 한 줄로 만드는 본보기는 `career-os/scripts/candidate-context/manage_candidate_context.ts` 의 `formatManageCandidateContextError` 다. 상태, code, requestId 만 담는다
- 측정은 Phase 01 의 `career-os/scripts/agent-usage/measure.ts` 가 한다. `measureUsage()` 가 `MonthlyMeasurement[]`(`month` 는 `YYYY-MM`)를 준다

**근거 문서**: `career-os/docs/flow.md` 의 「사용량 수집」 절, `career-os/docs/data-schema.md` 의 「수집기가 올리는 사용량 기록」 절, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- **`replace` 를 보내지 않는다.** 이미 기록된 달을 수집기가 바꾸면 세션 기록이 지워진 뒤의 작은 값으로 덮어쓴다
- 달이 끝났는지를 UTC 로 판정한다. 측정 스크립트가 UTC 로 달을 나누기 때문이다. `Asia/Seoul` 로 판정하면 1일 0시부터 9시 사이의 사용이 지난달로 세어지는데 그 전에 측정하게 된다
- 기록이 있을 때 가장 오래된 기록보다 앞의 달을 올리지 않는다. 그 달은 세션 기록이 일부만 남아 실제보다 작은 값이 측정값으로 남는다
- 측정을 먼저 하지 않는다. 세션 기록 전체를 읽는 일이라 대상 달이 없는 날에는 하지 않는다
- 표준 출력에 토큰 수와 비용을 내지 않는다. `launchd` 가 이 출력을 로그 파일에 쌓는다
- 테스트가 plan 밖 코드의 이름에 묶이지 않게, 수집기는 자기가 쓰는 만큼의 저장소 인터페이스를 직접 정의하고 실제 client 는 `main` 에서만 잇는다

## Blocked 조건

- `career-os/scripts/profile/manage_profile.ts` 가 없으면 `PHASE_BLOCKED: 프로필 client 가 머지되기 전` 을 출력하고 종료한다
- `career-os/scripts/agent-usage/measure.ts` 가 없으면 `PHASE_BLOCKED: Phase 01 미완료` 를 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/agent-usage/collect_usage.ts` 신규

```ts
import type { MonthlyMeasurement } from "./measure.ts";

/** 수집기가 쓰는 만큼의 기록 저장소. 테스트는 대역을, main 은 Backend client 를 넣는다. */
export type UsageSnapshotStore = {
  listMonths(): Promise<string[]>;                                   // YYYY-MM
  putMeasured(measurement: MonthlyMeasurement, measuredOn: string): Promise<{ created: boolean }>;
};
export type CollectResult = { month: string; code: "CREATED" | "EXISTS" | "NO_SESSIONS" | "UP_TO_DATE" | "FAILED" };

export function endedMonths(now: Date): string[];                    // 내부에서 쓰는 보조 함수여도 된다
export function targetMonths(recorded: readonly string[], now: Date): string[];
export async function collectUsage(deps: {
  store: UsageSnapshotStore;
  measure: () => Promise<MonthlyMeasurement[]>;
  now: Date;
  write: (line: string) => void;
}): Promise<{ results: CollectResult[]; exitCode: 0 | 1 }>;
```

`targetMonths` 의 규칙이다.

- 「가장 최근에 끝난 달」 은 `now` 의 UTC 연월보다 한 달 앞의 달이다. `now` 가 UTC `2026-03-01T00:00:00Z` 면 `2026-02` 다
- `recorded` 가 비어 있으면 가장 최근에 끝난 달 하나를 돌려준다
- 비어 있지 않으면, `recorded` 의 가장 이른 달보다 뒤이고 가장 최근에 끝난 달 이하인 달 가운데 `recorded` 에 없는 달을 오름차순으로 돌려준다

`collectUsage` 의 순서다.

1. `store.listMonths()` 를 부른다. 던지면 `measure` 를 부르지 않고 그대로 던진다
2. `targetMonths` 가 비면 `- UP_TO_DATE` 한 줄을 쓰고 `exitCode` 0 으로 끝낸다. `measure` 를 부르지 않는다
3. `measure()` 를 한 번 부른다. 던지면 그대로 던진다
4. 대상 달마다 오름차순으로 처리한다
   - 측정 결과에 그 달이 없거나 `claudeTokens + codexTokens` 가 0 이면 `NO_SESSIONS` 다. `putMeasured` 를 부르지 않는다
   - 있으면 `store.putMeasured(measurement, measuredOn)` 을 부른다. `created` 가 참이면 `CREATED`, 거짓이면 `EXISTS` 다
   - `putMeasured` 가 던지면 그 달은 `FAILED` 이고 남은 달을 마저 처리한다. `exitCode` 는 1 이다
5. 달마다 `<YYYY-MM> <코드>` 한 줄을 `write` 로 쓴다

`measuredOn` 은 `now` 의 `Asia/Seoul` 날짜(`YYYY-MM-DD`)다. `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now)` 로 만든다.

`main` 이다. `import.meta.main` 일 때만 돈다.

- `career-os/scripts/profile/` 의 client 를 만들어 `UsageSnapshotStore` 로 잇는다. `listMonths` 는 기록 목록에서 달만 뽑는다. `putMeasured` 는 `data-schema.md` 의 대응 표대로 요청을 만들고 `source` 를 `MEASURED` 로 둔다. **`replace` 와 `note` 를 넣지 않는다**
- `collectUsage` 가 던지면 표준 오류에 오류 한 줄(상태, code, requestId)을 쓰고 종료 코드 1 로 끝낸다. 연결값이 없어 `resolveCareerBackendConnection` 이 던지는 경우도 같다
- 던지지 않으면 `exitCode` 로 끝낸다
- 인자는 받지 않는다. `help`, `--help`, `-h` 만 사용법을 내고 연결값 없이 종료 코드 0 으로 끝낸다

### 2. 이 phase 를 검증하는 테스트

`career-os/scripts/agent-usage/collect_usage.test.ts` 신규. **실제 세션 기록과 실제 Backend 를 쓰지 않는다.** 대역을 둘 넣는다.

- 측정 대역: `measure: async () => [...]` 로 지어낸 `MonthlyMeasurement` 를 준다. 부른 횟수를 센다
- 저장소 대역: `listMonths` 가 배열을 주고 `putMeasured` 가 받은 인자를 배열에 모으는 객체다

`targetMonths` 를 표 기반으로 확인한다. `now` 는 모두 `new Date("...Z")` 로 고정한다.

| `recorded` | `now` (UTC) | 기대값 |
| --- | --- | --- |
| `[]` | `2026-03-15T00:00:00Z` | `["2026-02"]` |
| `["2025-12", "2026-01", "2026-02"]` | `2026-03-15T00:00:00Z` | `[]` |
| `["2025-11", "2026-01"]` | `2026-03-15T00:00:00Z` | `["2025-12", "2026-02"]` |
| `["2026-02"]` | `2026-03-15T00:00:00Z` | `[]`. `2026-01` 은 가장 이른 기록보다 앞이라 대상이 아니다 |
| `["2026-01"]` | `2026-02-28T16:00:00Z` | `[]`. `Asia/Seoul` 로는 3월 1일이지만 UTC 로 2월이 끝나지 않았다 |
| `["2026-01"]` | `2026-01-05T00:00:00Z` | `[]`. 연도를 넘는 달 계산에서 음수 달이 나오지 않는다 |

`collectUsage` 를 확인한다.

- 정상: `recorded` 가 `["2026-01"]`, `now` 가 `2026-03-15T00:00:00Z`, 측정이 `2026-02` 를 담으면 `putMeasured` 가 한 번 불리고 인자의 달이 `2026-02`, `measuredOn` 이 `2026-03-15` 이며 출력이 `2026-02 CREATED` 한 줄이다
- 이미 기록됨: 저장소 대역이 `{ created: false }` 를 주면 출력이 `2026-02 EXISTS` 이고 `exitCode` 가 0 이다. 같은 달을 다시 올려도 값이 바뀌지 않는다는 성공 기준을 수집기 쪽에서 관측한다
- 대상 없음: `recorded` 가 가장 최근에 끝난 달까지 담으면 측정 대역이 0 번 불리고 출력이 `- UP_TO_DATE` 다
- 세션 없음: 측정 결과에 대상 달이 없으면 `NO_SESSIONS` 이고 `putMeasured` 가 불리지 않는다
- Backend 에 닿지 못함: `listMonths` 가 `new CareerBackendHttpError(null, "NETWORK_ERROR", "...")` 를 던지면 `collectUsage` 가 던지고 측정 대역이 0 번 불린다
- 한 달만 실패: 대상이 두 달이고 첫 달의 `putMeasured` 가 던지면 출력이 `FAILED` 와 `CREATED` 두 줄이고 `exitCode` 가 1 이다
- 출력 검사: 모든 경우에 `write` 로 나간 줄이 `/^(\d{4}-\d{2}|-) [A-Z_]+$/` 에 맞는다. 측정 대역에 넣은 토큰 수가 출력에 없다

요청 본문에 `replace` 가 없다는 것은 HTTP 대역으로 확인한다. `career-os/scripts/profile/` 의 client 에 fetch 대역을 넣어 `main` 이 쓰는 것과 같은 연결 함수를 부르고, 대역이 받은 `PUT` 요청의 `JSON.parse(init.body)` 에 `replace` 키가 없고 `source` 가 `MEASURED` 인지 확인한다. fetch 대역을 넣는 방법은 `career-os/scripts/candidate-context/client.test.ts` 가 본보기다. 이를 위해 client 를 `UsageSnapshotStore` 로 잇는 함수를 `main` 안에 두지 말고 `export function createUsageSnapshotStore(client)` 로 내보낸다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/agent-usage/measure.test.ts career-os/scripts/agent-usage/agent_usage_script.test.ts career-os/scripts/agent-usage/collect_usage.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
PATH="$HOME/.bun/bin:$PATH" bun career-os/scripts/agent-usage/collect_usage.ts --help
! git grep -n "replace" -- career-os/scripts/agent-usage/collect_usage.ts
```

모두 종료 코드 0 이어야 한다. 환경값은 필요 없다. `--help` 는 연결값 없이 돈다. `python3` 이 PATH 에 있어야 한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/agent-usage/collect_usage.ts` | 신규 |
| `career-os/scripts/agent-usage/collect_usage.test.ts` | 신규 |
