# Phase 04 — 통합 검증 (1회 수집 + 3개 통합 확인) + index.json status=completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan081의 세 변경(검증 회사군 config 정합, 비서버 필터 보강, naver-careers 복구)이 함께 동작하는지 통합 검증한다.
career-os는 shadow 관찰 기간을 두지 않으므로(AGENTS.md) 변경 즉시 1회 수집으로 검증한다.
검증 통과 후 `index.json`의 `status`를 `completed`로 마킹한다.

**범위 외**:
- 코드·config·문서 본문은 수정하지 않는다. 이 phase는 검증과 index.json status 마킹만 한다.
- naver-careers가 phase-03에서 PHASE_BLOCKED로 종료됐다면 이 phase는 실행되지 않는다(run-phases.py가 BLOCKED phase에서 멈춤). 이 phase가 실행된다는 것은 phase-03이 completed(accepted>0)라는 의미다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 루트로 고정한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

---

## 관련 docs

- `career-os/tasks/plan081-position-source-consolidation/index.json` — status 마킹 대상.

---

## 작업 항목 (3)

### 1. 통합 검증 — 세 변경 동시 확인 (검증 섹션 bash 실행)

### 2. 1회 수집 — naver 포함 (검증 섹션 bash 실행)

### 3. index.json status=completed 마킹 (검증 통과 후)

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan081-position-source-consolidation/index.json` | `status`를 `completed`로, `current_phase`를 4로 마킹 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"

# --- phase-01: 검증 회사군 config 정합 ---
NEW=career-os/config/verified-company-research-targets.json
OLD=career-os/.claude/skills/position-recommender/references/verified-company-research-targets.json
[ -f "$NEW" ] && [ ! -e "$OLD" ] && echo "[#4 config 이동] OK" || { echo "FAIL: #4 config 이동 미완"; exit 1; }
COMPANIES=$(python3 -c "import json;d=json.load(open('$NEW'));print(len(d['priorityCompanies']))")
echo "[#4 회사 수] $COMPANIES"
[ "$COMPANIES" -ge 12 ] || { echo "FAIL: #4 회사 수 12 미만"; exit 1; }
HAS=$(python3 -c "import json;d=json.load(open('$NEW'));print(sum(1 for c in d['priorityCompanies'] if 'hasAdapter' in c and 'adapterId' in c))")
echo "[#4 hasAdapter+adapterId 보유] $HAS / $COMPANIES"
[ "$HAS" = "$COMPANIES" ] || { echo "FAIL: #4 hasAdapter/adapterId 누락"; exit 1; }
CRIT=career-os/.claude/skills/position-recommender/references/position-decision-criteria.md
PROMPT=career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md
LEFT=$(grep -c "야놀자" "$CRIT" "$PROMPT" | awk -F: '{s+=$2} END {print s}')
echo "[#4 텍스트 회사 나열 잔존] $LEFT"
[ "$LEFT" = "0" ] || { echo "FAIL: #4 텍스트 나열 잔존"; exit 1; }
RESID=$(grep -rl "references/verified-company-research-targets.json" career-os/.claude/skills/position-recommender/ --include="*.md" 2>/dev/null | grep -v "/archive/" | wc -l | tr -d ' ')
echo "[#4 references/ 경로 잔재] $RESID"
[ "$RESID" = "0" ] || { echo "FAIL: #4 references/ 경로 잔존"; exit 1; }

# --- phase-02: 비서버 필터 보강 ---
POLICY=career-os/scripts/position-recommender/live-postings/policy.ts
grep -qF '"product owner"' "$POLICY" && grep -qF '"compensation"' "$POLICY" && echo "[#1 필터 키워드] OK" || { echo "FAIL: #1 필터 키워드 누락"; exit 1; }
bun -e '
import { isNonServerTitle } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
let f=0;
for (const t of ["토스 Product Owner","Global Compensation Manager"]) if(!isNonServerTitle(t)){console.log("FAIL reject:",t);f=1;}
for (const t of ["서버 개발자","Backend Engineer"]) if(isNonServerTitle(t)){console.log("FAIL keep:",t);f=1;}
if(f)process.exit(1); console.log("[#1 isNonServerTitle 동작] OK");
' || { echo "FAIL: #1 필터 동작"; exit 1; }

# --- phase-03 + 통합: 1회 수집 (naver 포함, accepted>0) ---
OUT=career-os/data/runtime/plan081-integration-verify.md
bun career-os/scripts/position-recommender/collect_live_postings.ts \
  --source naver-careers --output "$OUT" 2>&1 | tee /tmp/plan081-int.log
ACCEPTED=$(grep -oE "naver-careers diagnostics:.*accepted=[0-9]+" /tmp/plan081-int.log | grep -oE "accepted=[0-9]+" | grep -oE "[0-9]+" | head -1)
echo "[#2 naver accepted] ${ACCEPTED:-미검출}"
rm -f "$OUT"
[ -n "$ACCEPTED" ] && [ "$ACCEPTED" -gt 0 ] || { echo "FAIL: #2 naver accepted 0 또는 미검출 (phase-03 미완)"; exit 1; }

echo "✅ Phase 04 통합 검증 명령 실행 완료"
```

## index.json status 마킹

검증이 모두 통과한 뒤에만 실행한다. Edit 도구로 `index.json`의 `status`·`current_phase`·`updated_at`을 갱신한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan081-position-source-consolidation/index.json"
d = json.load(open(p))
d["status"] = "completed"
d["current_phase"] = 4
ts = subprocess.check_output(["bash","-c","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
# +0900 -> +09:00
d["updated_at"] = ts[:-2] + ":" + ts[-2:]
json.dump(d, open(p,"w"), ensure_ascii=False, indent=2)
open(p,"a").write("\n") if not open(p).read().endswith("\n") else None
print("status:", d["status"], "current_phase:", d["current_phase"], "updated_at:", d["updated_at"])
PY
grep '"status"' career-os/tasks/plan081-position-source-consolidation/index.json | head -1
```

## commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/tasks/plan081-position-source-consolidation/index.json
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
chore(career-os): plan081 통합 검증 완료 + index.json status=completed 마킹

- 검증 회사군 config 정합 / 비서버 필터 보강 / naver-careers 복구 3개 통합 확인
- 1회 수집에서 naver accepted>0 확인

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성"; exit 1; }
git log --oneline -1
git status --porcelain | wc -l
```

## 의도 메모 (왜)

- 세 변경이 각자 phase에서 통과해도, 통합 1회 수집에서 함께 동작하는지 확인해야 회귀를 잡는다. career-os는 shadow 관찰 기간을 두지 않으므로 즉시 1회 수집으로 검증한다(AGENTS.md).
- 이 phase가 실행된다는 것 자체가 phase-03이 completed(accepted>0)라는 의미다. naver가 BLOCKED였다면 run-phases.py가 phase-03에서 멈춰 이 phase는 실행되지 않는다.
- status 마킹을 마지막 phase 본문에서 명시적으로 한 번 더 하는 이유 — run-phases.py가 자동 마킹하지만 phase 본문에서 한 번 더 단정해 누락을 막는다(task-create.md 마지막 phase 표준).

## Blocked 조건

- 통합 검증 어느 항목이든 실패하면 `PHASE_FAILED: 통합 검증 실패` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다.
- 외부 사이트 fetch가 네트워크 오류로 불가해 naver accepted를 확인 못 하면 `PHASE_BLOCKED: naver 통합 수집 fetch 불가 — 네트워크 확인 필요` 출력 후 `exit 2`. prose만 출력하면 success로 잘못 처리된다.
