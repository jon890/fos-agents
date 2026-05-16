# Phase 2 — ts lib 일괄 폐기 (_shared/lib 2개 + career-os/scripts/_lib 5개 + types 정리)

**Model**: sonnet
**Status**: pending

---

## 목표

caller 0 도달한 ts lib 일괄 폐기 + `_shared/types/index.ts` 관련 타입 정리.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

git log -1 --format='%s' | grep -q "plan023 phase-01" \
  || { echo "PHASE_BLOCKED: phase-01 commit 없음"; exit 2; }

# command-router 폐기 확인
test ! -d career-os/scripts/command-router \
  || { echo "PHASE_BLOCKED: phase-01 미완 — command-router 잔존"; exit 2; }

# 폐기 대상 존재
for f in _shared/lib/invoke_claude_skills.ts _shared/lib/format_cost_summary.ts; do
  test -f "$f" || { echo "PHASE_BLOCKED: $f 이미 부재"; exit 2; }
done
for f in build_prompt extract_and_validate_study_pack fos_study_git resolve_study_pack_topic study_pack_publish; do
  test -f "career-os/scripts/_lib/$f.ts" \
    || { echo "PHASE_BLOCKED: career-os/scripts/_lib/$f.ts 이미 부재"; exit 2; }
done

echo "사전 검증 OK"
```

## 작업 항목

### 1. caller 0 최종 재확인 (안전망)

```bash
cd /home/bifos/ai-nodes

# _shared/lib 2개 caller (career-os/* + apartment + stock-investment + travel — 활성 코드만)
for kw in "invoke_claude_skills" "format_cost_summary"; do
  HITS=$(grep -rln "$kw" career-os/scripts/ career-os/.claude/skills/ apartment/skills/ stock-investment/skills/ travel/skills/ _shared/ 2>/dev/null | \
    grep -v "tasks/plan\|__pycache__\|_shared/lib/$kw\|_shared/types/index" | wc -l)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: $kw caller $HITS 잔존"; \
    grep -rln "$kw" career-os/scripts/ career-os/.claude/skills/ apartment/skills/ stock-investment/skills/ travel/skills/ _shared/ 2>/dev/null | grep -v "tasks/plan\|__pycache__\|_shared/lib/$kw\|_shared/types/index"; exit 1; }
done
echo "[1-A] _shared/lib 2개 caller 0 OK"

# career-os/scripts/_lib 5 파일 caller
for f in build_prompt extract_and_validate_study_pack fos_study_git resolve_study_pack_topic study_pack_publish; do
  HITS=$(grep -rln "$f" career-os/scripts/ career-os/.claude/skills/ _shared/ 2>/dev/null | \
    grep -v "tasks/plan\|__pycache__\|career-os/scripts/_lib/$f" | wc -l)
  [ "$HITS" = "0" ] || { echo "PHASE_FAILED: $f caller $HITS 잔존"; \
    grep -rln "$f" career-os/scripts/ career-os/.claude/skills/ _shared/ 2>/dev/null | grep -v "tasks/plan\|__pycache__\|career-os/scripts/_lib/$f"; exit 1; }
done
echo "[1-B] career-os/scripts/_lib 5개 caller 0 OK"
```

### 2. _shared/lib 2개 폐기

```bash
cd /home/bifos/ai-nodes
git rm _shared/lib/invoke_claude_skills.ts _shared/lib/format_cost_summary.ts
echo "[2] _shared/lib 2개 폐기 OK"
```

### 3. career-os/scripts/_lib 5 파일 일괄 폐기

```bash
cd /home/bifos/ai-nodes
git rm career-os/scripts/_lib/build_prompt.ts \
       career-os/scripts/_lib/extract_and_validate_study_pack.ts \
       career-os/scripts/_lib/fos_study_git.ts \
       career-os/scripts/_lib/resolve_study_pack_topic.ts \
       career-os/scripts/_lib/study_pack_publish.ts

# 디렉터리가 비면 rmdir
if [ -z "$(ls -A career-os/scripts/_lib/ 2>/dev/null)" ]; then
  rmdir career-os/scripts/_lib/
  echo "[3-A] 빈 career-os/scripts/_lib/ 제거"
fi

