# Phase 01. 측정 스크립트를 scripts/agent-usage 로 옮기고 출력을 TypeScript 로 읽는다

**Execution profile**: standard

## 목표

`agent_usage.py` 를 스킬 번들에서 `career-os/scripts/agent-usage/` 로 옮기고, 그 `--json` 출력을 검증해 돌려주는 `measure.ts` 를 만든다.
수집기가 스킬 없이 `launchd` 로 돌기 때문에 측정 코드가 스킬 번들 밖에 있어야 한다.

**범위 외**: Backend 에 올리는 수집기는 Phase 02 다. `agent_usage_chart.py` 는 옮기지도 지우지도 않는다. 스킬의 원고 읽기와 쓰기 전환은 Phase 05 다.

## 컨텍스트

- 지금 측정 스크립트는 `career-os/.claude/skills/sync-profile/scripts/agent_usage.py` 다. 인자는 `--months N`(최근 N개월, 0 이면 전체)과 `--json` 둘이다
- `--json` 출력의 모양이다. 값은 지어낸 것이다

```json
{
 "months": [
  { "month": "2026.03", "claude_tokens": 1200, "codex_tokens": 500, "claude_cost": 0.01, "codex_cost": 0.0, "sessions": 2 }
 ],
 "total": { "tokens": 1700, "claude_cost": 0.01, "codex_cost": 0.0, "total_cost": 0.01, "sessions": 2, "unpriced_tokens": 0 }
}
```

- `month` 는 `YYYY.MM` 이다. 세션 기록의 `timestamp` 앞 일곱 글자(UTC)에서 만든다
- **단가를 모르는 토큰(`unpriced_tokens`)은 `total` 에만 있다.** 달마다의 값이 없어 한 달의 기록에 넣을 수 없다. 이 phase 가 `months` 의 각 줄에 더한다
- 스크립트는 `os.path.expanduser("~/.claude/projects/**/*.jsonl")` 과 `~/.codex/sessions/**/*.jsonl` 을 읽는다. `expanduser` 는 환경값 `HOME` 을 따르므로, 테스트는 `HOME` 을 임시 디렉터리로 바꿔 실제 세션 기록 없이 돌린다
- TypeScript 코드의 배치와 테스트 관례는 `career-os/scripts/candidate-context/` 를 본보기로 삼는다. 테스트는 `bun:test` 로 코드 옆에 `<이름>.test.ts` 로 둔다
- zod 는 저장소 루트 `package.json` 의 의존성이다. `import { z } from "zod";` 로 쓴다

**근거 문서**: `career-os/docs/code-architecture.md` 의 「sync-profile」 절, `career-os/docs/data-schema.md` 의 「수집기가 올리는 사용량 기록」 절, `career-os/docs/adr/ADR-133-프로필-원고와-에이전트-사용량-기록은-backend의-profile-모듈이-갖는다.md`

## 의도 메모

- 측정을 TypeScript 로 다시 쓰지 않는다. 단가표와 세션 기록 읽기가 이미 파이썬에 있고, 같은 계산을 두 벌 두면 값이 어긋난다
- 달을 나누는 기준(UTC)을 바꾸지 않는다. 이미 기록한 달과 같은 기준이어야 한다. 수집기가 달이 끝났는지를 UTC 로 판정해 이 기준에 맞춘다
- 사람이 읽는 표 출력(`--json` 없는 실행)은 바꾸지 않는다

## Blocked 조건

- `career-os/scripts/profile/manage_profile.ts` 나 `career-os/services/career-backend/src/profile/` 가 없으면 `PHASE_BLOCKED: 프로필 저장 모듈이 머지되기 전` 을 출력하고 종료한다. 이 phase 는 그 파일들을 고치지 않지만, 뒤 phase 가 모두 그 위에 선다

## 작업 항목

### 1. `agent_usage.py` 이동과 달별 `unpriced_tokens`

