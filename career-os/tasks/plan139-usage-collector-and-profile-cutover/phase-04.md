# Phase 04. library/profiles 의 원고와 사용량 표를 Backend 로 옮기는 일회성 명령을 만든다

**Execution profile**: deep

## 목표

비공개 작업본의 `library/profiles/` 에 있는 원고 셋과 사용량 표를 Backend 로 옮기는 명령 `migrate_library_profiles.ts` 를 만든다.
스킬이 Backend 에서 원고를 읽기 시작하기 전에 지금의 원고와 기록이 그곳에 있어야 한다.

**범위 외**: 명령을 실제 파일과 실제 Backend 로 실행하는 일은 이 phase 가 하지 않는다. `remote-verification.md` 의 항목이다. `library/profiles/` 의 파일을 지우지 않는다. 차트 이미지(`github-agent-usage.svg`)는 옮기지 않는다. 기록에서 그때마다 그린다.

## 컨텍스트

- 옮길 파일이다. 디렉터리는 비공개 작업본에 있고 git 이 추적하지 않는다(`.gitignore` 의 `career-os/library/`)

| 파일 | 옮길 곳 |
| --- | --- |
| `wanted-profile.md` | 프로필 원고 문서 `wanted` |
| `linkedin-profile.md` | 프로필 원고 문서 `linkedin` |
| `github-profile.md` | 프로필 원고 문서 `github` |
| `github-agent-usage-snapshots.md` | 사용량 기록. 표의 한 줄이 한 달이다 |

- 사용량 표의 모양이다. 값은 지어낸 것이다. **실제 값을 이 문서와 테스트에 옮겨 적지 않는다.** 명령이 파일에서 읽는다

```markdown
| 월 | Claude Code | Codex | 합계 | 측정한 날 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 2025.01 | 0.4B | 2.1B | 2.5B | 2025-03-02 | 지어낸 비고 |
| 2025.02 | 3.0B | 1B | 4.0B | 2025-03-02 | 한 달 전체 |
```

- 토큰은 십억 단위다. 표에는 환산 비용과 세션 수의 칸이 없다. 그 파일의 표 밖 산문은 읽지 않는다
- Backend 의 계약이다
  - `GET /api/profile/v1/documents/:documentKey` 는 문서가 없으면 404 다
  - `PUT /api/profile/v1/documents/:documentKey` 의 요청은 `{ body, note, expectedVersion }` 다. 새 문서는 `expectedVersion: 0` 이다. 후보자 맥락 문서와 같은 규칙이다(본문은 비어 있지 않고 UTF-8 64 KiB 이하, `note` 는 1자 이상 500자 이하. `career-os/scripts/candidate-context/contracts.ts` 참고)
  - `PUT /api/profile/v1/usage-snapshots/:month` 는 `{ snapshot, created }` 를 준다. 기록이 있고 `replace` 가 없으면 값을 바꾸지 않고 `created: false` 다
- client 와 zod 계약은 `career-os/scripts/profile/client.ts` 와 `career-os/scripts/profile/contracts.ts` 에 있다. 이 phase 가 쓰는 client 의 표면은 아래와 같다
  - `createProfileClient()` 가 `ProfileClient` 를 만든다. 연결값은 환경값에서 읽는다
  - `ProfileClient.getDocument(key)` 는 문서를 돌려준다. 문서가 없으면 `status` 가 404 인 `CareerBackendHttpError` 를 던진다
  - `ProfileClient.putDocument(key, { body, note, expectedVersion })` 가 원고를 저장한다
  - `ProfileClient.listUsageSnapshots()` 는 `UsageSnapshot[]` 를 돌려준다. 원소의 `month` 가 `YYYY-MM` 이다
  - `ProfileClient.putUsageSnapshot(month, payload)` 는 `{ snapshot, created }` 를 돌려준다. `payload` 의 칸은 `claudeTokens`, `codexTokens`, `claudeCostUsd`, `codexCostUsd`, `sessions`, `unpricedTokens`, `measuredOn`, `source`, `note`, `replace` 다
  - `payload` 의 `note` 는 `z.string().trim().min(1).max(500).optional()` 이다. 빈 문자열을 보내면 계약 검사에서 던진다
  - 이 문서는 칸을 저장 표의 이름으로 부르기도 한다. 코드의 이름이 이 문서와 다르면 코드가 맞다
