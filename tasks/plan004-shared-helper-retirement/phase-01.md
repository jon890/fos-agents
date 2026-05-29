# Phase 01 — 3 공용 헬퍼 git rm + ClaudeUsage 타입 제거

**Model**: sonnet
**Status**: pending

---

## 목표

native 전환 완료로 호출처가 0이 된 죽은 공용 헬퍼 3개를 git rm하고, extract 전용 orphan 타입을 제거한다(ADR-011).

폐기 대상:

- `_shared/bin/track_task.sh`
- `_shared/bin/update_artifacts.py`
- `_shared/lib/extract_claude_result.ts`
- `_shared/types/index.ts`의 `ClaudeUsage` interface + 관련 주석 (extract 전용 orphan)

**범위 외**:

- `_shared/types/index.ts`의 `TopicEntry` interface — career-os가 사용. **유지**.
- `_shared/lib/notify_discord.ts` — 사용 중. 유지.
- brain task-run-tracking 페이지 삭제 — 별도 repo, 본 plan 밖.
- 잔재 grep 최종 검증 + 타입체크 — phase-02.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace로 실행하지만 본 plan은 모노레포 루트 plan(tasks/)이라 cwd가 이미 ai-nodes 루트일 수 있다. 안전하게 첫 bash에서 루트 고정.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs (실행 전 Read)

- `docs/adr.md` ADR-011 — 폐기 결정·전수 확인 결과.
- `_shared/types/index.ts` — ClaudeUsage(제거) vs TopicEntry(유지) 경계 확인.

---

## 작업 항목 (3)

### 1. git rm 전 호출처 0 재확인 (안전 가드)

폐기 직전 코드 호출처가 0인지 다시 확인한다(주석 참조는 무관).

```bash
cd "$(git rev-parse --show-toplevel)"
CALLERS=$(grep -rlE "track_task|extract_claude_result|update_artifacts" \
  --include="*.sh" --include="*.ts" --include="*.py" --include="*.json" . 2>/dev/null \
  | grep -v "/tasks/" | grep -v "/docs/" | grep -v ".git/" \
  | grep -vE "_shared/(bin/track_task\.sh|bin/update_artifacts\.py|lib/extract_claude_result\.ts)" \
  | grep -v "_shared/types/index.ts")
echo "[코드 호출처(주석·자기파일 제외)] '$CALLERS'"
# workspace-audit run_audit.sh 의 'track_task' 는 주석(설명)이라 무관 — 코드 호출이면 PHASE_BLOCKED
if echo "$CALLERS" | grep -q "run_audit.sh"; then
  if grep -nE "(bash|exec|sh|source|\.) .*track_task" skills/workspace-audit/scripts/run_audit.sh; then
    echo "PHASE_BLOCKED: run_audit.sh가 track_task를 실제 호출 — 폐기 전 사용자 확인 필요"; exit 2
  fi
fi
echo "OK: 실제 코드 호출처 없음 (주석만 잔존)"
```

PHASE_BLOCKED는 반드시 Bash 도구로 위 블록을 실행해 `exit 2`로 종료한다. prose만 출력하면 success로 잘못 처리된다.

### 2. 3 파일 git rm

```bash
cd "$(git rev-parse --show-toplevel)"
git rm _shared/bin/track_task.sh _shared/bin/update_artifacts.py _shared/lib/extract_claude_result.ts
```

### 3. ClaudeUsage 타입 + 주석 제거

`_shared/types/index.ts`에서 `ClaudeUsage` interface 블록과 그 위 JSDoc 주석(`claude --print --output-format json 의 envelope ...`)을 Edit로 제거한다.
파일 상단 `// _shared/types/index.ts` + `// 공용 TS 타입` 주석과 `TopicEntry` interface는 그대로 둔다.
TopicEntry 위의 JSDoc 주석도 유지.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `_shared/bin/track_task.sh` | git rm |
| `_shared/bin/update_artifacts.py` | git rm |
| `_shared/lib/extract_claude_result.ts` | git rm |
| `_shared/types/index.ts` | ClaudeUsage interface + 주석 제거 (TopicEntry 유지) |

## 커밋 (검증 통과 후)

`git add -A` 금지. push 안 함.

```bash
cd "$(git rev-parse --show-toplevel)"
git add _shared/types/index.ts
# git rm은 이미 스테이징됨 — 명시 add는 types만
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged] $STAGED (기대 4: rm 3 + types 수정 1)"
git diff --cached --name-only
[ "$STAGED" -eq 4 ] || { echo "PHASE_FAILED: staged 파일 수 불일치"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
refactor(_shared): track_task·update_artifacts·extract_claude_result 폐기 (ADR-011)

- native 전환 완료로 호출처 0 — 3 공용 헬퍼 git rm
- _shared/types/index.ts ClaudeUsage interface 제거 (extract 전용 orphan), TopicEntry 유지

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

보고 직전 반드시 Bash 도구로 실행하고 값 그대로 출력.

```bash
cd "$(git rev-parse --show-toplevel)"
# 3 파일 폐기 확인
for f in _shared/bin/track_task.sh _shared/bin/update_artifacts.py _shared/lib/extract_claude_result.ts; do
  [ ! -f "$f" ] && echo "[폐기] $f OK" || { echo "PHASE_FAILED: $f 잔존"; exit 1; }
done
# ClaudeUsage 제거 + TopicEntry 유지
! grep -q "ClaudeUsage" _shared/types/index.ts && echo "[ClaudeUsage 제거] OK" || { echo "PHASE_FAILED: ClaudeUsage 잔존"; exit 1; }
grep -q "TopicEntry" _shared/types/index.ts && echo "[TopicEntry 유지] OK" || { echo "PHASE_FAILED: TopicEntry 소실"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

PHASE_FAILED 시 반드시 Bash 도구로 위 블록 실행해 exit 1.

## 의도 메모 (왜)

- ADR-011 — native 전환 완료 후 죽은 공용 헬퍼 폐기. git history로 복원 가능.
- ClaudeUsage는 extract 전용 orphan(내 변경이 만든 미사용) → 함께 제거. TopicEntry는 career-os 사용 → 보존.
- 안전 가드(작업 1)로 run_audit.sh 주석 참조가 실제 호출이 아님을 재확인.
