## ADR-038 — application-flow-agent 상태 전이는 skill artifact 검증 뒤에만 수행

- Status: Accepted
- Date: 2026-06-04

### 맥락

2026-05-27 operation test에서 `run-once`가 `preparing_application -> needs_revision`으로 진행 가능한 결정을 만들었지만, 실제 `application-package-writer`와 `application-reviewer` 산출물은 아직 없었다. 이 구조는 의도한 `policy decision -> execute tool/skill -> validate artifacts -> state update` 루프가 아니라 `policy decision -> command suggestion -> ledger transition`에 가까워, 지원 패키지가 없는 상태에서도 ledger가 앞서갈 수 있었다.

### 결정

- `scripts/application-agent/actions.ts`에 execution gate를 둔다.
- 상태 전이를 동반하는 skill 기반 decision은 필수 산출물이 존재할 때만 ledger를 갱신한다.
  - `run_fit_analysis`: `fit-analysis.md`
  - `draft_application_package` / `revise_application_package`: `application-package.md`
  - `call_application_package_writer`: `application-package.md` + `review.md`
- 산출물이 없으면 decision log와 command suggestion은 남기되, ledger status/agentPhase는 변경하지 않는다.
- safety gate는 금지 action을 막고, execution gate는 아직 수행되지 않은 skill 결과를 근거로 한 false-positive 전이를 막는다.

### 결과

- `run-once`가 준비되지 않은 지원 건을 다음 상태로 넘기지 않는다.
- 실제 skill 실행 또는 산출물 생성 뒤 `resume <application-id>`로 같은 decision을 다시 검증할 수 있다.
- cron 등록 전 수동 운용 단계에서 false-positive 상태 전이를 줄인다.
