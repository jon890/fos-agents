# Phase 01 — focus-unit.json complexLocation + load_target_meta.ts + run_report.sh 갱신

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-002 (focus-unit.json 단일 출처) + ADR-003 (apartment TypeScript 도입) 적용:

1. `apartment/config/focus-unit.json`에 `complexLocation` 키 추가.
2. `apartment/scripts/_lib/load_target_meta.ts` 신설 — focus-unit.json 읽어 5개 env-style KEY=VALUE를 shell-eval 가능 형태로 stdout. env override 우선순위 보존.
3. `apartment/skills/apartment-daily-report/scripts/run_report.sh:21-25`의 5개 env default 폐기 → ts 헬퍼 eval로 대체.
4. smoke 검증 통과.

**범위 외**: ADR-002/003 본문 작성 (이미 docs commit `9604092`에 포함). data-schema.md / code-architecture.md 갱신 (동일).

---

## 본 phase 강제 주의문

- 반드시 Write/Edit/Bash 도구로 파일을 생성·수정해야 한다. prose 응답으로 종료하면 PHASE_FAILED.
- focus-unit.json 부재 또는 필수 키 누락 시 ts 헬퍼가 `exit 1` + stderr 메시지. 하드코딩 fallback 추가 금지 (ADR-002).
- env override 우선순위 유지 (ADR-002): `TARGET_NAME=... bash run_report.sh` 실행 시 env 값 우선.
- 본 phase 종료 시 commit 개수 self-check: 1.

---

## 사전 cwd 설정 (run-phases.py hotfix)

run-phases.py는 cwd=apartment (워크스페이스)로 phase 실행. 본 phase는 ai-nodes 루트 기준 `apartment/...` path를 다수 인용하므로 첫 bash 호출에서 cwd=ai-nodes 루트로 변경. Claude Code Bash 도구 cwd 보존 특성으로 후속 자동 유지.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

- 적용 ADR: `apartment/docs/adr.md` ADR-002 (단일 출처) / ADR-003 (ts 도입 + `_lib/` 위치)
- 스키마: `apartment/docs/data-schema.md` 1-1 focus-unit.json (complexLocation 키 명세)
- 디렉터리 트리: `apartment/docs/code-architecture.md` 1번 (scripts/_lib/load_target_meta.ts 등록)

---

## 작업 항목

### 1. focus-unit.json complexLocation 키 추가

`Edit` 도구로 `apartment/config/focus-unit.json` 수정.

`primaryFocusUnit` 객체 직전, `complexAlias` 다음 줄에 추가:

```json
"complexLocation": "경기 구리시 수택동 854-2 / 체육관로 54",
```

위치 정확: `complexAlias`와 `primaryFocusUnit` 사이. JSON 키 순서가 헬퍼에서 정렬 의존은 없지만 가독성상 메타 키 그룹을 앞에 모음.

검증:

```bash
python3 -c "
import json
d = json.load(open('apartment/config/focus-unit.json'))
assert d['complexLocation'] == '경기 구리시 수택동 854-2 / 체육관로 54', f'unexpected: {d.get(\"complexLocation\")}'
print('[complexLocation] OK')
"
```

### 2. apartment/scripts/_lib/load_target_meta.ts 신설

```bash
mkdir -p apartment/scripts/_lib
```

`Write` 도구로 `apartment/scripts/_lib/load_target_meta.ts` 작성. 약 50줄:

```typescript
#!/usr/bin/env bun
// load_target_meta.ts — apartment focus-unit.json read + env override.
// ADR-002 (focus-unit.json 단일 출처), ADR-003 (apartment ts 도입 + _lib/ 위치).
//
// Usage:
//   bun run apartment/scripts/_lib/load_target_meta.ts <focus-unit.json>
//
// stdout: shell-friendly KEY='VALUE' 5 줄 (TARGET_NAME, TARGET_ALIAS, TARGET_LOCATION,
//         TARGET_UNIT_LABEL, TARGET_UNIT_EXCLUSIVE_AREA_M2). shell이 eval로 set.
// env override 우선순위: process.env[key]가 set + 비어있지 않으면 그 값, 아니면 json 값.

const path = process.argv[2];
if (!path) {
  console.error("usage: load_target_meta.ts <focus-unit.json>");
  process.exit(1);
}

type FocusUnit = {
  complexName?: string;
  complexAlias?: string;
  complexLocation?: string;
  primaryFocusUnit?: {
    label?: string;
    exclusiveAreaM2?: number;
  };
};

let json: FocusUnit;
try {
  json = (await Bun.file(path).json()) as FocusUnit;
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`load_target_meta: ${path} 읽기 실패: ${msg}`);
  process.exit(1);
}

const mapping: [string, () => unknown][] = [
  ["TARGET_NAME", () => json.complexName],
  ["TARGET_ALIAS", () => json.complexAlias],
  ["TARGET_LOCATION", () => json.complexLocation],
  ["TARGET_UNIT_LABEL", () => json.primaryFocusUnit?.label],
  ["TARGET_UNIT_EXCLUSIVE_AREA_M2", () => json.primaryFocusUnit?.exclusiveAreaM2],
];

function shellQuote(v: unknown): string {
  return `'${String(v).replace(/'/g, "'\\''")}'`;
}

