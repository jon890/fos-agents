# Phase 05 — 통합 검증 (1회 수집 + 문서 정합) + index.json status=completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

phase-01~04 산출물을 통합 검증하고, `index.json`의 status를 completed로 마킹한다.
이 phase는 신규 코드/문서를 만들지 않는다 — 검증과 상태 마킹만 한다.

확인 대상:
- ④ SKILL.md ↔ prompt.md 14 라벨 정합(phase-01).
- ① 비서버 직무 감소(phase-02).
- ③ 태그 변별력(phase-03).
- ② 1회 수집에서 requirements 채움(phase-04).

career-os는 shadow 관찰 기간을 두지 않으므로(AGENTS.md), 검증은 즉시 1회 수집 + 정적 점검으로 끝낸다.

**범위 외**:
- 코드·문서 추가 수정 금지. 검증 실패면 보고만 하고 해당 phase로 되돌린다(여기서 고치지 않는다).
- push·PR 금지. 별도 worktree+branch 실행이므로 commit까지만이고, push는 메인 세션 review 후.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

---

## 통합 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0
SKILL=career-os/.claude/skills/position-recommender/SKILL.md
PROMPT=career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md
POLICY=career-os/scripts/position-recommender/live-postings/policy.ts

# A. phase-01: SKILL.md ↔ prompt.md 14 라벨 정합 + 줄 수 상한 완화
for L in "후보자 경험 근거" "JD에서 노려야 할 키워드" "회사/규모 업사이드" "복지/학습 환경 판단" "기술블로그/엔지니어링 시그널" "사업/조직/seniority 리스크"; do
  grep -qF "$L" "$SKILL" || { echo "[A] FAIL: SKILL.md 라벨 누락 $L"; FAIL=1; }
  grep -qF "$L" "$PROMPT" || { echo "[A] FAIL: prompt.md 라벨 누락 $L"; FAIL=1; }
done
LEFT=$(grep -cF "30~70줄" "$SKILL")
echo "[A] 30~70줄 상한 잔존: $LEFT"
[ "$LEFT" = "0" ] || { echo "[A] FAIL: 줄 수 상한 문구 잔존"; FAIL=1; }
[ "$FAIL" = "0" ] && echo "[A] 문서 정합 OK"

