# plan056 phase-05 검증

날짜: 2026-06-07
Worktree: `/home/bifos/ai-nodes-worktrees/plan056-complete`

## 증거 파일

필수 plan056 파일은 모두 존재한다.

- `index.json`
- `inventory.md`
- `runtime-cleanup.md`
- `coffeechat-tombstone.md`
- `phase-01.md`
- `phase-02.md`
- `phase-03.md`
- `phase-04.md`
- `phase-05.md`

plan056 phase body status:

- phase-01: completed
- phase-02: completed
- phase-03: completed
- phase-04: completed
- phase-05: 이 validation phase 전에는 pending

이 phase 전 index status는 예상한 in-progress 상태와 일치했다.

- current phase: 5
- phases 1-4: completed
- phase 5: pending

## plan041 metadata 비교

`tasks/plan041-interview-coffeechat-deprecation/index.json` reports:

- plan status: completed
- phase 1: completed
- phase 2: completed
- phase 3: completed
- phase 4: completed
- phase 5: completed

phase body header는 아래처럼 기록돼 있다.

- `phase-01.md`: pending
- `phase-02.md`: pending
- `phase-03.md`: pending
- `phase-04.md`: pending
- `phase-05.md`: pending

결과: metadata/body mismatch를 확인했다.

권장 처리:

- plan041은 completed 상태로 유지한다.
- plan056에서는 plan041을 바꾸지 않는다.
- 나중에 metadata hygiene cleanup에서 `**Status**` header 5개만 completed로 갱신한다.
- 나머지 phase body는 historical execution contract로 보존한다.

## 열린 결정 확인

plan056 open decision은 phase output과 일치한다.

### O1 coffeechat-tombstones

검증 결과:

- live `/interview-coffeechat-prep` automation의 active caller는 찾지 못했다.
- skill과 script는 명시적 tombstone이다.
- 권장 기본값은 tombstone을 한 release cycle 더 유지하는 것이다.

후속 결정:

- zero-caller check를 반복한 뒤 tombstone을 task-local evidence 또는 `data/private/archive/plan041/`로 옮길지 결정한다.
- ADR-only transition은 tombstone message를 검색 가능한 곳에 보존해야 한다.

### O2 runtime-exception-retention

검증 결과:

- tracked runtime 파일은 plan048 snapshot 2개뿐이다.
- 이 파일들은 active runtime projection이 아니라 plan048 verification evidence다.
- 권장 기본값은 `tasks/plan048-target-source-coverage-dashboard/evidence/` 아래 task-local evidence로 옮기는 것이다.

후속 결정:

- 승인되면 나중에 `git mv` cleanup을 실행한다.
- 같은 시점에 plan048 reference를 갱신한다.

### O3 report-retention

검증 결과:

- 이 checkout에는 `data/reports` 파일이 없다.
- retention policy는 file-specific이 아니라 boundary-level로 유지한다.

후속 결정:

- 오래된 report가 나타나면 current prep, application package, task evidence, docs, ADR에서 참조하는 report만 유지한다.
- 오래된 report는 제거 전에 `data/private/archive/` 아래에 archive한다.

## data 경계 결과

이 plan은 cleanup 실행이 아니라 결정 경계를 고정했다.

확정한 경계:

- `data/applications/`: private application preparation home.
- `data/private/`: private-only archive and ambiguous sensitive-data home.
- `data/source/`: collected external source material, private by default when tied to applications or interviews.
- `data/reports/`: generated reports with retention/archive review.
- `data/runtime/`: latest projection, cache, lock, and eval state.

## 완료 기준

아래 이유로 plan056은 completed로 표시할 수 있다.

- inventory가 존재한다.
- docs와 ADR의 boundary decision이 이미 존재한다.
- runtime exception handling recommendation이 존재한다.
- coffeechat tombstone recommendation이 존재한다.
- plan041 mismatch가 보고됐다.
- 남은 cleanup action은 숨은 blocker가 아니라 명시적 follow-up decision이다.

phase 3-5 동안 runtime file, tombstone file, plan041 file은 변경하지 않았다.
