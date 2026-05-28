# Phase 02 — 통합 검증 + index.json status=completed 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan003 산출물의 정합성을 검증하고 `index.json`을 `status="completed"`로 마킹한다.

**범위 외**: 새 내용 작성·수정. 본 phase는 검증 + 상태 마킹만.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 작업 항목 (2)

### 1. 통합 검증

아래 bash 블록을 Bash 도구로 직접 실행한다. 각 검증 값을 stdout에 그대로 echo하고, 실패 시 `exit 1`.

```bash
cd "$(git rev-parse --show-toplevel)"

# (a) docs-first 산출물 — ADR-009/010 + 루트 AGENTS.md 13번
A=$(grep -c "## ADR-009" docs/adr.md)
B=$(grep -c "## ADR-010" docs/adr.md)
C=$(grep -c "## 13. fos-brain 외부 지식 기반 연동" AGENTS.md)
echo "[ADR-009] $A  [ADR-010] $B  [AGENTS 13번] $C"
[ "$A" -ge 1 ] && [ "$B" -ge 1 ] && [ "$C" -ge 1 ] || { echo "PHASE_FAILED: docs-first 산출물 누락"; exit 1; }

# (b) Quick Index 2줄
QI=$(grep -cE "^\| ADR-009 |^\| ADR-010 " docs/adr.md)
echo "[Quick Index 행] $QI"
[ "$QI" -eq 2 ] || { echo "PHASE_FAILED: Quick Index 행 누락"; exit 1; }

# (c) phase-01 산출물 — 5 워크스페이스 fos-brain 섹션
WS=$(grep -lr "fos-brain 연동" apartment/AGENTS.md career-os/AGENTS.md stock-investment/AGENTS.md travel/AGENTS.md health-care/AGENTS.md | wc -l)
echo "[워크스페이스 fos-brain 섹션] $WS"
[ "$WS" -eq 5 ] || { echo "PHASE_FAILED: 워크스페이스 연동 섹션 5개 미만"; exit 1; }

echo "✅ 모든 검증 명령 실행 완료"
```

### 2. index.json status 마킹

`tasks/plan003-fos-brain-integration/index.json`을 Edit로 수정:

- 최상위 `"status": "pending"` → `"status": "completed"`.
- `phases[].status`도 각 `"pending"` → `"completed"`.

run-phases.py가 마지막에 자동 마킹하지만 본 phase에서 명시적으로 한 번 더.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `tasks/plan003-fos-brain-integration/index.json` | status=completed 마킹 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
STAT=$(python3 -c "import json; print(json.load(open('tasks/plan003-fos-brain-integration/index.json'))['status'])")
echo "[index status] $STAT"
[ "$STAT" = "completed" ] || { echo "PHASE_FAILED: status 마킹 실패"; exit 1; }
echo "OK"
```

## 의도 메모 (왜)

- 마지막 phase 검증 전용 분리(task-create.md 표준) — phase-01 산출물 + docs-first 산출물 정합성을 한 곳에서 확인.
