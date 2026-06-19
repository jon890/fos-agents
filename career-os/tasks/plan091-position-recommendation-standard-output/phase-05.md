# Phase 05 — 통합 검증 + 잔재 grep + 완료 마킹

**Model**: haiku
**Status**: pending

---

## 목표

plan091 전체가 정합한지 통합 검증하고, 폐기 자산 잔재가 없는지 확인한 뒤, index.json을 완료로 마킹한다.

**범위 외**: 새 기능 추가 없음. 이 phase는 검증과 마킹만 한다.

---

## 사전 cwd 설정 (run-phases.py hotfix 표준)

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 루트
```

---

## 관련 docs

- `career-os/docs/adr/ADR-101-position-recommender-표준출력-json-단일화-소비측-가공.md`
- `career-os/tasks/plan091-position-recommendation-standard-output/index.json`

---

## 작업 항목 (3)

### 1. 스키마 + 렌더러 정합 검증

phase-02의 샘플 JSON으로 md/html 파생이 성공하고 새 필드가 표시되는지 재확인한다.

```bash
cd "$(git rev-parse --show-toplevel)"
grep -q "source: z.string" career-os/scripts/position-recommender/recommendation_schema.ts
grep -q "closeDate: z" career-os/scripts/position-recommender/recommendation_schema.ts
```

(bun이 있으면 phase-02 검증 블록을 다시 실행해 파생 산출물에 `수집 source`·`마감일`이 있는지 확인한다.)

### 2. 폐기 자산 잔재 grep

```bash
cd "$(git rev-parse --show-toplevel)"
# scripts·.claude·docs에서 폐기 자산 참조 0건 (tasks/ 역사 기록 제외)
RESID=$(grep -rn "structured_recommendation_items\|run_daily_with_claude" \
  career-os/scripts career-os/.claude career-os/docs 2>/dev/null | wc -l | tr -d ' ')
echo "잔재 참조: $RESID (기대 0)"
[ "$RESID" = "0" ]

# 삭제 파일 부재
! [ -f career-os/scripts/position-recommender/run_daily_with_claude.ts ]
! [ -f career-os/scripts/position-recommender/structured_recommendation_items.ts ]
```

### 3. index.json 완료 마킹

`career-os/tasks/plan091-position-recommendation-standard-output/index.json`의 최상위 `status`를 `"completed"`로, 모든 phase `status`를 `"completed"`로 바꾼다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan091-position-recommendation-standard-output/index.json` | status="completed" 마킹 |

## 검증

```bash
cd "$(git rev-parse --show-toplevel)"
grep -q '"status": "completed"' career-os/tasks/plan091-position-recommendation-standard-output/index.json && echo "완료 마킹 OK"

# 최종 working tree 확인
git status --short
```

성공 기준: 잔재 참조 0건, 삭제 파일 부재, index.json status="completed".

## 의도 메모 (왜)

- 마지막 phase를 검증 전용으로 분리해 구현 phase와 검증 단위를 나눈다(task-create 표준).
- 적재 스키마 일치의 최종 보증은 소비측(backend) zod 검증이며, 이 phase는 career-os 산출물 정합까지만 확인한다.

## Blocked 조건

- 잔재 참조가 0이 아니거나 삭제 파일이 남아 있음 → `PHASE_FAILED: 폐기 잔재 존재` 출력 후 종료.
