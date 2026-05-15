# Phase 5 — 정적 검증 + push + trailing cleanup + index.json completed 마킹

**Model**: sonnet
**Status**: pending

---

## 목표

plan017 phase-01~04 누적 결과의 종합 검증 (잔재 0 + tsc + bash -n + native skill 명세 + dispatcher 정합성). 모든 commit push + index.json status=completed 마킹 + trailing cleanup.

**범위 외**: 추가 코드/docs 변경.

## 관련 docs

- phase-04 commit — 5문서 + AGENTS.md + command-router SKILL.md 갱신 완료
- `skills/plan-and-build/references/common-pitfalls.md` 6-2 (trailing dirty)

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# 1-A. phase-04 commit 존재
git log -1 --format='%s' | grep -q "plan017 phase-04" \
  || { echo "PHASE_BLOCKED: phase-04 commit 없음"; exit 2; }

# 1-B. branch 확인
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch가 main 아님"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. 정적 검증

```bash
cd /home/bifos/ai-nodes

# A. knowledge-gap-analyzer 잔재 0 (코드 + .claude/skills, history mention은 docs 안에 OK)
for kw in "knowledge-gap-analyzer" "build_target_file_list\.py" "select_topic\.py" "update_study_progress\.py" \
          "run_baseline\.sh" "run_daily\.sh" "run_smoke_test\.sh"; do
  HITS=$(grep -rln "$kw" career-os/scripts/ career-os/.claude/skills/ _shared/ 2>/dev/null | grep -v "career-os/tasks/" | wc -l)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: '$kw' 코드 잔재 $HITS"; \
                          grep -rln "$kw" career-os/scripts/ career-os/.claude/skills/ _shared/ 2>/dev/null | grep -v "career-os/tasks/"; exit 1; }
done
echo "[A] knowledge-gap-analyzer 코드 잔재 0 OK"

# B. config/topics.json 잔재 0 (3 신 json으로 분리됨)
HITS=$(grep -rln "config/topics\.json" career-os/.claude/skills/ career-os/scripts/ _shared/ 2>/dev/null | grep -v "career-os/tasks/" | wc -l)
[ "$HITS" = "0" ] || { echo "PHASE_FAILED: config/topics.json 잔재 $HITS"; exit 1; }
test ! -f career-os/config/topics.json \
  || { echo "PHASE_FAILED: career-os/config/topics.json 파일 잔존"; exit 1; }
echo "[B] config/topics.json 잔재 0 OK"

# C. 3 신 json 존재
for f in study-pack-topics study-pack-candidates question-bank-topics; do
  test -f "career-os/config/$f.json" \
    || { echo "PHASE_FAILED: career-os/config/$f.json 미존재"; exit 1; }
done
echo "[C] 3 신 json 존재 OK"

# D. dispatcher syntax + baseline/daily/smoke case 0
bash -n career-os/scripts/command-router/run_now.sh \
  || { echo "PHASE_FAILED: dispatcher bash syntax"; exit 1; }
for c in "baseline" "daily" "smoke"; do
  HITS=$(grep -cE "^\s*$c\)" career-os/scripts/command-router/run_now.sh)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: dispatcher $c case 잔존"; exit 1; }
done
echo "[D] dispatcher syntax + baseline/daily/smoke case 0 OK"

# E. interview-prep-analyzer SKILL.md 필수 섹션
SKILL=career-os/.claude/skills/interview-prep-analyzer/SKILL.md
test -f "$SKILL" || { echo "PHASE_FAILED: SKILL.md 부재"; exit 1; }
for s in "When to use" "Inputs" "Workflow" "Self-check" "Error handling" "baseline" "daily"; do
  grep -q "$s" "$SKILL" || { echo "PHASE_FAILED: '$s' 누락"; exit 1; }
done
echo "[E] SKILL.md 필수 섹션 OK"

# F. tsc 통과
bunx tsc --noEmit 2>&1 | tee /tmp/plan017-phase05-tsc.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: tsc"; cat /tmp/plan017-phase05-tsc.log; exit 1; }
echo "[F] tsc OK"

# G. 옛 subprocess 시대 지시문 잔재 0 (common-pitfalls 6-7)
for kw in "Output only valid JSON" "Do not output markdown" "claude --json-schema"; do
  HITS=$(grep -rln "$kw" career-os/.claude/skills/interview-prep-analyzer/ 2>/dev/null | wc -l)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: 옛 subprocess 지시문 '$kw' 잔재"; exit 1; }
done
echo "[G] 옛 subprocess 지시문 잔재 0 OK"

# H. docs 갱신 확인
for d in prd flow code-architecture data-schema; do
  grep -q "interview-prep-analyzer" "career-os/docs/$d.md" \
    || { echo "PHASE_FAILED: docs/$d.md에 interview-prep-analyzer 안내 누락"; exit 1; }
done
echo "[H] docs 갱신 OK"

echo "=== 정적 검증 전부 통과 ==="
```

