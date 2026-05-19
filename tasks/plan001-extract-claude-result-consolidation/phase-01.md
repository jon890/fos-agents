# Phase 1 — 4 runner EXTRACT path 변경 + _shared/bin/extract_claude_result.py git rm

ai-nodes plan001 phase-01. apartment + stock-investment 총 4 runner의 EXTRACT path를 `_shared/bin/extract_claude_result.py` → `_shared/lib/extract_claude_result.ts`로 변경. `python3 "$EXTRACT"` → `bun run "$EXTRACT"`. Python 파일 git rm.

## 작업 위치 (cwd 정책)

run-phases.py가 본 phase를 `cwd=ai-nodes root` (모노레포 루트)로 실행한다. 모든 bash 블록 첫 줄은 다음으로 ai-nodes 루트 이동 (no-op 가능, 일관성 유지):

```bash
cd "$(git rev-parse --show-toplevel)"
```

이후 모든 path는 ai-nodes 루트 기준.

## 관련 docs (먼저 읽기)

- `_shared/lib/extract_claude_result.ts` — 단일 출처 ts 헬퍼 (이미 존재, 동일 인자 시그니처 `<claude_json> <output_md> [usage_json]`).
- `apartment/scripts/apartment-daily-report/run_report.sh` — apartment runner 1개 (L64, L112).
- `stock-investment/skills/current-issue-analysis/scripts/run_issue_report.sh` — stock-investment runner (L26, L42).
- `stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh` — stock-investment runner (L26, L43).
- `stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh` — stock-investment runner (L31, L84).

## 변경할 파일

수정 (총 4 runner):

- `apartment/scripts/apartment-daily-report/run_report.sh`
- `stock-investment/skills/current-issue-analysis/scripts/run_issue_report.sh`
- `stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh`
- `stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh`

삭제:

- `_shared/bin/extract_claude_result.py`

본 phase에서 *신규 파일 생성 금지*. *docs / ADR / _shared/lib/ 수정 금지*.

## 명세

### 4 runner 변경 패턴

각 runner의 EXTRACT 정의 + 호출 라인을 grep + 정확히 수정:

기준 상태:

```bash
EXTRACT="$HOME/ai-nodes/_shared/bin/extract_claude_result.py"
# ...
python3 "$EXTRACT" "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"
```

변경 후:

```bash
EXTRACT="$HOME/ai-nodes/_shared/lib/extract_claude_result.ts"
# ...
bun run "$EXTRACT" "$CLAUDE_JSON" "$REPORT_MD" "${TRACK_TASK_CLAUDE_USAGE_FILE:-}"
```

(stock-investment run_daily_note.sh L84는 `$DRAFT_MD` 변수명. 호출 패턴은 동일 — `$REPORT_MD` 위치만 다르고 인자 시그니처 보존.)

각 runner에서 변경 후 grep 검증:

- `EXTRACT=.*\.py$` 0 매치
- `python3 "?\$EXTRACT"?` 0 매치
- `EXTRACT=.*extract_claude_result\.ts$` 1 매치
- `bun run "?\$EXTRACT"?` 1 매치

### Python 파일 git rm

```bash
cd "$(git rev-parse --show-toplevel)"
git rm _shared/bin/extract_claude_result.py
```

### 검증

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 전체 호출자 0 확인 (.py 참조)
! grep -rn "extract_claude_result\.py" \
    apartment/scripts/ apartment/.claude/ apartment/AGENTS.md apartment/docs/ \
    stock-investment/skills/ stock-investment/AGENTS.md stock-investment/docs/ 2>&1

# (docs / task 파일 / career-os 등 *역사적 참조*는 OK — apartment + stock-investment 실 호출자만 0이면 됨)

# 2. ts 호출자 4 확인
grep -rln "extract_claude_result\.ts" \
    apartment/scripts/ \
    stock-investment/skills/ 2>&1 | wc -l
# 4 (4 runner 모두 .ts 참조)

# 3. shell 구문 점검
bash -n apartment/scripts/apartment-daily-report/run_report.sh
bash -n stock-investment/skills/current-issue-analysis/scripts/run_issue_report.sh
bash -n stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh
bash -n stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh

# 4. _shared/bin/extract_claude_result.py 부재 확인
test ! -f _shared/bin/extract_claude_result.py || (echo "FAIL: .py 잔존" && exit 1)

# 5. apartment smoke test (네트워크 의존, 차단 시 PHASE_BLOCKED 가능)
bash apartment/scripts/apartment-daily-report/run_smoke_test.sh
```

성공 기준: 1-4 모두 통과 + 5가 정상 종료 (network 차단 시 PHASE_BLOCKED 가능).

## 금지 사항

- 신규 파일 생성.
- `_shared/lib/extract_claude_result.ts` 수정 (이미 동일 인자 시그니처 호환 — 변경 불필요).
- apartment / stock-investment 외 워크스페이스 (career-os / travel) 파일 수정.
- `apartment/docs/` 또는 ai-nodes `AGENTS.md` 수정 — 별도 commit (`6b0bb84`)으로 이미 갱신 완료.
- ADR 본문 수정.
- runner의 EXTRACT 호출 외 다른 라인 변경 — scope creep 금지.
- amend / force push.
- section mark (U+00A7) 직접 입력.

## commit

```bash
cd "$(git rev-parse --show-toplevel)"

git add apartment/scripts/apartment-daily-report/run_report.sh
git add stock-investment/skills/current-issue-analysis/scripts/run_issue_report.sh
git add stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh
git add stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh
# _shared/bin/extract_claude_result.py는 git rm으로 이미 stage됨

git status --porcelain | grep -E "^(A|M|D|R) " | head
# 의도 외 staged 파일 0 — cross-session race 회피.

git commit -m "refactor(ai-nodes): extract_claude_result.py → .ts 통합 (plan001 phase-01)

- apartment + stock-investment 4 runner의 EXTRACT path .py → .ts
- python3 \$EXTRACT → bun run \$EXTRACT
- _shared/bin/extract_claude_result.py git rm
- _shared/lib/extract_claude_result.ts 단일 출처 (career-os + apartment + stock-investment 공용)

career-os plan008 (미실행 task) 의도 완성 — cross-workspace _shared 자산 마이그.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

push 없음 (phase-02 책임).

## PHASE_BLOCKED / PHASE_FAILED 조건

- shell 구문 오류 (bash -n 실패) — `PHASE_FAILED: shell 구문 회귀`.
- smoke_test 네트워크 차단 — `PHASE_BLOCKED: smoke_test 네트워크 차단`.
- smoke_test 결과 다름 (TS .ts 호출 후 report.md 형식 깨짐) — `PHASE_FAILED: .ts 호출 회귀`.
- .py 참조 잔존 (1번 검증 fail) — `PHASE_FAILED: 호출자 잔존`.
- 의도 외 staged 파일 — `PHASE_BLOCKED: cross-session stage race`.
- runner의 EXTRACT 외 의도하지 않은 라인 변경 — `PHASE_FAILED: scope creep`.
