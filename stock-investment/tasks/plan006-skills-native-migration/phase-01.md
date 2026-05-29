# Phase 01 — stock-investing-morning-brief native 전환 + notify ts

**Model**: sonnet
**Status**: pending

---

## 목표

`stock-investing-morning-brief`를 외부 subprocess 패턴에서 native skill 직접 호출로 전환한다(ADR-003).
Discord 알림을 `_shared/lib/notify_discord.ts`로 통합한다(ADR-002).

참조 정본: apartment가 plan010(ADR-010)으로 동일 전환을 끝낸 `apartment/.claude/skills/apartment-daily-report/SKILL.md` + `apartment/scripts/apartment-daily-report/run_with_claude.sh`.

**범위 외**: current-issue-analysis(phase-02), daily-stock-analysis-note(phase-03). 연쇄 폐기 자산 파일 삭제(후속 모노레포 plan).

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

run-phases.py는 cwd=workspace(stock-investment)로 실행. 본 phase는 ai-nodes 루트 기준 path 사용이므로 첫 bash에서 루트로 이동.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs (실행 전 Read)

- `stock-investment/docs/adr.md` ADR-002 + ADR-003 — 결정·결과.
- `stock-investment/docs/flow.md` 2번 — native morning-brief 목표 흐름.
- `apartment/scripts/apartment-daily-report/run_with_claude.sh` — thin wrapper 정본 패턴.

---

## 작업 항목 (5)

### 1. SKILL.md native 동작 명세 재작성

`stock-investment/.claude/skills/stock-investing-morning-brief/SKILL.md`의 워크플로를 native 동작으로 재작성.
Claude가 직접 수행하는 흐름:

1. 수집 — `python3 stock-investment/scripts/stock-investing-morning-brief/collect_sources.py` 실행 (config/watchlist.json + sources.json 입력 → market-data.json + raw-news.json).
2. 합성 — market-data.json + raw-news.json을 Read하고 `report.md`를 **Claude가 직접 Write** (`claude --output-format json` 자기 호출 + extract_claude_result.ts 사용 안 함).
3. 알림 — 완료/요약은 `bun run _shared/lib/notify_discord.ts "<메시지>"`.

산출물: `data/YYYY-MM-DD/{market-data.json, raw-news.json, report.md}`.
`analysis-input.md` / `claude.result.json` / fallback은 생성하지 않는다.

### 2. claude-prompt.md 흡수

`references/claude-prompt.md`의 합성 지침·리포트 구조를 SKILL.md 합성 단계 본문으로 흡수 후 git rm.

### 3. run_with_claude.sh 신규

`stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh` 작성 (apartment 패턴 복제):

- `.env` 로드, `cd "$TASK_ROOT"`, Discord 시작 알림(`bun run _shared/lib/notify_discord.ts`, notify_safe `|| true`).
- `claude --permission-mode bypassPermissions -p "/stock-investing-morning-brief"` 호출.
- 종료 처리: exit!=0 → Discord 실패 알림; stdout 있으면 출력; stdout 비고 `data/$REPORT_DATE/report.md` 존재 → 경로 안내; 둘 다 없으면 exit 1.
- `SKIP_NOTIFY=1` 억제 플래그 유지.

### 4. 옛 러너 + 셸 notifier 폐기

- `scripts/stock-investing-morning-brief/run_report.sh` git rm.
- `scripts/stock-investing-morning-brief/notify_discord.sh` git rm (ADR-002, _shared ts로 통합).
- `run_smoke_test.sh`는 유지(Claude 없는 수집 헬스체크). 단 내부에서 run_report.sh를 참조하면 collect_sources.py 직접 호출로 수정.

### 5. SKILL.md 파일·의존성 표 갱신

track_task.sh / extract_claude_result.ts / notify_discord.sh 행 제거, run_with_claude.sh + notify_discord.ts 반영.

---

## Write 위장 방어 (common-pitfalls 6-6 — 필수)