echo "[3] career-os/scripts/_lib 5 파일 폐기 OK"
```

### 4. _shared/types/index.ts 관련 타입 정리

`Read` 도구로 `_shared/types/index.ts` 로드. `Edit` 도구로 `ClaudeUsage` + `TaskRunEntry` 인터페이스 (또는 관련 주석/타입) 제거.

이 타입들은 `invoke_claude_skills.ts` + `format_cost_summary.ts` + `track_task.sh`가 사용. track_task.sh는 apartment에서 사용 중이라 `TaskRunEntry` 타입이 *다른 caller* 있는지 추가 확인 후 결정:

```bash
cd /home/bifos/ai-nodes
echo "=== TaskRunEntry + ClaudeUsage 사용 위치 ==="
for kw in "TaskRunEntry" "ClaudeUsage"; do
  echo "--- $kw ---"
  HITS=$(grep -rln "$kw" career-os/ apartment/ stock-investment/ travel/ _shared/ 2>/dev/null | \
    grep -v "tasks/plan\|__pycache__\|_shared/types/index" | head -10)
  echo "$HITS"
done
```

caller 0이면 두 타입 모두 제거. caller 있으면 *살아있는 caller 명시*하고 유지 (보고).

### 5. tsc 검증

```bash
cd /home/bifos/ai-nodes
bunx tsc --noEmit 2>&1 | tee /tmp/plan023-phase02-tsc.log
[ "${PIPESTATUS[0]}" -eq 0 ] || { echo "PHASE_FAILED: tsc"; cat /tmp/plan023-phase02-tsc.log; exit 1; }
echo "[5] tsc OK"
```

### 6. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add _shared/lib/ _shared/types/ career-os/scripts/_lib/ 2>/dev/null || true

git commit -m "$(cat <<'COMMIT_EOF'
chore(_shared, career-os): ts lib 7개 일괄 폐기 + types 정리 (plan023 phase-02)

ADR-031 적용. plan021/022 cleanup 잔재 일괄 정리.

폐기 (caller 0 도달):
- _shared/lib/invoke_claude_skills.ts
- _shared/lib/format_cost_summary.ts
- career-os/scripts/_lib/build_prompt.ts
- career-os/scripts/_lib/extract_and_validate_study_pack.ts
- career-os/scripts/_lib/fos_study_git.ts
- career-os/scripts/_lib/resolve_study_pack_topic.ts
- career-os/scripts/_lib/study_pack_publish.ts

_shared/types/index.ts: ClaudeUsage + TaskRunEntry 관련 타입/주석 정리
(살아있는 caller에 따라 조정 — track_task.sh는 apartment 사용 중이라
TaskRunEntry는 *외부 caller* 있을 경우 보존).

tsc 통과.

career-os/scripts/_lib 빈 디렉터리 제거.
phase-03에서 5문서 + AGENTS.md 갱신 (외부 의존성 섹션 등).
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }
echo "[6] commit 1 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `_shared/lib/invoke_claude_skills.ts` | git rm |
| `_shared/lib/format_cost_summary.ts` | git rm |
| `career-os/scripts/_lib/build_prompt.ts` | git rm |
| `career-os/scripts/_lib/extract_and_validate_study_pack.ts` | git rm |
| `career-os/scripts/_lib/fos_study_git.ts` | git rm |
| `career-os/scripts/_lib/resolve_study_pack_topic.ts` | git rm |
| `career-os/scripts/_lib/study_pack_publish.ts` | git rm |
| `career-os/scripts/_lib/` | rmdir (빈) |
| `_shared/types/index.ts` | 관련 타입 정리 |

## Blocked 조건

- phase-01 commit 없음 → `PHASE_BLOCKED` + `exit 2`
- command-router 잔존 → `PHASE_BLOCKED: phase-01 미완` + `exit 2`
- 폐기 대상 이미 부재 → `PHASE_BLOCKED: 부분 실행 의심` + `exit 2`
- caller 0 재확인 실패 → `PHASE_FAILED: caller 잔존` + `exit 1`
- tsc 실패 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED` + `exit 1`

## 의도 메모

- caller 0 *재확인*이 안전망 — plan021/022 phase별 실행 결과 검증.
- TaskRunEntry는 apartment 사용 가능성으로 *조건부 제거* — 외부 caller 명시 grep 후 결정.