- **같은 값의 사용량 `PUT` 을 다시 보내면 `EXISTS` 가 아니라 처음 응답이 돌아온다.** `putUsageSnapshot` 은 `replace` 가 없으면 달과 요청 본문으로 멱등 키를 만든다(`client.ts` 의 `hashKey("profile-usage", ...)`). 같은 표로 다시 실행하면 키가 같아 Backend 가 처음 응답 `created: true` 를 그대로 재생한다
- CLI 의 모양은 같은 디렉터리의 `manage_profile.ts` 를 본보기로 삼는다. 인자 읽기는 `career-os/scripts/lib/cli.ts` 의 `firstOptionValue` 를 쓴다

**근거 문서**: `career-os/docs/data-schema.md` 의 「수집기가 올리는 사용량 기록」 절(옮긴 달의 값 표), `career-os/docs/code-architecture.md` 의 「sync-profile」 절, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- **여러 번 실행해도 안전해야 한다.** 이미 있는 원고와 이미 기록된 달은 건드리지 않는다. `replace` 를 보내지 않고, 원고가 이미 있거나 달이 이미 기록돼 있으면 `PUT` 을 보내지 않는다
- 이미 기록된 달은 `listMonths` 로 먼저 걸러 낸다. 응답의 `created` 에 기대면 위 멱등 키 재생 때문에 다시 실행한 결과가 `CREATED` 로 나온다. 원고의 `documentExists` 와 같은 방식이다
- 파일을 모두 읽고 파싱한 뒤에 첫 요청을 보낸다. 표의 한 줄이 잘못됐는데 앞 줄만 올라간 상태를 만들지 않는다
- 표준 출력과 오류 문구에 원고 본문과 토큰 값을 내지 않는다. 키, 달, 결과 코드, 줄 번호만 낸다
- 어느 달이 한 달 전체를 측정한 값인지는 표에서 기계로 읽을 수 없다. 「비고」 는 사람이 쓴 문장이다. 그래서 명령 인자로 받고, 주지 않은 달은 `BACKFILLED` 다
- **이 명령은 일회성이다.** 실제 이전을 확인한 뒤 `library/profiles/` 의 파일과 이 명령을 지운다. 지우는 일은 이 phase 가 아니라 `remote-verification.md` 의 마지막 두 항목이다. 다시 돌 일이 없는 코드라 범용으로 만들지 않는다
- 환산 비용과 세션 수를 인자로 받지 않는다. 그 값을 옮기려면 달별로, Claude 와 Codex 로 나뉜 측정값이 있어야 하는데 파일에 없다

## Blocked 조건

- `career-os/scripts/profile/manage_profile.ts` 가 없으면 `PHASE_BLOCKED: 프로필 client 가 머지되기 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/profile/migrate_library_profiles.ts` 신규

```ts
export type BackfillRow = {
  month: string;         // YYYY-MM
  claudeTokens: number;  // 정수
  codexTokens: number;
  measuredOn: string;    // YYYY-MM-DD
  note: string;          // 「비고」 칸. 비어 있으면 빈 문자열이다
};
export function parseUsageTable(markdown: string): BackfillRow[];

/** 이 명령이 쓰는 만큼의 저장소. 테스트는 대역을, main 은 Backend client 를 넣는다. */
export type ProfileMigrationStore = {
  listMonths(): Promise<string[]>;                                               // 기록된 달, YYYY-MM
  documentExists(key: "wanted" | "linkedin" | "github"): Promise<boolean>;     // 404 면 false
  createDocument(key: "wanted" | "linkedin" | "github", body: string, note: string): Promise<void>;   // expectedVersion 0
  putBackfilled(row: BackfillRow, source: "MEASURED" | "BACKFILLED"): Promise<{ created: boolean }>;
};
export async function migrateLibraryProfiles(deps: {
  profilesDir: string;
  measuredMonths: readonly string[];
  dryRun: boolean;
  store: ProfileMigrationStore;
  readFile: (path: string) => string | null;   // 없으면 null
  write: (line: string) => void;
}): Promise<{ exitCode: 0 | 1 }>;
```