# B. phase-02: 서버 필터 — 비서버 reject + 서버 keep
RESULT=$(bun -e '
import { isNonServerTitle, isServerRole } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const nonServer = ["Legal Counsel","Strategic Finance Manager","KYC/AML/Privacy Manager","SAP Developer","Technical Writer","Recruiting Partner"];
const server = ["Backend Engineer","Server Developer","Platform Engineer","DevOps Engineer","AI Platform Engineer"];
let bad = 0;
for (const t of nonServer) { if (!(isNonServerTitle(t) || !isServerRole(t))) bad++; }
for (const t of server) { if (!(!isNonServerTitle(t) && isServerRole(t))) bad++; }
console.log("BAD="+bad);
')
echo "[B] 서버 필터: $RESULT"
echo "$RESULT" | grep -q "BAD=0" || { echo "[B] FAIL: 필터 검증"; FAIL=1; }

# C. phase-03: 태그 변별력
TAG=$(bun -e '
import { classify } from "./career-os/scripts/position-recommender/live-postings/policy.ts";
const samples = [
  "토스뱅크 여신 시스템 Backend Engineer Spring Kafka 대출",
  "쿠팡 결제 정산 시스템 Server Developer payment settlement",
  "네이버 검색 플랫폼 OpenSearch vector RAG Engineer",
  "스타트업 Backend Engineer Spring Java REST API",
];
const sets = samples.map(s => classify(s).slice().sort().join(","));
console.log("DISTINCT="+new Set(sets).size);
')
echo "[C] 태그 변별력: $TAG"
DISTINCT=$(echo "$TAG" | grep -oE "DISTINCT=[0-9]+" | cut -d= -f2)
[ "${DISTINCT:-0}" -ge 3 ] || { echo "[C] FAIL: 태그 변별력 부족"; FAIL=1; }

# D. phase-04: 1회 수집 + requirements 채움
echo "[D] 수집 실행"
bun career-os/scripts/position-recommender/collect_live_postings.ts > /tmp/plan080_verify.log 2>&1 || echo "(수집 종료 코드 비0 — snapshot으로 판정)"
tail -15 /tmp/plan080_verify.log
SNAP=$(ls -t career-os/data/runtime/live-postings*.json career-os/data/runtime/position-recommendation/*.json 2>/dev/null | head -1)
[ -z "$SNAP" ] && SNAP=$(grep -oE "career-os/data[^ ]+\.json" /tmp/plan080_verify.log | head -1)
echo "[D] snapshot: $SNAP"
if [ -n "$SNAP" ] && [ -f "$SNAP" ]; then
  D=$(bun -e '
const fs=require("fs");
const raw=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const arr=Array.isArray(raw)?raw:(raw.postings||raw.items||[]);
const tgt=arr.filter(p=>["toss-careers","coupang-careers","kakaomobility"].includes(p.source));
const filled=tgt.filter(p=>(p.requirements||"").trim().length>20 && !/상세 페이지 확인 필요|추정/.test(p.requirements||""));
const nonServerLeak=arr.filter(p=>/legal counsel|recruiting partner|technical writer|sap developer/i.test(p.title||""));
console.log("TARGET="+tgt.length+" FILLED="+filled.length+" LEAK="+nonServerLeak.length);
' "$SNAP")
  echo "[D] $D"
  TGT=$(echo "$D" | grep -oE "TARGET=[0-9]+" | cut -d= -f2)
  CNT=$(echo "$D" | grep -oE "FILLED=[0-9]+" | cut -d= -f2)
  LEAK=$(echo "$D" | grep -oE "LEAK=[0-9]+" | cut -d= -f2)
  if [ "${TGT:-0}" -gt 0 ] && [ "${CNT:-0}" -eq 0 ]; then echo "[D] FAIL: requirements 채움 0(대상 수집됨)"; FAIL=1; fi
  if [ "${LEAK:-0}" -gt 0 ]; then echo "[D] FAIL: 비서버 직무 누수 $LEAK건"; FAIL=1; fi
else
  echo "[D] WARN: snapshot 미발견 — 네트워크 차단 가능, 코드 검증(B/C)으로 판정"
fi

# 종합
if [ "$FAIL" = "0" ]; then echo "✅ 통합 검증 전부 통과"; else echo "❌ 통합 검증 실패 — 위 FAIL 항목 확인"; rm -f /tmp/plan080_verify.log; exit 1; fi
rm -f /tmp/plan080_verify.log
```

## index.json status 마킹

검증이 전부 통과한 뒤에만 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p = "career-os/tasks/plan080-position-recommender-quality/index.json"
ts = subprocess.check_output(["bash","-lc","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
ts = ts[:-2] + ":" + ts[-2:]
d = json.load(open(p))
d["status"] = "completed"
d["current_phase"] = 5
d["updated_at"] = ts
for ph in d["phases"]:
    ph["status"] = "completed"
open(p, "w").write(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print("index.json status=completed 마킹 완료")
PY
```

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/tasks/plan080-position-recommender-quality/index.json
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
chore(career-os): plan080 position-recommender 품질 개선 통합 검증 + status 마킹

- phase-01~04 통합 검증 통과(문서 정합·서버 필터·태그 변별력·requirements 채움)
- index.json status=completed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1

# 마지막 phase: working tree 잔여 확인. push는 하지 않는다.
echo "[working tree 잔여]"
git status --porcelain | head
```

## 의도 메모 (왜)

- 검증 전용 phase를 분리한 이유 — 문서 정합·서버 필터·태그·detail fetch는 검증 단위가 다르다. 4개 개선이 일관된 최종 상태를 만들었는지 한 번에 확인한다.
- 1회 수집을 검증에 넣는 이유 — career-os는 shadow 관찰 기간을 두지 않으므로(AGENTS.md), 실제 수집 결과로 비서버 누수·requirements 채움을 즉시 본다. 네트워크 차단 시 정적 검증(B/C)으로 판정한다.
- push를 하지 않는 이유 — 별도 worktree+branch 실행 전제. push와 plan 단위 PR은 메인 세션이 전체 diff를 review한 뒤 처리한다(career-os 운영 원칙).

## Blocked 조건

- 통합 검증의 어느 항목이라도 FAIL이면 status 마킹 없이 `PHASE_FAILED: <항목> 검증 실패 — 해당 phase 재실행 필요` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다. 이 phase에서 직접 산출물을 고치지 않는다(검증 전용).
