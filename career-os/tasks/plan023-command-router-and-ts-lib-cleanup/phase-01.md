# Phase 1 — command-router 디렉터리 일괄 폐기

**Model**: sonnet
**Status**: pending

---

## 목표

plan022 완료 시점에 dispatcher case 0개 도달. command-router 디렉터리 (scripts + .claude/skills) 일괄 폐기.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# depends_on (plan021 + plan022) 완료 확인
test -f career-os/.claude/skills/interview-coffeechat-prep/SKILL.md \
  || { echo "PHASE_BLOCKED: plan021 미완 — interview-coffeechat-prep SKILL.md 부재"; exit 2; }
test -f career-os/scripts/position-recommender/collect_live_postings.ts \
  || { echo "PHASE_BLOCKED: plan022 미완 — collect_live_postings.ts 부재"; exit 2; }

# dispatcher case 0개 확인 (마지막 case 폐기됨)
CASES=$(grep -cE "^\s*[a-z-]+\)" career-os/scripts/command-router/run_now.sh 2>/dev/null || echo 0)
[ "$CASES" = "0" ] || { echo "PHASE_BLOCKED: dispatcher case $CASES (expected 0) — plan022 미완"; exit 2; }

# 폐기 대상 존재
test -d career-os/scripts/command-router \
  || { echo "PHASE_BLOCKED: command-router scripts 이미 부재"; exit 2; }
test -d career-os/.claude/skills/command-router \
  || { echo "PHASE_BLOCKED: command-router SKILL 이미 부재"; exit 2; }

# branch
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. command-router 디렉터리 일괄 git rm

```bash
cd /home/bifos/ai-nodes
git rm -r career-os/scripts/command-router/
git rm -r career-os/.claude/skills/command-router/

# 검증
test ! -d career-os/scripts/command-router \
  || { echo "PHASE_FAILED: scripts/command-router 잔존"; exit 1; }
test ! -d career-os/.claude/skills/command-router \
  || { echo "PHASE_FAILED: .claude/skills/command-router 잔존"; exit 1; }

echo "[1] command-router 디렉터리 폐기 OK"
```

### 2. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git commit -m "$(cat <<'COMMIT_EOF'
chore(career-os): command-router 디렉터리 일괄 폐기 (plan023 phase-01)

ADR-031 적용. plan022로 dispatcher case 0개 도달 — command-router 존재
의미 사라짐.

폐기:
- career-os/scripts/command-router/ (run_now.sh + setup_env.sh)
- career-os/.claude/skills/command-router/ (SKILL.md)

phase-02에서 ts lib 일괄 폐기 (_shared/lib 2개 + career-os/scripts/_lib 5개).
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }
echo "[2] commit 1 OK"
```

## Critical Files

| 파일/디렉터리 | 변경 |
|---|---|
| `career-os/scripts/command-router/` | git rm -r |
| `career-os/.claude/skills/command-router/` | git rm -r |

## Blocked 조건

- plan021/022 미완 → `PHASE_BLOCKED: depends_on` + `exit 2`
- dispatcher case ≠ 0 → `PHASE_BLOCKED` + `exit 2`
- 폐기 대상 부재 → `PHASE_BLOCKED: 부분 실행` + `exit 2`
- 검증 1 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED: commit 위장 의심` + `exit 1`

## 의도 메모

- 단순 폐기 phase — 6-6 위장 위험 낮음 (Bash git rm만).
