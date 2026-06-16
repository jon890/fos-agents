## ADR-076 — plan048 tracked runtime exception을 제거한다

- Status: Accepted
- Date: 2026-06-12

### 맥락

`data/runtime/live-position-postings.plan048-final.md`와 `data/runtime/live-position-postings.plan048-smoke.md`는 plan048 검증 산출물로 예외적으로 git 추적됐다.
하지만 현재 `data/runtime/`은 latest projection, cache, lock, eval result를 두는 private runtime 위치다.
tracked runtime 예외가 남아 있으면 새 작업자가 runtime 파일도 커밋 대상이라고 오해할 수 있다.

### 결정

- 두 plan048 tracked runtime exception 파일을 제거한다.
- plan048 task 문서와 과거 ADR 기록은 history로 보존한다.
- 앞으로 검증 evidence가 필요하면 `tasks/<plan>/` 아래 task-local evidence나 report에 남기고, `data/runtime/` 파일을 git 추적하지 않는다.

### 결과

- `data/runtime/`은 다시 gitignore/private runtime이라는 기본 경계로 돌아간다.
- runtime cleanup 때 tracked exception을 별도 예외로 계속 다룰 필요가 없다.

### 적용

- `data/runtime/live-position-postings.plan048-final.md`
- `data/runtime/live-position-postings.plan048-smoke.md`
- `docs/data-schema.md`
