# Phase 01 — execution gate 구현과 fixture/live-copy 검증

## 목표

`application-flow-agent`가 skill 산출물 없이 ledger 상태를 앞서 넘기지 않도록 execution gate를 추가한다.

## 배경

`tasks/plan031-application-flow-agent/audit/operation-test-2026-05-27.md`에서 다음 blocker가 확인됐다.

- `preparing_application -> needs_revision` decision이 가능했다.
- 하지만 `application-package.md`와 `review.md`가 실제로 없었다.
- 세 번째 `run-once`를 실행하면 false-positive 상태 전이가 발생할 수 있어 중단했다.

## 구현

- `scripts/application-agent/actions.ts`
  - decision별 필수 artifact를 정의했다.
  - artifact가 없으면 `executionBlocked=true`를 반환하고 ledger update를 수행하지 않는다.
  - artifact가 있으면 path field를 ledger에 반영한다.
- `scripts/application-agent/run.ts`
  - execution gate block 사유와 missing artifact를 CLI에 출력한다.
  - `run-daily` action count에서 execution-blocked 항목을 제외한다.
- `scripts/application-agent/render_decision_log.ts`
  - decision log와 daily digest에 execution gate block을 표시한다.
- docs
  - `docs/flow.md`, `docs/code-architecture.md`, `docs/adr.md`에 artifact-before-transition 결정을 기록했다.

## 필수 artifact

- `run_fit_analysis`: `fit-analysis.md`
- `draft_application_package`: `application-package.md`
- `revise_application_package`: `application-package.md`
- `call_application_package_writer`: `application-package.md` + `review.md`

## 검증

```bash
bun scripts/application-agent/run.ts validate --ledger data/applications/ledger.jsonl
bun scripts/application-agent/run.ts dry-run --ledger data/applications/ledger.jsonl
tmp=$(mktemp -d); cp data/applications/ledger.jsonl "$tmp/ledger.jsonl"; bun scripts/application-agent/run.ts run-once --ledger "$tmp/ledger.jsonl" --output-dir "$tmp/out"; diff -u data/applications/ledger.jsonl "$tmp/ledger.jsonl"
```

결과:

- live ledger validation 통과.
- dry-run은 기존처럼 다음 decision을 보여준다.
- live ledger copy에서 `run-once`는 missing `application-package.md` / `review.md`를 보고 execution gate에서 멈췄다.
- diff 없음: ledger 상태는 변경되지 않았다.

## 다음 단계

실제 자율 실행으로 가려면 native skill을 runner가 직접 호출하는 `--execute-skills` 모드 또는 별도 worker를 후속 plan으로 추가한다.
