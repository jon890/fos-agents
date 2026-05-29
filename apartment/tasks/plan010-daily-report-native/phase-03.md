# Phase 03 — 통합 검증 + index.json status=completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan010 산출물(phase-01 SKILL.md native 재작성 + phase-02 thin wrapper)의 정합성을 검증하고 `index.json`을 `status="completed"`로 마킹한다.

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

아래 bash를 Bash 도구로 직접 실행한다. 값을 그대로 출력하고, 실패 시 exit 1.

```bash
cd "$(git rev-parse --show-toplevel)"
SK=apartment/.claude/skills/apartment-daily-report/SKILL.md
WRAP=apartment/scripts/apartment-daily-report/run_with_claude.sh

# (a) phase-01 산출물 — SKILL.md native, claude-prompt.md 폐기
[ -f "$SK" ] && [ ! -f apartment/.claude/skills/apartment-daily-report/references/claude-prompt.md ] \
  && echo "[phase-01] SKILL.md 존재 + claude-prompt.md 폐기 OK" \
  || { echo "PHASE_FAILED: phase-01 산출물 불일치"; exit 1; }

# (b) phase-02 산출물 — wrapper 존재, run_report.sh 폐기
[ -f "$WRAP" ] && [ ! -f apartment/scripts/apartment-daily-report/run_report.sh ] \
  && echo "[phase-02] wrapper 존재 + run_report.sh 폐기 OK" \
  || { echo "PHASE_FAILED: phase-02 산출물 불일치"; exit 1; }

# (c) wrapper 문법
bash -n "$WRAP" && echo "[bash -n] OK" || { echo "PHASE_FAILED: wrapper 문법 오류"; exit 1; }

# (d) apartment scripts/.claude 에서 옛 패턴 호출처 0
LEG=$(grep -rlE "extract_claude_result|TRACK_TASK_WRAPPED" apartment/scripts apartment/.claude 2>/dev/null | wc -l)
echo "[옛 패턴 호출처(scripts/.claude)] $LEG (기대 0)"
[ "$LEG" -eq 0 ] || { echo "PHASE_FAILED: 옛 패턴 잔재 $LEG건"; exit 1; }
echo "✅ 모든 검증 명령 실행 완료"
```

### 2. index.json status 마킹

`apartment/tasks/plan010-daily-report-native/index.json`을 Edit:

- 최상위 `"status": "pending"` → `"status": "completed"`.
- `phases[].status` 각 `"pending"` → `"completed"`.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `apartment/tasks/plan010-daily-report-native/index.json` | status=completed 마킹 |

## 커밋 (검증 통과 후)

```bash
cd "$(git rev-parse --show-toplevel)"
git add apartment/tasks/plan010-daily-report-native/index.json
STAGED=$(git diff --cached --name-only | wc -l)
echo "[staged] $STAGED (기대 1)"
[ "$STAGED" -eq 1 ] || { echo "PHASE_FAILED: index.json 외 혼입"; git reset; exit 1; }
git commit -m "$(cat <<'EOF'
task(apartment): plan010 통합 검증 완료 + status=completed

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
STAT=$(python3 -c "import json; print(json.load(open('apartment/tasks/plan010-daily-report-native/index.json'))['status'])")
echo "[index status] $STAT"
[ "$STAT" = "completed" ] || { echo "PHASE_FAILED: status 마킹 실패"; exit 1; }
echo "OK"
```

## 의도 메모 (왜)

- 마지막 phase 검증 전용 분리(task-create.md 표준) — phase-01·02 산출물 정합성을 한 곳에서 확인.
