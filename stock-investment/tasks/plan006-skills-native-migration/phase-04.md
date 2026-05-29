# Phase 04 — 통합 검증 + index.json status=completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan006 산출물(phase-01~03: 3 skill native 전환 + notify ts 통합)의 정합성을 검증하고 `index.json`을 `status="completed"`로 마킹한다.

**범위 외**: 새 내용 작성·수정. 본 phase는 검증 + 상태 마킹만.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 작업 항목 (2)

### 1. 통합 검증

아래 bash를 Bash 도구로 직접 실행. 값 그대로 출력, 실패 시 exit 1.

```bash
cd "$(git rev-parse --show-toplevel)"

# (a) 3 skill 각각 wrapper 존재 + 옛 러너 폐기
for s in stock-investing-morning-brief current-issue-analysis daily-stock-analysis-note; do
  W=stock-investment/scripts/$s/run_with_claude.sh
  [ -f "$W" ] && bash -n "$W" && echo "[$s wrapper] OK" || { echo "PHASE_FAILED: $s wrapper 없음/문법오류"; exit 1; }
done

# (b) 옛 러너·셸 notifier·합성 프롬프트 폐기 확인
OLD=$(ls stock-investment/scripts/stock-investing-morning-brief/run_report.sh \
         stock-investment/scripts/current-issue-analysis/run_issue_report.sh \
         stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh \
         stock-investment/scripts/stock-investing-morning-brief/notify_discord.sh \
         stock-investment/scripts/current-issue-analysis/notify_discord.sh 2>/dev/null | wc -l)
echo "[옛 러너·notifier 잔존] $OLD (기대 0)"
[ "$OLD" -eq 0 ] || { echo "PHASE_FAILED: 옛 자산 잔존 $OLD건"; exit 1; }

# (c) stock-investment 전체에서 옛 패턴 호출처 0 (scripts/.claude)
LEG=$(grep -rlE "extract_claude_result|TRACK_TASK_WRAPPED|--output-format json" stock-investment/scripts stock-investment/.claude 2>/dev/null | wc -l)
echo "[옛 패턴 호출처] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: 옛 패턴 잔재 $LEG건"; grep -rlE "extract_claude_result|TRACK_TASK_WRAPPED|--output-format json" stock-investment/scripts stock-investment/.claude; exit 1; }

# (d) notify_discord.sh 워크스페이스 셸 잔재 0 (ADR-002)
NSH=$(find stock-investment/scripts -name notify_discord.sh 2>/dev/null | wc -l)
echo "[notify_discord.sh 셸 잔재] $NSH (기대 0)"
[ "$NSH" -eq 0 ] || { echo "PHASE_FAILED: 셸 notifier 잔존"; exit 1; }

# (e) Python 수집기 유지 확인
PY=$(ls stock-investment/scripts/stock-investing-morning-brief/collect_sources.py \
        stock-investment/scripts/current-issue-analysis/collect_issue_sources.py \
        stock-investment/scripts/daily-stock-analysis-note/collect_daily_note_inputs.py \
        stock-investment/scripts/daily-stock-analysis-note/sanitize_fos_study_markdown.py 2>/dev/null | wc -l)
echo "[Python 헬퍼 유지] $PY (기대 4)"
[ "$PY" -eq 4 ] || { echo "PHASE_FAILED: Python 헬퍼 소실"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

### 2. index.json status 마킹

`stock-investment/tasks/plan006-skills-native-migration/index.json`을 Edit:

- 최상위 `"status": "pending"` → `"completed"`.
- `phases[].status` 각 `"pending"` → `"completed"`.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `stock-investment/tasks/plan006-skills-native-migration/index.json` | status=completed |

## 커밋 (검증 통과 후)

```bash
cd "$(git rev-parse --show-toplevel)"
git add stock-investment/tasks/plan006-skills-native-migration/index.json
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged] $STAGED (기대 1)"
[ "$STAGED" -eq 1 ] || { echo "PHASE_FAILED: 혼입"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
task(stock-investment): plan006 통합 검증 완료 + status=completed

3 skill native 전환 + notify ts 통합. ai-nodes 전체 track_task/extract 호출처 0 달성.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
STAT=$(python3 -c "import json; print(json.load(open('stock-investment/tasks/plan006-skills-native-migration/index.json'))['status'])")
echo "[index status] $STAT"
[ "$STAT" = "completed" ] || { echo "PHASE_FAILED: status 마킹 실패"; exit 1; }
echo "OK"
```

## 의도 메모 (왜)

- 마지막 phase 검증 전용(task-create.md 표준) — 3 skill 산출물 + notify 통합 정합성 한 곳 확인.
- 본 plan 완료로 ai-nodes 전체에서 track_task/extract 호출처 0 → 후속 모노레포 정리 plan 착수 가능.