`parseUsageTable` 의 규칙이다.

- 머리 줄을 찾는다. `|` 로 나눈 칸에 `월`, `Claude Code`, `Codex`, `측정한 날`, `비고` 가 모두 있는 줄이다. 칸의 자리는 머리 줄의 이름으로 정한다. 순서를 가정하지 않는다. 머리 줄이 없으면 던진다
- 머리 줄 아래에서 첫 칸이 `/^\d{4}\.\d{2}$/` 인 줄이 자료 줄이다. 구분 줄(`| --- |`)은 건너뛴다. 표가 끝나면(`|` 로 시작하지 않는 줄) 멈춘다
- 토큰 칸은 `/^\d+(\.\d+)?B$/` 다. 정수로 바꿀 때 부동소수 곱셈을 쓰지 않는다. 소수점 아래를 아홉 자리까지 0 으로 채워 정수 문자열로 만든다. `0.4B` 는 `400000000`, `1B` 는 `1000000000` 이다
- `측정한 날` 은 `/^\d{4}-\d{2}-\d{2}$/` 다
- `비고` 는 앞뒤 공백을 지운 문자열이다. 빈 칸을 허용한다
- 달은 점을 `-` 로 바꾼다. 같은 달이 두 줄이면 던진다
- 맞지 않는 칸이 있으면 `Error("사용량 표의 <줄 번호>번째 줄을 읽지 못했다.")` 를 던진다. 칸의 값을 문구에 넣지 않는다
- 자료 줄이 하나도 없으면 던진다

`migrateLibraryProfiles` 의 순서다.

1. 원고 파일 셋과 `github-agent-usage-snapshots.md` 를 읽고 표를 파싱한다. `measuredMonths` 에 표에 없는 달이 있으면 던진다. `github-agent-usage-snapshots.md` 를 읽지 못하면(`readFile` 이 `null`) 그 경로를 담아 던진다. 여기까지 요청을 보내지 않는다
2. 원고를 `wanted`, `linkedin`, `github` 순서로 처리한다

| 조건 | 출력 | 요청 |
| --- | --- | --- |
| 파일이 없다 | `document <key> MISSING_FILE` | 없음 |
| `dryRun` 이다 | `document <key> WOULD_CREATE` | 없음 |
| `documentExists` 가 참이다 | `document <key> EXISTS` | `PUT` 을 보내지 않는다 |
| 그 밖 | `document <key> CREATED` | `createDocument(key, body, "library/profiles 의 원고를 옮긴다")` |

3. `dryRun` 이 아니면 `store.listMonths()` 를 한 번 부른다. 던지면 그대로 던진다. 그 뒤 표의 달을 오름차순으로 처리한다. `source` 는 `measuredMonths` 에 든 달이면 `MEASURED`, 아니면 `BACKFILLED` 다

| 조건 | 출력 | 요청 |
| --- | --- | --- |
| `dryRun` 이다 | `usage <YYYY-MM> WOULD_CREATE <source>` | 없음 |
| 그 달이 `listMonths` 의 결과에 있다 | `usage <YYYY-MM> EXISTS` | `PUT` 을 보내지 않는다 |
| 응답의 `created` 가 참이다 | `usage <YYYY-MM> CREATED <source>` | `putBackfilled(row, source)` |
| 응답의 `created` 가 거짓이다 | `usage <YYYY-MM> EXISTS` | 같다. 목록을 읽은 뒤 다른 곳에서 먼저 기록한 경우다. 값은 바뀌지 않았다 |

