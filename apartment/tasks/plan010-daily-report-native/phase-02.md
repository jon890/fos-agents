# Phase 02 — thin wrapper run_with_claude.sh 신규 + 옛 run_report.sh 폐기

**Model**: sonnet
**Status**: pending

---

## 목표

`apartment-daily-report` 운영 진입점을 interior와 동일한 thin wrapper 패턴으로 만든다.
`run_with_claude.sh`가 `claude -p "/apartment-daily-report"`를 직접 호출하고, Discord 시작/실패 알림과 stdout 폴백을 담당한다.
옛 `run_report.sh`(외부 subprocess + track_task self-wrap)는 폐기한다.

근거: ADR-010 (apartment/docs/adr.md).

**범위 외**:

- SKILL.md native 명세 — phase-01에서 완료(전제).
- `run_smoke_test.sh` / `run_guri_buy_search.sh` — 보조 진입점, 유지.
- `track_task.sh` / `extract_claude_result.ts` 파일 삭제 — 후속 모노레포 plan.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs + 참조 (실행 전 Read)

- `apartment/scripts/apartment-interior-reference-digest/run_with_claude.sh` — **복제할 thin wrapper 패턴 정본**.
- `apartment/docs/adr.md` ADR-010 — 알림 책임(wrapper 시작/실패, native 완료/요약).
- 옛 `apartment/scripts/apartment-daily-report/run_report.sh` — Discord notify_safe 패턴·.env 로드 참고 후 폐기.

---

## 작업 항목 (2)

### 1. run_with_claude.sh 신규 작성

`apartment/scripts/apartment-daily-report/run_with_claude.sh` 작성.
interior의 `run_with_claude.sh`를 정본 패턴으로 복제하되 daily-report에 맞게 조정:

- `TASK_ROOT="${TASK_ROOT:-$HOME/ai-nodes/apartment}"`, `REPORT_DATE="${REPORT_DATE:-$(date +%F)}"`.
- `.env` 로드 (NAVER_COOKIE 등) — 옛 run_report.sh의 .env 로드 블록 참고.
- Discord 시작 알림: `bun run _shared/lib/notify_discord.ts "[시작] ..."` (notify_safe 래퍼로 `|| true`).
- `cd "$TASK_ROOT"` 후 `claude --permission-mode bypassPermissions -p "/apartment-daily-report"` 호출.
- 종료 처리(interior 패턴):
  - exit != 0 → Discord 실패 알림 + stderr/stdout tail + exit.
  - stdout 있으면 그대로 출력 + exit 0.
  - stdout 비고 `data/$REPORT_DATE/report.md` 존재 → 경로 안내 + exit 0.
  - 둘 다 없으면 실패 메시지 + exit 1.

`bash -n`으로 문법 통과해야 한다.

### 2. 옛 run_report.sh 폐기

`apartment/scripts/apartment-daily-report/run_report.sh`를 `git rm`.
이 파일이 유일한 `track_task.sh` / `extract_claude_result.ts` 호출처였으므로, 폐기로 apartment의 두 의존성 호출처가 0이 된다(후속 모노레포 plan 선결).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `apartment/scripts/apartment-daily-report/run_with_claude.sh` | 신규 (interior thin wrapper 패턴) |
| `apartment/scripts/apartment-daily-report/run_report.sh` | git rm (폐기) |

## 커밋 (검증 통과 후)

```bash
cd "$(git rev-parse --show-toplevel)"
chmod +x apartment/scripts/apartment-daily-report/run_with_claude.sh
git add apartment/scripts/apartment-daily-report/run_with_claude.sh
git rm apartment/scripts/apartment-daily-report/run_report.sh
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged] $STAGED (기대 2: wrapper 신규 + run_report.sh 삭제)"
[ "$STAGED" -eq 2 ] || { echo "PHASE_FAILED: staged 불일치"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
feat(apartment): plan010 phase-02 daily-report thin wrapper + run_report.sh 폐기

- run_with_claude.sh 신규: claude -p "/apartment-daily-report" + Discord 시작/실패 + stdout 폴백 (interior 패턴)
- 옛 run_report.sh(외부 subprocess + track_task self-wrap) git rm
- apartment에서 track_task.sh / extract_claude_result.ts 호출처 0 (ADR-010)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
WRAP=apartment/scripts/apartment-daily-report/run_with_claude.sh

# 문법
bash -n "$WRAP" && echo "[bash -n] OK" || { echo "PHASE_FAILED: wrapper 문법 오류"; exit 1; }

# run_report.sh 폐기 확인 (기대: 부재)
[ ! -f apartment/scripts/apartment-daily-report/run_report.sh ] && echo "[run_report.sh] 폐기 OK" || { echo "PHASE_FAILED: run_report.sh 잔존"; exit 1; }

# wrapper가 native 직접 호출 + track_task 미사용 확인
grep -q 'claude.*-p.*"/apartment-daily-report"' "$WRAP" && echo "[native 호출] OK" || { echo "PHASE_FAILED: native claude -p 호출 누락"; exit 1; }
LEG=$(grep -cE "track_task|TRACK_TASK_WRAPPED|extract_claude_result|--output-format json" "$WRAP")
echo "[wrapper 옛 패턴 잔재] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: wrapper에 옛 패턴 잔재"; exit 1; }

# apartment 전체에서 run_report.sh 호출 잔재 0 (docs·tasks history 제외)
CALL=$(grep -rl "run_report.sh" apartment/scripts apartment/.claude 2>/dev/null | wc -l)
echo "[run_report.sh 호출 잔재(scripts/.claude)] $CALL (기대 0)"
[ "$CALL" -eq 0 ] || { echo "PHASE_FAILED: run_report.sh 참조 잔존"; grep -rl "run_report.sh" apartment/scripts apartment/.claude; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

PHASE_FAILED 트리거 시 반드시 위 bash를 Bash 도구로 실행해 exit 1로 종료한다.

## 의도 메모 (왜)

- interior 패턴 복제 — apartment 워크스페이스 내 wrapper 일관성, 검증된 stdout 폴백 재사용.
- run_report.sh 폐기가 track_task/extract 호출처를 0으로 만들어 후속 모노레포 정리 plan의 선결 조건 충족.
