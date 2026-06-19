# Phase 04 — items.json·daily runner 죽은 코드 제거

**Model**: haiku
**Status**: pending

---

## 목표

호출 0으로 확인된 옛 적재 흐름 자산을 제거한다(ADR-101).
cron은 Codex가 SKILL을 직접 실행하고 backend는 hermes API로 호출하므로, 이 자산들은 어느 경로도 사용하지 않는다.

제거 대상:

- `career-os/scripts/position-recommender/structured_recommendation_items.ts` (items.json 생성)
- `career-os/scripts/position-recommender/run_daily_with_claude.ts` (daily runner)
- `career-os/scripts/position-recommender/run_daily_with_claude.sh` (runner shim)

**범위 외**: 스키마·렌더러·SKILL(phase-01~03 선행). `collect_live_postings.ts`·`record_metrics.ts`·`live-postings/`·`templates/`는 유지(별도 진입점, 죽은 코드 아님).

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 루트
```

---

## 관련 docs

- `career-os/docs/adr/ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md`
- `career-os/docs/code-architecture.md` position-recommender 섹션 (이미 runner 제거 반영됨)

---

## 작업 항목 (2)

### 1. 제거 전 참조 0건 확인

`scripts/`·`.claude/`에서 세 자산을 import하거나 호출하는 곳이 없는지 확인한다.
`tasks/` 아래 과거 plan 문서의 언급은 역사 기록이므로 건드리지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
grep -rn "structured_recommendation_items\|run_daily_with_claude" \
  career-os/scripts career-os/.claude 2>/dev/null \
  | grep -v "scripts/position-recommender/structured_recommendation_items.ts" \
  | grep -v "scripts/position-recommender/run_daily_with_claude"
```

위 출력이 비어 있어야 한다(자기 자신 제외 참조 0). 비어 있지 않으면 그 참조를 먼저 정리하거나 `PHASE_BLOCKED` 처리한다.

### 2. git rm으로 제거

```bash
cd "$(git rev-parse --show-toplevel)"
git rm career-os/scripts/position-recommender/structured_recommendation_items.ts
git rm career-os/scripts/position-recommender/run_daily_with_claude.ts
git rm career-os/scripts/position-recommender/run_daily_with_claude.sh
```

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/structured_recommendation_items.ts` | 삭제 |
| `career-os/scripts/position-recommender/run_daily_with_claude.ts` | 삭제 |
| `career-os/scripts/position-recommender/run_daily_with_claude.sh` | 삭제 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"

# 파일이 사라졌는지
! [ -f career-os/scripts/position-recommender/structured_recommendation_items.ts ] && echo "items.ts 제거 OK"
! [ -f career-os/scripts/position-recommender/run_daily_with_claude.ts ] && echo "runner.ts 제거 OK"
! [ -f career-os/scripts/position-recommender/run_daily_with_claude.sh ] && echo "runner.sh 제거 OK"

# 잔재 참조 0건 (tasks/ 역사 기록 제외, 자기 자신 제외)
RESID=$(grep -rn "structured_recommendation_items\|run_daily_with_claude" \
  career-os/scripts career-os/.claude career-os/docs 2>/dev/null | wc -l | tr -d ' ')
echo "잔재 참조: $RESID (기대 0)"
[ "$RESID" = "0" ]
```

성공 기준: 세 파일 모두 부재, `scripts`·`.claude`·`docs`에서 잔재 참조 0건.

## 커밋

`git rm`이 이미 삭제를 stage했으므로 그대로 커밋한다. push하지 않는다. 무관한 dirty 파일이 staged에 없는지 `git status --short`로 먼저 확인한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git status --short
git commit -m "refactor(career-os): position items.json·daily runner 죽은 코드 제거 (plan091)"
```

## 의도 메모 (왜)

- 완료된 폐기가 아니라 ADR-101이 정책 함의(표준 출력 단일화 + freshness 책임 이전 + ADR-075 supersede)를 동반하므로 ADR로 근거를 남기고 자산은 git rm으로 제거한다.
- `tasks/` 과거 문서의 언급은 그 시점 결정의 역사라 수정하지 않는다.

## Blocked 조건

- `scripts`·`.claude`에서 자기 자신 외 참조가 발견됨 → `PHASE_BLOCKED: 폐기 대상에 살아있는 참조 존재` 출력 후 종료.