- `git mv career-os/.claude/skills/sync-profile/scripts/agent_usage.py career-os/scripts/agent-usage/agent_usage.py`
- `main()` 의 달별 `row` 에 `unpriced_tokens=a.get("unknown", 0) + b.get("unknown", 0)` 을 더한다. `total` 의 `unpriced_tokens` 는 그대로 둔다
- 파일 머리 주석의 사용법 경로는 파일 이름만 적혀 있어 고칠 것이 없다

### 2. `career-os/scripts/agent-usage/measure.ts` 신규

```ts
export type MonthlyMeasurement = {
  month: string;            // YYYY-MM
  claudeTokens: number;
  codexTokens: number;
  claudeCostUsd: number;
  codexCostUsd: number;
  sessions: number;
  unpricedTokens: number;
};
/** 측정 스크립트의 표준 출력을 돌려준다. 테스트가 대역을 넣는 자리다. */
export type MeasurementRunner = () => Promise<string>;
export function parseMeasurement(stdout: string): MonthlyMeasurement[];
export function runAgentUsageScript(): Promise<string>;
export async function measureUsage(run: MeasurementRunner = runAgentUsageScript): Promise<MonthlyMeasurement[]>;
```

- `parseMeasurement` 는 JSON 을 zod 로 검증한다. `month` 는 `/^\d{4}\.\d{2}$/` 이고 `YYYY-MM` 으로 바꿔 돌려준다. 토큰, 세션, `unpriced_tokens` 는 0 이상 정수, 비용은 0 이상 수다. `total` 은 읽지 않는다
- JSON 이 아니거나 계약에 맞지 않으면 `Error("측정 출력이 계약과 다르다.")` 를 던진다. 오류 문구에 출력 본문을 넣지 않는다
- `runAgentUsageScript` 는 `python3` 으로 같은 디렉터리의 `agent_usage.py --json` 을 실행한다. 스크립트 경로는 `import.meta.dir` 로 만든다. 종료 코드가 0 이 아니면 `Error("측정 스크립트가 실패했다.")` 를 던진다. `--months` 를 주지 않는다. 어느 달이 필요한지는 수집기가 정한다

### 3. 스킬 문서의 경로 맞추기

스크립트가 옮겨져 경로만 고친다. 흐름을 바꾸는 것은 Phase 05 다.

- `career-os/.claude/skills/sync-profile/SKILL.md` 의 스크립트 표에서 `agent_usage.py` 줄을 지운다. 그 표는 스킬 번들의 `scripts/` 만 적는다
- `career-os/.claude/skills/sync-profile/references/github.md` 의 「에이전트 사용량」 절에서 `python3 "$A/agent_usage.py" --months 2` 를 `python3 career-os/scripts/agent-usage/agent_usage.py --months 2` 로 고친다. `A=` 줄은 `agent_usage_chart.py` 가 계속 쓰므로 남긴다

### 4. 이 phase 를 검증하는 테스트

`career-os/scripts/agent-usage/measure.test.ts` 신규.

- `parseMeasurement` 정상: 위 예시에 `unpriced_tokens` 를 더한 JSON 을 넣어 `month` 가 `2026-03` 이고 나머지 값이 그대로인지 확인한다
- `parseMeasurement` 실패: `months` 한 줄에 `unpriced_tokens` 가 없는 JSON, 음수 토큰, JSON 이 아닌 문자열이 모두 던진다. 던진 오류의 문구에 입력 문자열이 들어 있지 않다
- `measureUsage` 는 넘겨받은 대역 `run` 의 출력을 파싱한다. `python3` 을 실행하지 않는다

`career-os/scripts/agent-usage/agent_usage_script.test.ts` 신규. 파이썬 스크립트를 임시 `HOME` 으로 실제 실행한다.

