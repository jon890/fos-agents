# Phase 2 — 통합 검증 + status=completed + push

travel plan002 phase-02 (마지막). phase-01 산출 검증, index.json status=completed, origin/main push.

## 작업 위치

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 검증 절차

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. phase-01 commit 존재
P1="$(git log --format='%H' --grep='travel.*plan002 phase-01\|ADR-002.*ADR-001 부분 supersede' -n 1 | cut -c1-12)"
test -n "$P1" || (echo "PHASE_FAILED: phase-01 commit 누락" && exit 1)
echo "[phase-01 SHA] $P1"

# 2. .env / .env.example
test -f travel/.env
grep -q "^DISCORD_CHANNEL_ID=1498642302602580029" travel/.env
test -f travel/.env.example
test -z "$(git ls-files travel/.env)"
echo "[.env 정합] OK"

# 3. ADR-002 본문
grep -q "^## ADR-002" travel/docs/adr.md
grep -q "supersedes ADR-001\|부분 supersede" travel/docs/adr.md
echo "[ADR-002] OK"

# 4. matrix travel .env O (workspace-structure)
grep -qE "\.env \(workspace root\) \| O \| O \| O \| O" docs/workspace-structure.md
echo "[matrix travel .env O] OK"

# 5. 비대칭 부재 영역 유지 (ADR-001)
test ! -d travel/scripts
test ! -d travel/.claude
test ! -d travel/config
echo "[ADR-001 영역 부재 유지] OK"

# 6. trip-instance + index 보존
test -d travel/trips/osaka-2026-05
test -f travel/docs/index.md
echo "[trip + index 보존] OK"

# 7. docs-style § 0
! grep -n "§" travel/AGENTS.md travel/docs/*.md docs/workspace-structure.md
echo "[section mark 0] OK"
```

## index.json 갱신

```bash
cd "$(git rev-parse --show-toplevel)"
P1="$(git log --format='%H' --grep='travel.*plan002 phase-01\|ADR-002.*ADR-001 부분 supersede' -n 1 | cut -c1-12)"
test -n "$P1" || (echo "PHASE_FAILED: SHA 추출 실패" && exit 1)
```

`travel/tasks/plan002-env-introduction/index.json` Edit:
- `updated_at` → 현재 ISO-8601 UTC.
- `status` → `"completed"`.
- `current_phase` → `2`.
- `phases[0].status` → `"completed"`, `phases[0].commitSha` 추가.
- `phases[1].status` → `"completed"` (commitSha trailing cleanup).

## commit + push

```bash
cd "$(git rev-parse --show-toplevel)"
git add travel/tasks/plan002-env-introduction/index.json

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0.

git commit -m "task(travel): plan002 status=completed (phase-02) — .env 도입 완료

- phase-01 commitSha 후기록
- ADR-002 신설 (.env 도입, ADR-001 부분 supersede)
- travel/.env + .env.example
- ai-nodes/docs/workspace-structure 매트릭스 travel .env N/A → O

5 워크스페이스 .env 컬럼 모두 O — 모노레포 일관성 완성.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

## 금지 사항

- 신규 파일 생성 (index.json Edit만).
- phase-01 산출 수정.
- scripts/.claude/skills/config 신설 (ADR-001 영역 유지).
- 다른 워크스페이스 파일 stage.
- amend / force push.

## PHASE_BLOCKED / PHASE_FAILED

- phase-01 commit 누락 — `PHASE_FAILED: phase-01 누락 또는 cross-session race`.
- 검증 2-6 fail — `PHASE_FAILED: 정합 부실`.
- 의도 외 staged 파일 — `PHASE_BLOCKED`.
- push 거절 — `PHASE_BLOCKED`.
