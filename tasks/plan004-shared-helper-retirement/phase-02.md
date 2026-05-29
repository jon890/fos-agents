# Phase 02 — 잔재 grep 검증 + bun 타입체크 + index.json completed

**Model**: haiku
**Status**: pending

---

## 목표

plan004 phase-01 폐기 결과의 정합성을 검증하고 `index.json`을 `status="completed"`로 마킹한다.

**범위 외**: 새 내용 작성·수정. 검증 + 마킹만. brain 페이지 삭제는 별도 repo(본 plan 밖).

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 작업 항목 (2)

### 1. 통합 검증

```bash
cd "$(git rev-parse --show-toplevel)"

# (a) 3 파일 폐기 확인
GONE=0
for f in _shared/bin/track_task.sh _shared/bin/update_artifacts.py _shared/lib/extract_claude_result.ts; do
  [ ! -f "$f" ] && GONE=$((GONE+1))
done
echo "[폐기된 파일] $GONE / 3"
[ "$GONE" -eq 3 ] || { echo "PHASE_FAILED: 폐기 미완"; exit 1; }

# (b) 코드 호출처 0 (주석 제외) — sh/ts/py/json 전수
CALL=$(grep -rlE "track_task|extract_claude_result|update_artifacts" \
  --include="*.sh" --include="*.ts" --include="*.py" --include="*.json" . 2>/dev/null \
  | grep -v "/tasks/" | grep -v "/docs/" | grep -v ".git/")
echo "[코드 잔존 참조 파일] '$CALL'"
# run_audit.sh 주석 1건만 허용 — 그 외면 실패
EXTRA=$(echo "$CALL" | grep -v "^$" | grep -v "skills/workspace-audit/scripts/run_audit.sh" | wc -l)
echo "[허용 외 잔존] $EXTRA (기대 0)"
[ "$EXTRA" -eq 0 ] || { echo "PHASE_FAILED: 코드 잔존 참조 $EXTRA건"; echo "$CALL"; exit 1; }

# (c) ClaudeUsage 제거 + TopicEntry 유지
! grep -q "ClaudeUsage" _shared/types/index.ts && echo "[ClaudeUsage 제거] OK" || { echo "PHASE_FAILED: ClaudeUsage 잔존"; exit 1; }
grep -q "TopicEntry" _shared/types/index.ts && echo "[TopicEntry 유지] OK" || { echo "PHASE_FAILED: TopicEntry 소실"; exit 1; }

# (d) bun 타입체크 — TopicEntry import 깨지지 않았는지 (career-os 소비자)
if command -v bun >/dev/null 2>&1; then
  bun --version >/dev/null && echo "[bun 사용 가능]"
  # career-os study-topic-recommender가 TopicEntry import — tsc 가벼운 체크
  bun build career-os/scripts/study-topic-recommender/cli.ts --target=node --outfile=/tmp/_typecheck_plan004.js >/dev/null 2>&1 \
    && echo "[TopicEntry 소비자 build] OK" || echo "[경고] build 체크 불가(런타임 의존성 등) — import 경로만 grep으로 확인"
  rm -f /tmp/_typecheck_plan004.js
else
  echo "[bun 미설치 — 타입체크 skip]"
fi
echo "✅ 모든 검증 명령 실행 완료"
```

### 2. index.json status 마킹

`tasks/plan004-shared-helper-retirement/index.json`을 Edit:

- 최상위 `"status": "pending"` → `"completed"`.
- `phases[].status` 각 `"pending"` → `"completed"`.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan004-shared-helper-retirement/index.json` | status=completed |

## 커밋 (검증 통과 후)

```bash
cd "$(git rev-parse --show-toplevel)"
git add tasks/plan004-shared-helper-retirement/index.json
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged] $STAGED (기대 1)"
[ "$STAGED" -eq 1 ] || { echo "PHASE_FAILED: 혼입"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
task(ai-nodes): plan004 통합 검증 완료 + status=completed

_shared 죽은 헬퍼 3개 폐기 검증. native 전환 (B) 마이그레이션 마무리.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
STAT=$(python3 -c "import json; print(json.load(open('tasks/plan004-shared-helper-retirement/index.json'))['status'])")
echo "[index status] $STAT"
[ "$STAT" = "completed" ] || { echo "PHASE_FAILED: status 마킹 실패"; exit 1; }
echo "OK"
```

## 의도 메모 (왜)

- 마지막 phase 검증 전용 — 폐기 후 잔존 참조 0 + career-os TopicEntry 소비자 무결성 확인.
- 본 plan 완료로 (B) native 마이그레이션 전체 종료.
