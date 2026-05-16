# Phase 4 — 정적 검증 + push + trailing + index.json completed

**Model**: sonnet
**Status**: pending

---

## 목표

plan023 누적 결과 정적 검증. 모든 commit push + index.json completed + trailing.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

git log -1 --format='%s' | grep -q "plan023 phase-03" \
  || { echo "PHASE_BLOCKED: phase-03 commit 없음"; exit 2; }

[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. 정적 검증

```bash
cd /home/bifos/ai-nodes

# A. command-router 디렉터리 부재
test ! -d career-os/scripts/command-router \
  || { echo "PHASE_FAILED: scripts/command-router 잔존"; exit 1; }
test ! -d career-os/.claude/skills/command-router \
  || { echo "PHASE_FAILED: .claude/skills/command-router 잔존"; exit 1; }
echo "[A] command-router 부재 OK"

# B. _shared/lib 2개 부재
test ! -f _shared/lib/invoke_claude_skills.ts \
  || { echo "PHASE_FAILED: invoke_claude_skills.ts 잔존"; exit 1; }
test ! -f _shared/lib/format_cost_summary.ts \
  || { echo "PHASE_FAILED: format_cost_summary.ts 잔존"; exit 1; }
echo "[B] _shared/lib 2개 부재 OK"

# C. career-os/scripts/_lib 5개 부재
for f in build_prompt extract_and_validate_study_pack fos_study_git resolve_study_pack_topic study_pack_publish; do
  test ! -f "career-os/scripts/_lib/$f.ts" \
    || { echo "PHASE_FAILED: career-os/scripts/_lib/$f.ts 잔존"; exit 1; }
done
echo "[C] career-os/scripts/_lib 5개 부재 OK"

# D. career-os 안 dispatcher caller 0 (history mention 제외)
HITS=$(grep -rln "scripts/command-router\|run_now\.sh" \
  career-os/.claude/skills/ career-os/scripts/ _shared/ 2>/dev/null | wc -l)
[ "$HITS" = "0" ] || { echo "PHASE_FAILED: dispatcher caller $HITS 잔존"; \
  grep -rln "scripts/command-router\|run_now\.sh" career-os/.claude/skills/ career-os/scripts/ _shared/ 2>/dev/null; exit 1; }
echo "[D] dispatcher caller 0 OK"

# E. 폐기 ts lib caller 0
for kw in "invoke_claude_skills" "format_cost_summary" \
          "build_prompt\.ts\|build_prompt'" "extract_and_validate_study_pack" \
          "fos_study_git" "resolve_study_pack_topic" "study_pack_publish"; do
  HITS=$(grep -rlE "$kw" career-os/.claude/skills/ career-os/scripts/ _shared/lib/ 2>/dev/null | wc -l)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: '$kw' caller $HITS 잔존"; exit 1; }
done
echo "[E] 폐기 ts lib caller 0 OK"

# F. apartment + stock-investment track_task.sh 사용 (격리 유지 — 폐기 안 함)
test -f _shared/bin/track_task.sh \
  || { echo "PHASE_FAILED: track_task.sh 누락 (apartment 영향)"; exit 1; }
APT_HITS=$(grep -rln "track_task\.sh" apartment/ 2>/dev/null | wc -l)
[ "$APT_HITS" -gt 0 ] || { echo "PHASE_FAILED: apartment에서 track_task.sh 사용 0 — 정합성 의심"; exit 1; }
echo "[F] track_task.sh 유지 + apartment 사용 확인 OK"

# G. tsc 통과
bunx tsc --noEmit 2>&1 | tee /tmp/plan023-phase04-tsc.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: tsc"; cat /tmp/plan023-phase04-tsc.log; exit 1; }
echo "[G] tsc OK"

# H. AGENTS.md + 5문서 갱신 확인
grep -q "native skill 진입점" career-os/AGENTS.md \
  || { echo "PHASE_FAILED: AGENTS.md native 안내 누락"; exit 1; }
echo "[H] AGENTS.md 갱신 OK"

# I. plan023 phase commit history
PLAN_COMMITS=$(git log --oneline | grep -c "plan023 phase-")
[ "$PLAN_COMMITS" -ge 3 ] || { echo "PHASE_FAILED: plan023 commit $PLAN_COMMITS (expected ≥3)"; exit 1; }
echo "[I] commit history OK"

echo "=== 정적 검증 전부 통과 ==="
```

### 2. index.json status=completed

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path
p = Path("career-os/tasks/plan023-command-router-and-ts-lib-cleanup/index.json")
d = json.loads(p.read_text(encoding="utf-8"))
d["status"] = "completed"
d["current_phase"] = 4
for ph in d["phases"]:
    ph["status"] = "completed"
p.write_text(json.dumps(d, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("[index.json] completed")
PY
```

### 3. 최종 commit + push

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/tasks/plan023-command-router-and-ts-lib-cleanup/index.json

git commit -m "$(cat <<'COMMIT_EOF'
task(career-os): plan023 index.json status=completed (phase-04)

plan023 단계 1~4 통과:
- phase-01: command-router 디렉터리 폐기 (scripts + .claude/skills)
- phase-02: ts lib 7개 폐기 (_shared/lib 2개 + career-os/scripts/_lib 5개) +
  types 정리
- phase-03: 5문서 + AGENTS.md 갱신 (dispatcher 폐기 명시 + 외부 의존성
  간소화)
- phase-04: 정적 검증 9 항목 통과

정적 검증:
- command-router 부재 + ts lib 7개 부재
- dispatcher caller 0 + 폐기 ts lib caller 0
- track_task.sh 유지 (apartment 사용 중)
- tsc 통과
- AGENTS.md native 진입점 7개 안내
- plan023 phase commit ≥3

career-os dispatcher 시대 완전 종료. native skill 진입점 7개 단일화.
다음 plan024 (별도 워크스페이스 cleanup) 후보:
- apartment + stock-investment 5 caller가 extract_claude_result.py 사용 중
- 별도 워크스페이스 세션 + gh auth 후 GitHub issue 생성 (사용자 명시)
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }

git push origin main || { echo "PHASE_FAILED: push"; exit 1; }
echo "[3] commit + push OK"
```

### 4. trailing cleanup

```bash
cd /home/bifos/ai-nodes
if [ -n "$(git status --porcelain career-os/tasks/plan023-command-router-and-ts-lib-cleanup/index.json)" ]; then
  git add career-os/tasks/plan023-command-router-and-ts-lib-cleanup/index.json
  git commit -m "task(career-os): plan023 index.json commitSha 후기록"
  git push origin main
fi

DIRTY=$(git status --porcelain career-os/tasks/plan023-command-router-and-ts-lib-cleanup/ | wc -l)
[ "$DIRTY" = "0" ] || { echo "PHASE_FAILED: trailing dirty"; exit 1; }
echo "trailing cleanup OK"
```

## 사용자 직접 처리 안내 (phase 외)

```bash
# 모든 native skill 호출 (dispatcher 없이 직접)
claude -p "/study-pack-writer <topic>"
claude -p "/interview-asset-writer <topic>"
claude -p "/study-topic-recommender"
claude -p "/interview-prep-analyzer"
claude -p "/candidate-baseline-suggester"
claude -p "/interview-coffeechat-prep"
claude -p "/position-recommender"

# 외부 cron / openclaw 진입점도 모두 native invoke로 갱신 필요
```

## Blocked 조건

- phase-03 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- branch != main → `PHASE_BLOCKED` + `exit 2`
- 정적 검증 A~I 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED` + `exit 1`
- push 실패 → `PHASE_FAILED` + `exit 1`
- trailing dirty → `PHASE_FAILED` + `exit 1`

## 의도 메모

- *career-os dispatcher 시대 완전 종료* — 본 plan023이 이정표.
- apartment + stock-investment 정리는 *별도 워크스페이스 세션* (사용자 명시).
