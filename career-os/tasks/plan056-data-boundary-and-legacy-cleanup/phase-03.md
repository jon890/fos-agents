# Phase 03 — runtime 산출물 정리 계획

**Model**: sonnet
**Status**: pending

---

## 목표

`data/runtime`을 latest projection/cache 중심으로 정리하고 오래된 smoke/final artifact 처리 계획을 고정한다.

**범위 외**:

- 무조건 삭제.
- runtime producer 구현 변경.
- active projection schema 변경.
- commit/push.

---

## 관련 docs/files

실행 전 반드시 읽는다:

- `tasks/plan056-data-boundary-and-legacy-cleanup/inventory.md`
- `docs/data-schema.md`
- `docs/adr.md`
- `tasks/plan048-*`가 있으면 관련 index와 phase
- `tasks/plan055-resume-package-flow/index.json`

---

## 작업 항목 (4)

1. `git ls-files data/runtime`으로 tracked runtime artifact를 확인한다.
2. `data/runtime/live-position-postings.plan048-final.md`와 `data/runtime/live-position-postings.plan048-smoke.md`의 보존 근거를 확인한다.
3. archive 이동, task-local evidence 이동, tracked exception 유지 중 추천 결정을 `tasks/plan056-data-boundary-and-legacy-cleanup/runtime-cleanup.md`에 작성한다.
4. 정리 실행이 필요한 경우 후속 phase 또는 별도 plan으로 남기고 이 phase에서는 실행하지 않는다.

---

## Intended File Scope

- `tasks/plan056-data-boundary-and-legacy-cleanup/runtime-cleanup.md`

---

## 검증

```bash
test -f tasks/plan056-data-boundary-and-legacy-cleanup/runtime-cleanup.md
rg -n "data/runtime|live-position-postings.plan048-final.md|live-position-postings.plan048-smoke.md|tracked exception|archive" tasks/plan056-data-boundary-and-legacy-cleanup/runtime-cleanup.md
git status --short tasks/plan056-data-boundary-and-legacy-cleanup data/runtime
```

성공 기준:

- 두 plan048 파일의 처리 권고가 명시된다.
- runtime latest projection/cache와 old artifact가 구분된다.
- 실제 data/runtime 파일은 수정되지 않는다.

---

## Blocked / Failed 조건

- plan048 관련 task가 없고 파일의 맥락도 찾을 수 없으면 `echo "PHASE_BLOCKED: plan048 context unavailable" && exit 2`.
- active projection과 old artifact를 구분할 수 없으면 `echo "PHASE_BLOCKED: runtime producer boundary unclear" && exit 2`.
- data/runtime 파일이 변경되면 `echo "PHASE_FAILED: runtime files changed unexpectedly" && exit 1`.

---

## Self-check

- 이 phase는 cleanup plan만 만든다.
- tracked exception을 삭제하지 않는다.
- retention 판단은 근거와 함께 적는다.
- plan055 구현 산출물과 혼동하지 않는다.