4. `createDocument` 나 `putBackfilled` 가 던지면 그 줄을 `... FAILED` 로 내고 남은 것을 마저 처리한 뒤 `exitCode` 1 로 끝낸다. `MISSING_FILE` 이 하나라도 있어도 1 이다

`main` 이다. `import.meta.main` 일 때만 돈다.

```bash
bun --env-file=career-os/.env career-os/scripts/profile/migrate_library_profiles.ts \
  --profiles-dir <library/profiles 의 경로> [--measured <YYYY-MM>]... [--dry-run]
```

- `--profiles-dir` 은 필수다. 기본값을 두지 않는다. 비공개 작업본의 위치는 기기마다 다르다
- `--measured` 는 여러 번 줄 수 있다. `firstOptionValue` 는 첫 값만 주므로 `args` 를 직접 돌며 모은다. `/^\d{4}-\d{2}$/` 가 아니면 사용법 오류다
- `--dry-run` 이면 Backend client 를 만들지 않는다. 연결값 없이 돈다
- client 를 `ProfileMigrationStore` 로 잇는 함수 `createProfileMigrationStore(client)` 의 메서드는 아래와 같다
  - `listMonths` 는 `listUsageSnapshots()` 의 결과에서 `month` 만 뽑는다
  - `documentExists` 는 `getDocument(key)` 가 돌려주면 `true` 다. `CareerBackendHttpError` 이고 `status` 가 404 면 `false` 를 주고, 다른 오류는 그대로 던진다
  - `createDocument` 는 `putDocument(key, { body, note, expectedVersion: 0 })` 를 부른다
  - `putBackfilled` 는 `data-schema.md` 의 「옮긴 달의 값」 표대로 `payload` 를 만들어 `putUsageSnapshot(row.month, payload)` 를 부른다. 환산 비용 둘과 세션 수를 비우고 `unpricedTokens` 를 0 으로 둔다. `note` 는 표의 「비고」 이고, **비고가 비면 `note` 칸을 빼고 보낸다.** 계약의 `note` 는 1자 이상이라 빈 문자열을 넣으면 요청 전에 던진다. **`replace` 를 넣지 않는다**
- 던진 오류는 표준 오류에 `formatManageProfileError(error)`(`career-os/scripts/profile/manage_profile.ts`) 한 줄로 내고 종료 코드 1 로 끝낸다. 인자 오류는 2 다
- `help`, `--help`, `-h` 는 사용법을 내고 0 이다

### 2. 이 phase 를 검증하는 테스트

`career-os/scripts/profile/migrate_library_profiles.test.ts` 신규. **실제 `library/profiles/` 와 실제 Backend 를 쓰지 않는다.** `readFile` 은 경로를 받아 지어낸 문자열을 주는 대역이고, `store` 는 받은 인자를 배열에 모으는 대역이다.

`parseUsageTable` 이다.

- 위 「컨텍스트」 의 지어낸 표를 넣으면 두 줄이 나오고, `2025-01` 의 `claudeTokens` 가 `400000000`, `codexTokens` 가 `2100000000` 이며 `2025-02` 의 `codexTokens` 가 `1000000000` 이다
- 칸의 순서를 바꾼 표(`측정한 날` 이 둘째 칸)에서도 같은 값이 나온다
- 표 아래에 산문이 이어져도 자료 줄만 읽는다
- 토큰 칸이 `1.3` 처럼 `B` 가 없으면 던지고, 오류 문구에 줄 번호가 있고 `1.3` 이 없다
- 머리 줄이 없으면, 같은 달이 두 줄이면 던진다

`migrateLibraryProfiles` 다.