for (const [envKey, getJsonValue] of mapping) {
  const envValue = process.env[envKey];
  let value: unknown;
  if (envValue !== undefined && envValue !== "") {
    value = envValue;
  } else {
    value = getJsonValue();
    if (value === undefined || value === null || value === "") {
      console.error(`load_target_meta: ${path} 필수 키 누락 — ${envKey} 매핑 실패`);
      process.exit(1);
    }
  }
  console.log(`${envKey}=${shellQuote(value)}`);
}
```

검증:

```bash
test -f apartment/scripts/_lib/load_target_meta.ts && echo "[ts file] OK" || { echo "PHASE_FAILED: ts 파일 부재"; exit 1; }

# 기본 동작 — env 없으면 json 값
unset TARGET_NAME TARGET_ALIAS TARGET_LOCATION TARGET_UNIT_LABEL TARGET_UNIT_EXCLUSIVE_AREA_M2
OUTPUT=$(bun run apartment/scripts/_lib/load_target_meta.ts apartment/config/focus-unit.json)
echo "[default output]"
echo "$OUTPUT"
echo "$OUTPUT" | grep -q "^TARGET_NAME='엘지원앙아파트'" || { echo "PHASE_FAILED: TARGET_NAME default mismatch"; exit 1; }
echo "$OUTPUT" | grep -q "^TARGET_LOCATION='경기 구리시 수택동" || { echo "PHASE_FAILED: TARGET_LOCATION default mismatch"; exit 1; }

# env override 확인
TARGET_NAME="테스트단지" OUTPUT2=$(TARGET_NAME="테스트단지" bun run apartment/scripts/_lib/load_target_meta.ts apartment/config/focus-unit.json)
echo "$OUTPUT2" | grep -q "^TARGET_NAME='테스트단지'" || { echo "PHASE_FAILED: env override 실패"; exit 1; }
echo "[env override] OK"
```

### 3. run_report.sh 21-25줄 폐기 + ts 헬퍼 eval

`Edit` 도구로 `apartment/skills/apartment-daily-report/scripts/run_report.sh` 수정.

**중요**: 현재 `notify_safe` 함수는 line 44-49에 정의됨. 새 ts 헬퍼 호출에서 실패 시 `notify_safe`를 부르려면 *호출 위치 이후*에 정의되어야 함.

해결 방안: `notify_safe` + `NOTIFIER` 변수 정의를 ts 헬퍼 호출보다 *앞으로* 이동. 즉:

1. line 21-25 `TARGET_*` env default 5줄 제거.
2. line 38 `NOTIFIER` 정의 + line 44-49 `notify_safe` 함수 정의를 line 20 직후로 이동.
3. ts 헬퍼 호출 블록을 새 위치에 삽입.

권장 순서 (line 20 직후 → line 30 즈음):

```bash
# notify_safe / NOTIFIER를 ts 헬퍼 호출 *전*에 정의 (실패 시 알림 가능하도록).
SKILL_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NOTIFIER="$SKILL_ROOT/scripts/notify_discord.sh"

notify_safe() {
  local msg="$1"
  if [[ -x "$NOTIFIER" ]]; then
    "$NOTIFIER" "$msg" || true
  fi
}

# 타깃 메타 — apartment/config/focus-unit.json 단일 출처 (ADR-002).
# ts 헬퍼가 env override 우선순위 유지하며 5 변수 set (ADR-003).
FOCUS_UNIT_JSON="${FOCUS_UNIT_JSON:-$HOME/ai-nodes/apartment/config/focus-unit.json}"
if [[ ! -f "$FOCUS_UNIT_JSON" ]]; then
  notify_safe "[실패] apartment-daily-report focus-unit.json 부재: $FOCUS_UNIT_JSON"
  echo "FATAL: $FOCUS_UNIT_JSON not found" >&2
  exit 1
fi
LOAD_META_TS="$HOME/ai-nodes/apartment/scripts/_lib/load_target_meta.ts"
if [[ ! -f "$LOAD_META_TS" ]]; then
  notify_safe "[실패] apartment-daily-report load_target_meta.ts 부재: $LOAD_META_TS"
  echo "FATAL: $LOAD_META_TS not found" >&2
  exit 1