- `mkdtempSync` 로 만든 디렉터리에 아래 두 파일을 쓴다
  - `.claude/projects/sample/session.jsonl`: 아래 두 줄이다. 둘째 줄은 `output_tokens` 를 0 으로 두어 그 줄의 토큰 합이 300 이 되게 한다. 스크립트는 한 줄의 `input_tokens`, `output_tokens`, 캐시 두 칸을 모두 더해 토큰으로 센다
    - `{"timestamp":"2026-03-10T01:00:00Z","message":{"model":"claude-opus-4-7","usage":{"input_tokens":1000,"output_tokens":200,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}`
    - `{"timestamp":"2026-03-10T02:00:00Z","message":{"model":"unknown-model","usage":{"input_tokens":300,"output_tokens":0,"cache_creation_input_tokens":0,"cache_read_input_tokens":0}}}`
  - `.codex/sessions/2026/03/session.jsonl`: `{"timestamp":"2026-03-11T01:00:00Z","model":"gpt-5.5","payload":{"info":{"total_token_usage":{"total_tokens":500,"input_tokens":400,"cached_input_tokens":100,"output_tokens":100}}}}` 한 줄이다
- 인터프리터의 절대 경로를 먼저 얻는다. 이 기기의 `python3` 은 mise shim 이라, 임시 `HOME` 에서 shim 을 부르면 설정을 찾지 못해 인터프리터를 새로 내려받으려 한다
  - 실제 `HOME` 그대로 `Bun.spawnSync(["python3", "-c", "import sys; print(sys.executable)"])` 를 실행하고, 표준 출력을 `trim()` 한 값을 인터프리터 경로로 쓴다. 종료 코드가 0 이 아니거나 값이 절대 경로가 아니면 테스트가 실패한다
- `Bun.spawnSync([<인터프리터 경로>, <agent_usage.py 경로>, "--json"], { env: { ...process.env, HOME: <임시 디렉터리> } })` 로 실행한다
- 기대값: 종료 코드 0, `months` 길이 1, `month` 가 `2026.03`, `claude_tokens` 1500(1000, 200, 300 을 더한 값), `codex_tokens` 500, `sessions` 2(Claude 파일 하나와 Codex 파일 하나), 그 줄의 `unpriced_tokens` 300, `claude_cost` 0.01(`claude-opus-4-7` 의 단가로 입력 1000 에 5 를, 출력 200 에 25 를 곱해 더한 뒤 100만으로 나눈 값)
- 같은 출력을 `parseMeasurement` 에 넣어 던지지 않는 것을 확인한다. 파이썬 출력과 TypeScript 계약이 어긋나면 이 단언이 잡는다
- `python3` 이 없으면 테스트가 실패한다. 건너뛰지 않는다

개수를 단언하는 기존 테스트는 영향이 없다. `grep -rn "agent_usage" career-os/scripts career-os/.claude` 로 옛 경로를 참조하는 곳이 문서 둘과 `agent_usage_chart.py` 의 머리 주석뿐인 것을 확인했다. 머리 주석은 파일 이름만 적어 고칠 것이 없다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/agent-usage/measure.test.ts career-os/scripts/agent-usage/agent_usage_script.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
test ! -e career-os/.claude/skills/sync-profile/scripts/agent_usage.py
! git grep -n "sync-profile/scripts/agent_usage.py" -- career-os/.claude career-os/docs career-os/AGENTS.md career-os/README.md
```

모두 종료 코드 0 이어야 한다. 환경값은 필요 없다. `python3` 이 PATH 에 있어야 한다. `agent_usage_script.test.ts` 는 실제 `HOME` 에서 인터프리터의 절대 경로를 얻은 뒤 임시 `HOME` 으로 실행한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/sync-profile/scripts/agent_usage.py` | 삭제 |
| `career-os/scripts/agent-usage/agent_usage.py` | 신규 |
| `career-os/scripts/agent-usage/measure.ts` | 신규 |
| `career-os/scripts/agent-usage/measure.test.ts` | 신규 |
| `career-os/scripts/agent-usage/agent_usage_script.test.ts` | 신규 |
| `career-os/.claude/skills/sync-profile/SKILL.md` | 수정 |
| `career-os/.claude/skills/sync-profile/references/github.md` | 수정 |
