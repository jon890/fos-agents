# Phase 2 — 통합 검증 + status=completed + push

ai-nodes plan001 phase-02 (마지막 phase). phase-01 산출 통합 검증, index.json `status=completed`로 갱신, origin/main push.

## 작업 위치 (cwd 정책)

run-phases.py가 본 phase를 `cwd=ai-nodes root` (모노레포 루트)로 실행한다. 모든 bash 블록 첫 줄은 다음으로 ai-nodes 루트 이동:

```bash
cd "$(git rev-parse --show-toplevel)"
```

## 관련 docs (먼저 읽기)

- `tasks/plan001-extract-claude-result-consolidation/index.json` — 본 task index.
- phase-01 산출 (4 runner + .py git rm).

## 검증 절차

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. phase-01 commit 분리 확인
git log --oneline -5
# phase-01 = "refactor(ai-nodes): extract_claude_result.py → .ts 통합 (plan001 phase-01)"
# 본 phase 시점 직전 commit이 phase-01이어야 함.

# 2. _shared/bin/extract_claude_result.py 부재
test ! -f _shared/bin/extract_claude_result.py || (echo "FAIL: .py 잔존" && exit 1)

# 3. _shared/lib/extract_claude_result.ts 존재 + 4 runner 호출자
test -f _shared/lib/extract_claude_result.ts || (echo "FAIL: .ts 부재" && exit 1)

CALLER_COUNT="$(grep -rln "extract_claude_result\.ts" apartment/scripts/ stock-investment/skills/ 2>&1 | wc -l)"
test "$CALLER_COUNT" -eq 4 || (echo "FAIL: .ts 호출자 $CALLER_COUNT (4 기대)" && exit 1)

# 4. .py 호출자 0 (apartment + stock-investment 한정)
PY_REF_COUNT="$(grep -rln "extract_claude_result\.py" apartment/scripts/ apartment/AGENTS.md apartment/docs/ apartment/.claude/ stock-investment/skills/ stock-investment/AGENTS.md stock-investment/docs/ 2>&1 | wc -l)"
test "$PY_REF_COUNT" -eq 0 || (echo "FAIL: apartment + stock-investment에 .py 참조 $PY_REF_COUNT" && exit 1)

# (career-os docs + ai-nodes task 파일은 *역사적 참조* — 검증 대상 아님)

# 5. 각 runner shell 구문
bash -n apartment/scripts/apartment-daily-report/run_report.sh
bash -n stock-investment/skills/current-issue-analysis/scripts/run_issue_report.sh
bash -n stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh
bash -n stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh

# 6. apartment smoke test 회귀 (네트워크 의존)
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

성공 기준: 1-5 모두 통과. 6은 네트워크 차단 시 PHASE_BLOCKED.

## index.json 갱신

phase-01 commitSha 후기록 + status 갱신.

```bash
cd "$(git rev-parse --show-toplevel)"

PHASE_01_SHA="$(git log --format='%H' --grep='plan001 phase-01' -n 1 | cut -c1-12)"

echo "phase-01 SHA = $PHASE_01_SHA"

test -n "$PHASE_01_SHA" || (echo "PHASE_FAILED: phase commitSha 추출 실패" && exit 1)
```

`tasks/plan001-extract-claude-result-consolidation/index.json` Edit:

- `updated_at` → 현재 ISO-8601 UTC.
- `status` → `"completed"`.
- `current_phase` → `2`.
- `phases[0].status` → `"completed"`, `phases[0].commitSha` 추가.
- `phases[1].status` → `"completed"` (commitSha는 본 commit 후 trailing cleanup).

## commit + push

```bash
cd "$(git rev-parse --show-toplevel)"

git add tasks/plan001-extract-claude-result-consolidation/index.json

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0 — cross-session race 회피.

git commit -m "task(ai-nodes): plan001 status=completed (phase-02)

- phase-01 commitSha 후기록
- _shared/bin/extract_claude_result.py git rm 완료
- apartment + stock-investment 4 runner .ts 호출자 전환 완료
- ai-nodes 첫 모노레포 레벨 plan 종료

career-os plan008 (미실행 task) 의도 완성. plan008 task 파일은 history 보존.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push origin main
```

## 금지 사항

- 신규 파일 생성.
- 다른 파일 수정 (index.json Edit 외).
- ADR 본문 수정.
- 다른 워크스페이스 (career-os / travel) 파일 stage.
- amend / force push.
- section mark (U+00A7) 직접 입력.

## PHASE_BLOCKED / PHASE_FAILED 조건

- phase-01 commitSha 추출 실패 — `PHASE_FAILED: phase commit 누락 또는 cross-session race`.
- .py 참조 잔존 (4번 검증 fail) — `PHASE_FAILED: 호출자 정리 누락`.
- .ts 호출자 count 불일치 (3번 검증 fail) — `PHASE_FAILED: runner path 변경 부분 누락`.
- 의도 외 staged 파일 — `PHASE_BLOCKED: cross-session stage race — git status 확인 필요`.
- smoke_test 실패 — `PHASE_FAILED: smoke_test 회귀`.
- push 거절 — `PHASE_BLOCKED: push 거절 — 사용자 검토 필요`.
