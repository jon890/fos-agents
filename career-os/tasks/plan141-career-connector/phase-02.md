# Phase 02. 차트를 TypeScript 로 옮기고 파이썬 출력과 같음을 고정한다

**Execution profile**: standard

## 목표

GitHub 프로필의 월별 토큰 차트를 그리는 순수 함수를 `career-os/scripts/agent-usage/chart.ts` 에 만든다.
지금의 파이썬 스크립트와 글자까지 같은 SVG 를 낸다는 것을 테스트로 고정한다.
커넥터(Phase 04)와 노트북의 CLI 가 이 함수 하나로 차트를 그리고 합계를 계산한다. 차트를 그리는 코드를 한 벌만 두기 위해서다.

**범위 외**: 파이썬 파일을 지우는 일과 스킬 문서 수정은 Phase 05 다. plugin 이 이 파일을 번들하는 일은 Phase 04 다.

## 컨텍스트

옮길 대상은 `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` 다. 끝까지 읽는다.

- 입력은 `--month <월>=<Claude>,<Codex>` 이고 두 수의 단위는 십억(B) 토큰이다. 값은 소수 한 자리로 준다
- `render(months)` 가 SVG 글을 만든다. 상수는 `WIDTH, HEIGHT = 760, 236`, `LEFT, RIGHT, TOP, BASE = 64, 740, 44.0, 192.0`, `BAR_WIDTH = 94.6` 이다
- 눈금 셋(0, 절반, 최댓값), 달마다 Codex 막대와 Claude 막대, 달의 합계와 달 표기를 그린다. 높이가 0.05 이하인 막대는 그리지 않는다
- 표준 출력에 `total=<합계> months=<달 수> out=<경로>` 한 줄을 낸다

**파이썬과 JavaScript 는 소수 한 자리 반올림이 다르다.** 파이썬의 `f"{x:.1f}"` 는 정확히 절반인 값을 짝수 쪽으로, `Number.prototype.toFixed(1)` 은 큰 쪽으로 보낸다.

| 값 | 파이썬 | `toFixed(1)` |
| --- | --- | --- |
| `0.25` | `0.2` | `0.3` |
| `12.25` | `12.2` | `12.3` |
| `0.75` | `0.8` | `0.8` |

정확히 절반인 값은 소수부가 `.25` 나 `.75` 인 값뿐이다. 그때만 짝수 쪽으로 보내고 나머지는 `toFixed(1)` 을 쓴다.
`{BASE:.0f}` 는 `192`, `{BAR_WIDTH}` 는 `94.6` 으로 찍힌다.

합계와 배지의 계산 규칙은 `career-os/docs/data-schema.md` 의 「차트와 Tokens 배지」 가 정한다. 이 phase 의 함수가 그 규칙을 구현한다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「차트와 Tokens 배지」 절, `career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`, `career-os/docs/adr/ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md`

## 의도 메모

- **`chart.ts` 는 아무것도 import 하지 않는다.** plugin 이 번들하는 유일한 `scripts/` 파일이다. `zod` 나 `node:` 모듈을 import 하면 번들이 루트의 설치 상태에 기대게 된다
- 숫자는 정수(0.1B 단위)로 다룬다. 부동소수점 합을 다시 반올림하면 달별 값의 합과 전체 합계가 한 자리 어긋날 수 있다
- 파이썬과 직접 비교하는 테스트와 커밋한 fixture 와 비교하는 테스트를 나눈다. 파이썬 파일을 지운 뒤에도 fixture 테스트가 남아 출력을 고정한다
- 노트북의 CLI 를 함께 만든다. 파이썬 파일을 지우면 `sync-profile` 이 차트를 그릴 방법이 없어지기 때문이다. CLI 도 숫자를 인자로 받지 않고 Backend 의 기록을 읽는다
- fixture 와 테스트의 수치는 지어낸 값이다. 실제 측정값을 넣지 않는다

## Blocked 조건

- `career-os/scripts/profile/client.ts` 나 `career-os/scripts/agent-usage/` 가 없으면 `PHASE_BLOCKED: 프로필 저장 모듈이나 plan139 의 사용량 수집기가 아직 이 브랜치에 없다. plan139 를 머지한 main 으로 rebase 한다` 를 출력하고 종료한다
- `career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` 가 없으면 `PHASE_BLOCKED: 대조할 파이썬 차트 스크립트가 없다` 를 출력하고 종료한다
- `python3` 이 PATH 에 없으면 `PHASE_BLOCKED: python3 이 없어 파이썬 출력과 대조할 수 없다` 를 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/agent-usage/chart.ts`

```ts
export type UsageTokens = { month: string; claudeTokens: number; codexTokens: number };
export type UsageBar = { month: string; claudeTenths: number; codexTenths: number };

