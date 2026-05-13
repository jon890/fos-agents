# Phase 02 — Bun 환경 부트스트랩 + _shared/types/ 골격

**Model**: sonnet
**Status**: pending

---

## 목표

ai-nodes 루트에 Bun 환경을 부트스트랩한다 (package.json + tsconfig.json + .gitignore 갱신). `_shared/types/` 디렉터리와 공통 타입 골격을 만든다. 실제 헬퍼 로직 작성은 phase-03/04.

범위 외: 헬퍼 함수 본체 작성 (phase-03/04), caller 갱신 (phase-05), 옛 파일 폐기 (phase-05).

## 관련 docs

- `career-os/docs/code-architecture.md` _shared/ 트리 (phase-01 갱신본).
- `career-os/docs/adr.md` ADR-019 (phase-01 산출물).

## 작업 항목

### 1. Bun 설치 확인

**중요 — 반드시 Bash 도구로 아래 블록 전체를 직접 실행하라**. prose로 "PHASE_BLOCKED: Bun 미설치"만 출력하고 정상 종료하면 `run-phases.py`가 exit code 0을 받아 success 로 잘못 처리한다 (plan004 1차 실행에서 실제 발생). Bash 도구의 마지막 명령이 `exit 2`로 끝나야 run-phases.py가 blocked로 인식한다.

```bash
cd /home/bifos/ai-nodes
if ! command -v bun >/dev/null 2>&1; then
  echo "PHASE_BLOCKED: Bun 미설치. 사용자가 다음 명령으로 설치 후 phase 재실행:"
  echo "  curl -fsSL https://bun.sh/install | bash"
  echo "  exec \$SHELL  # PATH 갱신"
  exit 2
fi
bun --version
```

설치돼 있으면 phase 계속.

### 2. ai-nodes 루트에 `package.json` 신설

```bash
cd /home/bifos/ai-nodes
cat > package.json <<'JSON'
{
  "name": "ai-nodes",
  "version": "0.0.0",
  "private": true,
  "description": "ai-nodes 워크스페이스 공용 TS 헬퍼 (ADR-019)",
  "type": "module",
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.5.0"
  }
}
JSON
```

dependencies 는 비워둔다 — Bun 표준 라이브러리만 사용. 외부 npm 패키지는 신중하게, 필요 발견 시 별도 plan 으로 추가.

### 3. `tsconfig.json` 신설

```bash
cd /home/bifos/ai-nodes
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["bun-types"],
    "paths": {
      "@shared/lib/*": ["./_shared/lib/*"],
      "@shared/types/*": ["./_shared/types/*"]
    }
  },
  "include": ["_shared/**/*.ts"]
}
JSON
```

path alias 도입으로 caller 가 절대 경로 import 가능 — 워크스페이스 어디에서나 같은 import 패턴.

### 4. `.gitignore` 갱신

`node_modules/`, `bun.lockb` 또는 `bun.lock` 누락된 경우 추가:

```bash
cd /home/bifos/ai-nodes
for line in "node_modules/" "bun.lock" "bun.lockb"; do
  if ! grep -qxF "$line" .gitignore 2>/dev/null; then
    echo "$line" >> .gitignore
  fi
done

# 정렬은 강제하지 않음 — 기존 .gitignore 순서 보존
```

### 5. `bun install` 으로 deps 설치 + 검증

```bash
cd /home/bifos/ai-nodes
bun install
ls node_modules/typescript/package.json >/dev/null && echo "typescript installed"
ls node_modules/@types/bun/package.json >/dev/null && echo "@types/bun installed"
```

실패 시 `PHASE_FAILED: bun install 실패 (<stderr>)`. 네트워크 문제면 `PHASE_BLOCKED: 네트워크 점검 필요`.

### 6. `_shared/types/index.ts` 골격 작성

phase-03/04 의 헬퍼가 import 할 공통 타입. 최소 4개 인터페이스:

