# Phase 02 — current-issue-analysis native 전환 + notify ts (issue-key 인자)

**Model**: sonnet
**Status**: pending

---

## 목표

`current-issue-analysis`를 native skill 직접 호출로 전환(ADR-003) + Discord 알림 `_shared/lib/notify_discord.ts` 통합(ADR-002).
이 skill은 **issue-key 인자**를 받는다 — thin wrapper가 인자를 native 호출로 전달.

참조 정본: phase-01에서 전환한 `stock-investing-morning-brief` + apartment plan010 패턴.

**범위 외**: morning-brief(phase-01 완료), daily-note(phase-03).

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs (실행 전 Read)

- `stock-investment/docs/adr.md` ADR-002 + ADR-003.
- `stock-investment/docs/flow.md` 3번 — current-issue 흐름 (issue-key 결정 + data/issues/ 경로).
- `stock-investment/scripts/stock-investing-morning-brief/run_with_claude.sh` — phase-01에서 만든 wrapper 정본.

---

## 작업 항목 (5)

### 1. SKILL.md native 재작성

`stock-investment/.claude/skills/current-issue-analysis/SKILL.md` 워크플로 native화:

1. issue-key 결정 — 인자 없으면 config/current-issues.json defaultIssue.
2. 수집 — `python3 stock-investment/scripts/current-issue-analysis/collect_issue_sources.py <issue-key>` (config/current-issues.json 해당 issue sources → raw-sources.json).
3. 합성 — raw-sources.json Read 후 report.md 직접 Write.
4. 알림 — `bun run _shared/lib/notify_discord.ts`.

산출물: `data/issues/YYYY-MM-DD/<issue-key>/{raw-sources.json, report.md}`.
`analysis-input.md` / `claude.result.json` 생성 안 함.

### 2. issue-prompt.md 흡수

`references/issue-prompt.md`의 합성 지침·focusQuestions 활용 방식을 SKILL.md로 흡수 후 git rm.

### 3. run_with_claude.sh 신규 (issue-key 인자 전달)

`stock-investment/scripts/current-issue-analysis/run_with_claude.sh`:

- `ISSUE_KEY="${1:-}"`, `REQUEST="/current-issue-analysis ${ISSUE_KEY}"`.
- `.env` 로드, Discord 시작 알림, `claude --permission-mode bypassPermissions -p "$REQUEST"`.
- 종료 처리: phase-01 패턴 동일 (exit!=0 실패알림 / stdout / report.md 폴백). report.md 경로는 issue-key 의존이라 stdout 우선.
- `SKIP_NOTIFY=1` 유지.

### 4. 옛 러너 + 셸 notifier 폐기

- `scripts/current-issue-analysis/run_issue_report.sh` git rm.
- `scripts/current-issue-analysis/notify_discord.sh` git rm (_shared ts 통합).

### 5. SKILL.md 파일·의존성 표 갱신

track_task / extract / notify_discord.sh 제거, run_with_claude.sh + notify_discord.ts 반영.

---

## Write 위장 방어 (6-6) + references audit (6-7)

SKILL.md 실제 Write 필수. issue-prompt.md 흡수 후 폐기.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `.../current-issue-analysis/SKILL.md` | native 재작성 |
| `.../current-issue-analysis/references/issue-prompt.md` | 흡수 후 git rm |
| `scripts/current-issue-analysis/run_with_claude.sh` | 신규 (issue-key 인자) |
| `scripts/current-issue-analysis/run_issue_report.sh` | git rm |
| `scripts/current-issue-analysis/notify_discord.sh` | git rm |

## 커밋 (검증 통과 후)

```bash
cd "$(git rev-parse --show-toplevel)"
chmod +x stock-investment/scripts/current-issue-analysis/run_with_claude.sh
git add stock-investment/.claude/skills/current-issue-analysis/SKILL.md \
        stock-investment/scripts/current-issue-analysis/run_with_claude.sh
git rm stock-investment/.claude/skills/current-issue-analysis/references/issue-prompt.md \
       stock-investment/scripts/current-issue-analysis/run_issue_report.sh \
       stock-investment/scripts/current-issue-analysis/notify_discord.sh
git commit -m "$(cat <<'EOF'
feat(stock-investment): plan006 phase-02 current-issue-analysis native 전환

- SKILL.md native 재작성 (issue-key 인자 + python3 수집 → Claude 직접 Write), issue-prompt.md 흡수
- run_with_claude.sh thin wrapper 신규(issue-key 전달), run_issue_report.sh 폐기
- notify_discord.sh 폐기 → _shared/lib/notify_discord.ts (ADR-002)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
SK=stock-investment/.claude/skills/current-issue-analysis/SKILL.md
WRAP=stock-investment/scripts/current-issue-analysis/run_with_claude.sh
D=stock-investment/scripts/current-issue-analysis

bash -n "$WRAP" && echo "[bash -n] OK" || { echo "PHASE_FAILED: wrapper 문법"; exit 1; }
[ ! -f "$D/run_issue_report.sh" ] && echo "[run_issue_report.sh] 폐기 OK" || { echo "PHASE_FAILED: 잔존"; exit 1; }
[ ! -f "$D/notify_discord.sh" ] && echo "[notify_discord.sh] 폐기 OK" || { echo "PHASE_FAILED: 잔존"; exit 1; }
[ ! -f stock-investment/.claude/skills/current-issue-analysis/references/issue-prompt.md ] && echo "[issue-prompt.md] 폐기 OK" || { echo "PHASE_FAILED: 잔존"; exit 1; }
grep -q 'claude.*-p' "$WRAP" && grep -q 'ISSUE_KEY\|/current-issue-analysis' "$WRAP" && echo "[native+issue-key] OK" || { echo "PHASE_FAILED: native/issue-key 누락"; exit 1; }
LEG=$(grep -cE "extract_claude_result|--output-format json|TRACK_TASK_WRAPPED|track_task\.sh" "$SK" "$WRAP")
echo "[옛 패턴 잔재] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: 옛 패턴 잔재"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

PHASE_FAILED 시 반드시 Bash 도구로 실행해 exit 1.

## 의도 메모 (왜)

- issue-key 인자 전달이 morning-brief와 다른 유일한 점 — wrapper가 `$1` 전달.
- 나머지는 phase-01 패턴 복제.