export function toTenths(tokens: number): number;
export function selectUsageBars(
  records: UsageTokens[],
  months: string[],
): { bars: UsageBar[]; totalTenths: number; missing: string[] };
export function formatBillions(tenths: number): string;
export function renderUsageChart(bars: UsageBar[]): string;
export function readTokensBadge(readme: string): string | null;
```

- `UsageTokens` 는 이 파일의 입력 타입이다. Backend 응답의 칸 이름과 같을 필요가 없고, 부르는 쪽이 맞춰 넘긴다
- `toTenths(tokens)` 는 `Math.floor((tokens + 50_000_000) / 100_000_000)` 이다. `1_349_999_999` 는 `13`, `1_350_000_000` 은 `14` 다
- `selectUsageBars` 는 `months` 를 오름차순으로 정렬하고 겹친 달을 한 번만 쓴다. `records` 에 없는 달은 `missing` 에 담고 `bars` 에 넣지 않는다. `totalTenths` 는 `bars` 의 두 정수를 모두 더한 값이다
- `formatBillions(979)` 는 `"97.9B"`, `formatBillions(5)` 는 `"0.5B"`, `formatBillions(1000)` 은 `"100.0B"` 다
- `renderUsageChart(bars)` 는 파이썬 `render` 와 글자까지 같은 SVG 를 낸다. 막대의 값은 `claudeTenths / 10`, `codexTenths / 10` 이고 달 표기는 `month` 의 `-` 를 `.` 로 바꾼 글이다(`2026-07` 은 `2026.07`). 파이썬의 `:.1f` 는 위 컨텍스트의 규칙으로 찍는다. `bars` 가 비었거나 모든 막대의 두 값 가운데 최댓값이 0 이면 `RangeError` 를 던진다(파이썬은 이때 0 으로 나누어 멈춘다. `NaN` 이 든 SVG 를 만들지 않는다). `chart.ts`, `chart.test.ts`, `render_chart.ts`, `render_chart.test.ts` 의 주석과 글에 파이썬 파일 이름을 쓰지 않는다. 대조 테스트(`chart.python-parity.test.ts`)만 예외다
- `readTokensBadge(readme)` 는 `/img\.shields\.io\/badge\/Tokens-(\d+\.\d)B-/g` 에 맞는 곳이 정확히 하나일 때 `"97.9B"` 모양의 글을 돌려준다. 없거나 둘 이상이면 `null` 이다. `Tokens-98B-` 는 맞지 않으므로 `null` 이다

### 2. `career-os/scripts/agent-usage/fixtures/` 의 SVG 다섯

파이썬 스크립트로 만들어 커밋한다. 손으로 고치지 않는다.

| 파일 | `--month` 인자 |
| --- | --- |
| `chart-two-months.svg` | `2031.01=1.3,11.6` `2031.02=18.9,5.7` |
| `chart-six-months.svg` | `2031.01=0.4,2.0` `2031.02=3.1,0.9` `2031.03=7.7,7.7` `2031.04=12.0,0.1` `2031.05=20.5,4.4` `2031.06=9.9,30.2` |
| `chart-codex-zero.svg` | `2031.01=4.2,0.0` `2031.02=6.0,1.5` |
| `chart-claude-zero.svg` | `2031.01=0.0,3.3` |
| `chart-half-even.svg` | `2031.01=0.3,0.2` |

마지막 줄은 최댓값이 `0.5` 라 가운데 눈금이 `0.25` 다. 파이썬은 `0.2B` 로 찍는다.

```bash
# cwd: 저장소 루트
P=career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py
F=career-os/scripts/agent-usage/fixtures
python3 "$P" --month 2031.01=1.3,11.6 --month 2031.02=18.9,5.7 --out "$F/chart-two-months.svg"
```

나머지 넷도 같은 방법으로 만든다.

### 3. `career-os/scripts/agent-usage/render_chart.ts`

노트북에서 차트를 파일로 그리는 CLI 다.

```bash
bun --env-file=career-os/.env career-os/scripts/agent-usage/render_chart.ts --months 2031-01,2031-02 --out <SVG 경로>
```

```ts
export async function renderChartCommand(
  args: string[],
  dependencies?: { listSnapshots?: () => Promise<UsageTokens[]>; write?: (path: string, text: string) => Promise<void> },
): Promise<{ total: string; months: string[]; out: string }>;
```

- 인자는 `career-os/scripts/lib/cli.ts` 의 `firstOptionValue` 로 읽는다. `--months` 는 `YYYY-MM` 을 쉼표로 이은 글이고 1개에서 6개다. 모양이 틀리면 같은 파일의 `UsageError` 를 던진다. `import.meta.main` 블록은 `UsageError` 면 종료 코드 2, 나머지 오류면 1 로 끝낸다(`manage_candidate_context.ts` 는 모두 1 이므로 그 방식을 따르지 않는다)
- `listSnapshots` 의 기본값은 `career-os/scripts/profile/client.ts` 의 `createProfileClient()` 로 만든 client 의 `listUsageSnapshots` 를 불러 `usageSnapshotSchema`(`career-os/scripts/profile/contracts.ts`)의 칸을 `UsageTokens` 로 바꾼다. 연결값은 `--env-file` 로 받은 환경 변수에서 읽는다
- `selectUsageBars` 의 `missing` 이 비어 있지 않으면 파일을 쓰지 않고 없는 달을 적은 오류로 종료 코드 1 이다
- 성공하면 `renderUsageChart` 의 글을 `--out` 에 쓰고 표준 출력에 `total=<합계> months=<달 수> out=<경로>` 한 줄을 낸다. 합계는 `formatBillions(totalTenths)` 다
- `import.meta.main` 일 때만 실행한다

### 4. 이 phase 를 검증하는 테스트

`career-os/scripts/agent-usage/chart.test.ts`

- 위 fixture 다섯마다 같은 값의 `bars` 를 `renderUsageChart` 에 넣은 결과가 파일의 글과 같다. `1.3` 은 `claudeTenths: 13` 이다
- `toTenths`, `formatBillions` 가 작업 항목 1 의 예와 같다
- `selectUsageBars` 가 순서가 섞이고 겹친 `months` 를 정렬해 한 번씩 쓰고, 기록에 없는 달을 `missing` 에 담는다. `totalTenths` 가 `bars` 의 값의 합이다
- 달별 값의 합을 `formatBillions` 한 글이 `renderUsageChart` 가 찍은 달별 합계 글자들의 합과 같다
- `readTokensBadge` 가 `https://img.shields.io/badge/Tokens-97.9B-26d0ce` 를 담은 README 에서 `"97.9B"` 를 낸다. 배지가 없을 때, 둘일 때, `Tokens-98B-` 일 때 `null` 이다
- `renderUsageChart([])` 가 던진다. 모든 막대가 `claudeTenths: 0, codexTenths: 0` 이어도 `RangeError` 를 던진다
- 이 파일의 글에 `import` 문이 없다. `readFileSync` 로 `chart.ts` 를 읽어 `/^import /m` 에 맞지 않는 것을 단언한다

