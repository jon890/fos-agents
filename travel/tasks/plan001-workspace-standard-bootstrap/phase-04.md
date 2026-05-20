# Phase 4 — 통합 검증 + status=completed + push

travel plan001 phase-04 (마지막). phase-01~03 산출 검증, index.json status=completed, origin/main push.

## 작업 위치

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 검증 절차

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 3 phase commit
P1="$(git log --format='%H' --grep='travel.*plan001 phase-01\|5문서 신설.*travel\|travel.*5문서 신설' -n 1 | cut -c1-12)"
P2="$(git log --format='%H' --grep='travel.*plan001 phase-02\|AGENTS.md 한글화.*travel\|travel.*AGENTS' -n 1 | cut -c1-12)"
P3="$(git log --format='%H' --grep='travel.*plan001 phase-03\|workspace-structure travel\|travel 매트릭스' -n 1 | cut -c1-12)"
test -n "$P1" -a -n "$P2" -a -n "$P3" || (echo "PHASE_FAILED: phase commit 누락 — P1=$P1 P2=$P2 P3=$P3" && exit 1)
echo "[3 phase commit] P1=$P1 P2=$P2 P3=$P3"

# 2. 5문서 정합
for f in prd data-schema flow code-architecture adr; do
  test -s "travel/docs/$f.md"
  LINES=$(wc -l < "travel/docs/$f.md")
  test "$LINES" -ge 25 || (echo "PHASE_FAILED: $f.md $LINES 라인 부실" && exit 1)
done
grep -q "^## ADR-001" travel/docs/adr.md
grep -q "의도된 비대칭" travel/docs/adr.md
echo "[5문서 + ADR-001] OK"

# 3. AGENTS / CLAUDE 정합
LINES=$(wc -l < travel/AGENTS.md)
test "$LINES" -ge 70 || (echo "PHASE_FAILED: AGENTS $LINES 부실" && exit 1)
test -L travel/CLAUDE.md
readlink travel/CLAUDE.md | grep -q "^AGENTS.md$"
echo "[AGENTS + CLAUDE] OK"

# 4. 의도된 비대칭 부재 확인 — scripts/.claude/skills/.env/config
test ! -d travel/scripts
test ! -d travel/.claude
test ! -f travel/.env
test ! -d travel/config
echo "[의도된 비대칭 부재 정합] OK"

# 5. trip-instance + index.md 보존
test -d travel/trips/osaka-2026-05
test -f travel/docs/index.md
echo "[trip + index.md 보존] OK"

# 6. workspace-structure travel 매트릭스 ? 0
TR_QM=$(grep -E "^\| (AGENTS|CLAUDE|docs/ 5문서|tasks/plan|skills/ 분리|\.claude/skills/|\.env|data/ vs docs/)" docs/workspace-structure.md | awk -F '|' '{print $6}' | grep -c "?")
test "$TR_QM" -eq 0 || (echo "PHASE_FAILED: travel 매트릭스 ? $TR_QM" && exit 1)
echo "[매트릭스 travel ? 0] OK"

# 7. L181 안내 정합
grep -q "5 워크스페이스 모두 표준 적용 완료\|travel plan001" docs/workspace-structure.md
echo "[L181 안내] OK"

# 8. docs-style § 사용 0
! grep -n "§" travel/AGENTS.md travel/docs/*.md docs/workspace-structure.md AGENTS.md
echo "[section mark 0] OK"
```

## index.json 갱신

```bash
cd "$(git rev-parse --show-toplevel)"

P1="$(git log --format='%H' --grep='travel.*plan001 phase-01\|5문서 신설.*travel\|travel.*5문서 신설' -n 1 | cut -c1-12)"
P2="$(git log --format='%H' --grep='travel.*plan001 phase-02\|AGENTS.md 한글화.*travel\|travel.*AGENTS' -n 1 | cut -c1-12)"
P3="$(git log --format='%H' --grep='travel.*plan001 phase-03\|workspace-structure travel\|travel 매트릭스' -n 1 | cut -c1-12)"
echo "P1=$P1 P2=$P2 P3=$P3"
```

`travel/tasks/plan001-workspace-standard-bootstrap/index.json` Edit:
- `updated_at` → 현재 ISO-8601 UTC.
- `status` → `"completed"`.
- `current_phase` → `4`.
- `phases[0/1/2].status` → `"completed"`, 각 `commitSha` 추가.
- `phases[3].status` → `"completed"` (commitSha는 trailing cleanup).

## commit + push

```bash
cd "$(git rev-parse --show-toplevel)"
git add travel/tasks/plan001-workspace-standard-bootstrap/index.json

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0.

git commit -m "task(travel): plan001 status=completed (phase-04) — 표준 적용 완료

- phase-01/02/03 commitSha 후기록
- 5문서 신설 + travel ADR-001 (의도된 비대칭)
- AGENTS.md 한글화·강화 (16 → 70+ 라인) + CLAUDE.md 심링크
- ai-nodes workspace-structure travel 매트릭스 + 의도된 비대칭 표 갱신

5 워크스페이스 표준 적용 완료:
- apartment / career-os / stock-investment / health-care: ADR-006 분리 표준 + .claude/skills/ + .env 모두 적용
- travel: 5문서 + AGENTS + CLAUDE + tasks/ 적용 (ADR-001 의도된 비대칭으로 scripts/.claude/skills/.env/config 부재)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

## 금지 사항

- 신규 파일 생성 (index.json Edit만).
- phase-01/02/03 산출 수정.
- scripts/.claude/skills/.env/config 생성 (ADR-001 비대칭).
- 다른 워크스페이스 파일 stage.
- amend / force push.

## PHASE_BLOCKED / PHASE_FAILED

- phase 1-3 commit 누락 — `PHASE_FAILED: phase 누락 또는 cross-session race`.
- 검증 2-7 fail — `PHASE_FAILED: 정합 부실`.
- 의도 외 staged 파일 — `PHASE_BLOCKED`.
- push 거절 — `PHASE_BLOCKED`.