### 2. index.json status=completed 마킹

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path
p = Path("career-os/tasks/plan017-interview-prep-analyzer-native/index.json")
data = json.loads(p.read_text(encoding="utf-8"))
data["status"] = "completed"
data["current_phase"] = 5
for phase in data["phases"]:
    phase["status"] = "completed"
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("[index.json] marked completed")
PY
```

### 3. 최종 commit + push

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/tasks/plan017-interview-prep-analyzer-native/index.json

git commit -m "$(cat <<'COMMIT_EOF'
task(career-os): plan017 index.json status=completed (phase-05)

ADR-027 적용 완료. plan017 단계 1~5 모두 통과:
- phase-01: ts/SKILL.md draft 작성
- phase-02: topics.json → 3 json 분리 + 5 read 위치 갱신
- phase-03: interview-prep-analyzer SKILL.md 적용 + knowledge-gap-analyzer 폐기
- phase-04: 5문서 + AGENTS.md + command-router SKILL.md 갱신 + ASCII flow 박기
- phase-05: 정적 검증 통과 + index.json completed 마킹

정적 검증:
- knowledge-gap-analyzer 코드 잔재 0 (history mention 제외)
- config/topics.json 잔재 0 (3 신 json 분리 완료)
- dispatcher baseline/daily/smoke case 0
- SKILL.md 필수 섹션 7개 + native invoke 안내
- tsc 통과
- 옛 subprocess 지시문 잔재 0 (6-7)
- 5문서 interview-prep-analyzer 안내 추가

native 진입점 누적 4개: study-pack / interview-asset / study-topic-recommender
(plan016 진행 중) / interview-prep-analyzer (plan017).
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] \
  || { echo "PHASE_FAILED: 본 phase commit 수 $COMMITS (expected 1)"; exit 1; }

git push origin main || { echo "PHASE_FAILED: push"; exit 1; }
echo "[3] 최종 commit + push OK"
```

### 4. trailing cleanup (run-phases.py가 commitSha 후기록)

```bash
cd /home/bifos/ai-nodes
if [ -n "$(git status --porcelain career-os/tasks/plan017-interview-prep-analyzer-native/index.json)" ]; then
  git add career-os/tasks/plan017-interview-prep-analyzer-native/index.json
  git commit -m "task(career-os): plan017 index.json commitSha 후기록"
  git push origin main
fi

DIRTY=$(git status --porcelain career-os/tasks/plan017-interview-prep-analyzer-native/ | wc -l)
[ "$DIRTY" = "0" ] || { echo "PHASE_FAILED: trailing 후 dirty"; exit 1; }
echo "trailing cleanup OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan017-interview-prep-analyzer-native/index.json` | status=completed + commitSha 후기록 |

## 사용자 직접 처리 안내 (phase 외)

phase 종료 후 사용자가 환경에서 수행:

```bash
# 실제 native skill 동작 smoke
claude -p "/interview-prep-analyzer"                  # baseline 자동
claude -p "/interview-prep-analyzer 오늘 점검"         # daily 자연어
claude -p "/interview-prep-analyzer jpa-n+1"           # daily, 명시 토픽

# 산출물 확인:
#   data/reports/baseline/YYYY-MM-DD/report.md (baseline 모드)
#   data/reports/daily/YYYY-MM-DD/report.md (daily 모드)
#   data/study-progress.json 갱신 (daily 모드만)
```

## Blocked 조건

- phase-04 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- branch != main → `PHASE_BLOCKED` + `exit 2`
- 정적 검증 A~H 실패 → `PHASE_FAILED: <항목>` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED: commit 위장 의심` + `exit 1`
- push 실패 → `PHASE_FAILED: push` + `exit 1`
- trailing 후 dirty → `PHASE_FAILED: trailing 미완` + `exit 1`

## 의도 메모

- 정적 검증 8개 항목 — knowledge-gap-analyzer / topics.json / 3 신 json / dispatcher / SKILL.md / tsc / 6-7 / docs 모두 한 번에 통과 확인.
- 실제 동작 smoke는 사용자 환경에서 (fos-study 영향 없음 — baseline/daily는 외부 publish 안 함).
- trailing cleanup은 run-phases.py의 commitSha 후기록 처리 (common-pitfalls 6-2).