fi
META_EVAL=$(bun run "$LOAD_META_TS" "$FOCUS_UNIT_JSON") || {
  notify_safe "[실패] apartment-daily-report load_target_meta.ts 실행 실패"
  exit 1
}
eval "$META_EVAL"
```

기존 line 34-40의 `SKILL_ROOT` / `PROMPT_FILE` / `NORMALIZER` / `COLLECTOR` / `NOTIFIER` / `FALLBACK_MD` / `EXTRACT` 변수 정의에서 **`SKILL_ROOT`, `NOTIFIER` 중복 정의 제거**. 나머지(PROMPT_FILE 등)는 그대로 유지.

기존 line 44-49 `notify_safe` 함수 정의도 위로 이동했으니 그 자리 비움.

작업 후 shell syntax 확인:

```bash
bash -n apartment/skills/apartment-daily-report/scripts/run_report.sh && echo "[shell syntax] OK" || { echo "PHASE_FAILED: shell syntax 오류"; exit 1; }
```

이전 default 잔존 grep:

```bash
LEFT=$(grep -c '"${TARGET_[A-Z_]*:-' apartment/skills/apartment-daily-report/scripts/run_report.sh 2>/dev/null || echo 0)
[ "$LEFT" -eq 0 ] || { echo "PHASE_FAILED: 옛 TARGET_* default 잔존 $LEFT 건"; grep -n '"${TARGET_[A-Z_]*:-' apartment/skills/apartment-daily-report/scripts/run_report.sh; exit 1; }
echo "[옛 TARGET_* default 잔존] 0 OK"

grep -q "load_target_meta.ts" apartment/skills/apartment-daily-report/scripts/run_report.sh || { echo "PHASE_FAILED: ts 호출 누락"; exit 1; }
echo "[ts 호출 등록] OK"
```

### 4. smoke 검증

```bash
bash apartment/skills/apartment-daily-report/scripts/run_smoke_test.sh 2>&1 | tee /tmp/plan002-smoke.log
grep -q "smoke ok" /tmp/plan002-smoke.log || { echo "PHASE_FAILED: smoke 실패"; cat /tmp/plan002-smoke.log; exit 1; }
echo "[smoke] OK"
```

run_smoke_test.sh는 focus-unit.json 직접 읽지 않음 (collect_sources.py / normalize_results.py 호출). 본 변경의 직접 영향은 없지만 collector chain이 무사한지 확인.

### 5. commit

```bash
git add apartment/config/focus-unit.json apartment/scripts/ apartment/skills/apartment-daily-report/scripts/run_report.sh
git commit -m "$(cat <<'COMMIT_EOF'
feat(apartment): focus-unit.json 단일 출처 + load_target_meta.ts (plan002 phase-01)

- focus-unit.json complexLocation 키 추가 (ADR-002 — 5 타깃 메타 단일 출처)
- apartment/scripts/_lib/load_target_meta.ts 신설 (ADR-003 — apartment 첫 ts 파일)
- run_report.sh 21-25 env default 폐기 → eval bun run load_target_meta.ts
- notify_safe + NOTIFIER 정의를 ts 헬퍼 호출 전으로 이동 (실패 시 알림 가능)
- env override 우선순위 유지 (ts process.env[key] ?? json)
- focus-unit.json 또는 ts 파일 부재 시 FAIL + Discord notify

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
COMMIT_EOF
)"

COMMITS=$(git log --format='%H' HEAD~1..HEAD | wc -l)
echo "[commit count] $COMMITS"
[ "$COMMITS" -eq 1 ] || { echo "PHASE_FAILED: phase commit $COMMITS != 1"; exit 1; }

echo "✓ Phase 01 검증 통과"
```

---

## 의도 메모

- ADR-002 거절 대안 보존: "양쪽 동기화 자동화" / "shell hardcoded + json metadata only" / "focus-unit.json metadata only". 본 phase는 결정만 적용.
- ADR-003 ts 위치 = `apartment/scripts/_lib/` (워크스페이스 레벨 공용). career-os ADR-031 반대 패턴, 의도적 비대칭 (apartment 도메인 = 단일 skill 다중 collect 구조).
- env override 우선순위 보존을 ts 측에서 처리 (`process.env[key] ?? json`). shell 측 `${VAR:-default}` 패턴보다 단순.
- 사용자 결정 메모 (2026-05-19): skills/ 폐기 논의는 plan002 마무리 후 별도 ai-nodes 차원 plan. 본 plan은 `apartment/skills/` + `apartment/scripts/_lib/` 구조 유지.
- smoke 검증은 light — Claude full run은 호출 비용 발생하므로 다음 cron 또는 사용자 명시 호출에서 자연스럽게 확인.