`career-os/scripts/agent-usage/chart.python-parity.test.ts`

- fixture 다섯의 인자로 `python3 career-os/.claude/skills/sync-profile/scripts/agent_usage_chart.py` 를 임시 디렉터리에 실행하고, 그 출력이 `renderUsageChart` 의 결과와 글자까지 같다
- 파이썬이 표준 출력에 낸 `total=` 의 값이 `formatBillions(totalTenths)` 와 같다
- `python3` 을 띄우지 못하면 건너뛰지 않고 실패한다

`career-os/scripts/agent-usage/render_chart.test.ts`

- 정상: `listSnapshots` 대역이 두 달을 주고 `--months` 가 그 두 달이면 `write` 가 받은 글이 `renderUsageChart` 의 결과와 같고 돌려준 `total` 이 합계다
- 실패: `--months` 에 기록에 없는 달이 있으면 `write` 를 부르지 않고 던진다. 오류의 글에 없는 달이 있다
- `--months` 가 일곱 달이거나 `2031-13` 이면 `listSnapshots` 를 부르지 않고 `UsageError` 를 던진다. 테스트는 `toThrow(UsageError)` 로 단언한다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun install --frozen-lockfile
bun test career-os/scripts/agent-usage career-os/scripts/agent-usage/chart.test.ts career-os/scripts/agent-usage/chart.python-parity.test.ts career-os/scripts/agent-usage/render_chart.test.ts
bunx tsc --noEmit
! grep -nE "^import " career-os/scripts/agent-usage/chart.ts
```

모두 종료 코드 0 이어야 한다.
`bun test career-os/scripts/agent-usage` 는 사용량 수집기의 기존 테스트도 함께 돌린다. 그 테스트가 요구하는 환경값이 있으면 `career-os/scripts/agent-usage/` 의 테스트 파일 머리에서 읽고 맞춘다. 이 phase 가 만드는 세 테스트는 환경값을 요구하지 않고 Backend 를 부르지 않는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/agent-usage/chart.ts` | 신규 |
| `career-os/scripts/agent-usage/chart.test.ts` | 신규 |
| `career-os/scripts/agent-usage/chart.python-parity.test.ts` | 신규 |
| `career-os/scripts/agent-usage/render_chart.ts` | 신규 |
| `career-os/scripts/agent-usage/render_chart.test.ts` | 신규 |
| `career-os/scripts/agent-usage/fixtures/chart-two-months.svg` | 신규 |
| `career-os/scripts/agent-usage/fixtures/chart-six-months.svg` | 신규 |
| `career-os/scripts/agent-usage/fixtures/chart-codex-zero.svg` | 신규 |
| `career-os/scripts/agent-usage/fixtures/chart-claude-zero.svg` | 신규 |
| `career-os/scripts/agent-usage/fixtures/chart-half-even.svg` | 신규 |