- 정상: 파일 넷이 모두 있고 저장소가 비어 있으면 `createDocument` 가 세 번, `putBackfilled` 가 두 번 불린다. `measuredMonths` 가 `["2025-02"]` 면 `2025-01` 의 `source` 가 `BACKFILLED`, `2025-02` 가 `MEASURED` 다. 출력 다섯 줄이 모두 `CREATED` 다
- 정상 경우의 `listMonths` 는 빈 배열을 준다
- 다시 실행: `documentExists` 가 참이고 `listMonths` 가 `["2025-01", "2025-02"]` 를 주면 `createDocument` 와 `putBackfilled` 가 모두 0 번 불리고 출력 다섯 줄이 모두 `EXISTS` 이며 `exitCode` 가 0 이다
- 목록을 읽은 뒤 기록됨: `listMonths` 가 빈 배열이고 `putBackfilled` 가 `{ created: false }` 를 주면 그 달이 `EXISTS` 다
- 비고가 빈 줄: 「비고」 칸이 빈 표를 넣으면 `parseUsageTable` 이 던지지 않고 그 줄의 `note` 가 빈 문자열이다
- dry-run: `store` 의 어느 메서드도 불리지 않고 출력이 모두 `WOULD_CREATE` 다
- 파싱 실패: 표의 둘째 줄이 잘못되면 던지고, `store` 의 어느 메서드도 불리지 않는다
- 원고 하나가 없으면 `MISSING_FILE` 이고 나머지는 처리되며 `exitCode` 가 1 이다
- 출력 검사: 원고 대역에 넣은 본문 문자열과 토큰 값이 `write` 로 나간 줄에 없다

요청 본문은 HTTP 대역으로 확인한다. `new ProfileClient({ origin: "https://career.example.com", token: "x".repeat(32), fetchImpl, maxRetries: 0 })` 로 fetch 대역을 넣은 client 를 만들고, `main` 이 쓰는 것과 같은 연결 함수로 `putBackfilled` 를 부른다. client 를 이렇게 만드는 본보기는 `career-os/scripts/profile/client.test.ts` 다. 이를 위해 연결 함수를 `export function createProfileMigrationStore(client)` 로 내보낸다.

- 대역이 받은 `PUT` 요청의 본문에 `replace` 키가 없고 `source` 가 `BACKFILLED` 이며 환산 비용과 세션 수가 비어 있다
- 비고가 빈 줄을 넘기면 요청 본문에 `note` 키가 없고 던지지 않는다
- `documentExists` 는 대역이 404 를 주면 `false` 이고, 500 을 주면 던진다

`career-os/scripts/profile/` 의 기존 테스트 가운데 디렉터리의 파일 수나 명령 목록을 상수로 단언하는 것이 있는지 `grep -rn "toHaveLength\|toBe([0-9]" career-os/scripts/profile` 로 찾는다. 있으면 그 테스트를 이 phase 의 커밋에 넣고 값을 고친 뒤, 「변경 파일」 에 없던 파일이 더해졌다고 보고한다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/profile career-os/scripts/profile/migrate_library_profiles.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
PATH="$HOME/.bun/bin:$PATH" bun career-os/scripts/profile/migrate_library_profiles.ts --help
! grep -nE '(^|[^.[:alnum:]_])replace[[:space:]]*:' career-os/scripts/profile/migrate_library_profiles.ts
```

모두 종료 코드 0 이어야 한다. 환경값은 필요 없다. `--help` 는 연결값 없이 돈다. 마지막 grep 은 객체의 `replace:` 칸만 잡는다. 문자열 메서드 `.replace(` 는 앞에 `.` 이 붙어 걸리지 않는다. 커밋 전에는 새 파일이 추적되지 않아 `git grep` 이 읽지 못하므로 `grep` 으로 파일을 직접 읽는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/profile/migrate_library_profiles.ts` | 신규 |
| `career-os/scripts/profile/migrate_library_profiles.test.ts` | 신규 |