SKILL.md 대량 재작성. 반드시 Write/Edit 도구를 실제 호출한다. prose만 출력하면 PHASE_FAILED. phase 끝에서 commit 개수 self-check.

## references audit (6-7)

claude-prompt.md 흡수 후 폐기. issue-prompt.md/blog-note-prompt.md는 다른 skill 소관(미변경).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `stock-investment/.claude/skills/stock-investing-morning-brief/SKILL.md` | native 재작성 |
| `stock-investment/.claude/skills/stock-investing-morning-brief/references/claude-prompt.md` | 흡수 후 git rm |
| `stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh` | 신규 |
| `stock-investment/scripts/stock-investing-morning-brief/run_report.sh` | git rm |
| `stock-investment/scripts/stock-investing-morning-brief/notify_discord.sh` | git rm |

## 커밋 (검증 통과 후)

`git add -A` 금지 — 명시 add. push 안 함.

```bash
cd "$(git rev-parse --show-toplevel)"
chmod +x stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
git add stock-investment/.claude/skills/stock-investing-morning-brief/SKILL.md \
        stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
git rm stock-investment/.claude/skills/stock-investing-morning-brief/references/claude-prompt.md \
       stock-investment/scripts/stock-investing-morning-brief/run_report.sh \
       stock-investment/scripts/stock-investing-morning-brief/notify_discord.sh
# run_smoke_test.sh 수정했으면 추가 add
git add -u stock-investment/scripts/stock-investing-morning-brief/ 2>/dev/null || true
git commit -m "$(cat <<'EOF'
feat(stock-investment): plan006 phase-01 morning-brief native 전환

- SKILL.md native 재작성 (python3 수집 → Claude 직접 Write), claude-prompt.md 흡수
- run_with_claude.sh thin wrapper 신규, run_report.sh 폐기
- notify_discord.sh 폐기 → _shared/lib/notify_discord.ts (ADR-002)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
NEW=$(git rev-list HEAD ^origin/main --count 2>/dev/null || echo 1)
echo "[이번 브랜치 신규 commit 수] $NEW"
git log --oneline -1
```

## 검증

보고 직전 반드시 Bash 도구로 실행하고 값 그대로 출력(추정 금지).

```bash
cd "$(git rev-parse --show-toplevel)"
SK=stock-investment/.claude/skills/stock-investing-morning-brief/SKILL.md
WRAP=stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh
D=stock-investment/scripts/stock-investing-morning-brief

bash -n "$WRAP" && echo "[bash -n] OK" || { echo "PHASE_FAILED: wrapper 문법"; exit 1; }
[ ! -f "$D/run_report.sh" ] && echo "[run_report.sh] 폐기 OK" || { echo "PHASE_FAILED: run_report.sh 잔존"; exit 1; }
[ ! -f "$D/notify_discord.sh" ] && echo "[notify_discord.sh] 폐기 OK" || { echo "PHASE_FAILED: notify_discord.sh 잔존"; exit 1; }
[ ! -f stock-investment/.claude/skills/stock-investing-morning-brief/references/claude-prompt.md ] && echo "[claude-prompt.md] 폐기 OK" || { echo "PHASE_FAILED: claude-prompt.md 잔존"; exit 1; }
grep -q 'claude.*-p.*"/stock-investing-morning-brief"' "$WRAP" && echo "[native 호출] OK" || { echo "PHASE_FAILED: native 호출 누락"; exit 1; }
LEG=$(grep -cE "extract_claude_result|--output-format json|TRACK_TASK_WRAPPED|track_task\.sh" "$SK" "$WRAP")
echo "[옛 패턴 잔재] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: 옛 패턴 잔재"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

PHASE_FAILED 시 반드시 Bash 도구로 위 블록 실행해 exit 1. prose만 출력하면 success로 잘못 처리된다.

## 의도 메모 (왜)

- apartment plan010 검증 패턴 복제 — 리스크 낮음.
- notify_discord.sh 폐기로 ADR-002 통합 동시 진행.
- run_report.sh 폐기가 track_task/extract 호출처를 줄여 후속 모노레포 정리 선결.