```bash
cd /home/bifos/ai-nodes
mkdir -p _shared/types
cat > _shared/types/index.ts <<'TS'
// _shared/types/index.ts
// ai-nodes 워크스페이스 공용 TS 타입 (ADR-019)

/**
 * `claude --print --output-format json` 의 envelope.
 * `invoke_claude_skills.ts` 가 이 형태로 결과 반환.
 */
export interface ClaudeUsage {
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    service_tier?: string;
  };
  modelUsage?: Record<string, unknown>;
  total_cost_usd?: number;
  session_id?: string;
  uuid?: string;
  // claude CLI 가 추가하는 필드는 unknown 으로 흘려보냄
  [key: string]: unknown;
}

/**
 * `logs/task-runs.jsonl` 한 줄 entry.
 * `format_cost_summary.ts` 가 이 형태로 latest 한 줄 파싱.
 * `track_task.sh` 가 채우는 필드 기준.
 */
export interface TaskRunEntry {
  run_id: string;
  task_name: string;
  start_time: string;
  end_time: string;
  duration_sec: number;
  status: "success" | "failed";
  exit_code: number;
  command: string;
  model: string | null;
  tokens_in_delta: number | null;
  tokens_out_delta: number | null;
  cached_tokens_delta: number | null;
  cache_read_input_tokens: number | null;
  cost_usd: number | null;
  service_tier: string | null;
  // 그 외 track_task.sh 필드는 unknown 으로 흘려보냄
  [key: string]: unknown;
}

/**
 * `notify_discord.ts` 가 전송하는 Discord webhook payload.
 * Discord 공식 webhook 스펙 부분집합.
 */
export interface NotificationPayload {
  content: string;
  username?: string;
  avatar_url?: string;
}

/**
 * `config/topics.json` 의 단일 토픽 entry (plan002 이후 스키마).
 * namespace 별로 같은 형태.
 */
export interface TopicEntry {
  domain?: string;
  outputPath?: string;
  title?: string;
  promptAppend?: string;
  inputFiles?: string[];
  // 미래 확장 필드는 unknown
  [key: string]: unknown;
}
TS
```

각 인터페이스는 짧고 명확. 알려지지 않은 필드는 index signature 로 흘려보내 향후 확장 비용 최소화.

### 7. TypeScript 컴파일 검증

```bash
cd /home/bifos/ai-nodes
bunx tsc --noEmit
# 또는 bun 의 내장 type-check:
# bun tsc --noEmit
```

에러 0건이어야. 발생 시 `PHASE_FAILED: tsc 에러 (<출력>)`.

## Critical Files

| 파일 | 변경 |
|---|---|
| `package.json` | 신규 |
| `tsconfig.json` | 신규 |
| `.gitignore` | node_modules / bun.lock 추가 |
| `_shared/types/index.ts` | 신규 — 4 인터페이스 |
| `bun.lock` (또는 .lockb) | bun install 결과 — 커밋 대상 (재현성 위해) |

`_shared/lib/` 는 phase-03/04 에서 채움.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. Bun 동작
bun --version >/dev/null || { echo "PHASE_FAILED: bun 동작 안 함"; exit 1; }

# 2. package.json / tsconfig.json 존재 + valid JSON
python3 -c "import json; json.load(open('package.json'))"
python3 -c "import json; json.load(open('tsconfig.json'))"

# 3. _shared/types/index.ts 존재 + 4 인터페이스 export
for iface in ClaudeUsage TaskRunEntry NotificationPayload TopicEntry; do
  grep -q "export interface $iface" _shared/types/index.ts || { echo "PHASE_FAILED: $iface 누락"; exit 1; }
done

# 4. tsc 통과
bunx tsc --noEmit 2>&1 | tee /tmp/plan004-phase02-tsc.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: tsc 실패"; cat /tmp/plan004-phase02-tsc.log; exit 1; }

# 5. .gitignore 에 node_modules
grep -qxF "node_modules/" .gitignore || { echo "PHASE_FAILED: .gitignore 누락"; exit 1; }
```

## 커밋

```
feat(_shared): Bun 환경 부트스트랩 + _shared/types 골격 (plan004 phase-02)

- package.json + tsconfig.json + .gitignore (node_modules)
- _shared/types/index.ts: ClaudeUsage, TaskRunEntry, NotificationPayload, TopicEntry 4 인터페이스
- bun.lock 동봉 (재현성)

실제 헬퍼 본체는 phase-03/04. caller 갱신은 phase-05.
```

push 는 phase-05.

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료한다. 마커만 출력하고 정상 종료하면 `run-phases.py`가 success로 잘못 처리한다 (plan001-adr-cleanup 1차 실행 사례).

- Bun 미설치 시 `PHASE_BLOCKED: Bun 미설치` + `exit 2` (사용자 설치 후 재실행).
- bun install 네트워크 실패 시 `PHASE_BLOCKED: 네트워크` + `exit 2`.
- tsc 에러 시 `PHASE_FAILED: tsc` + `exit 1`.
