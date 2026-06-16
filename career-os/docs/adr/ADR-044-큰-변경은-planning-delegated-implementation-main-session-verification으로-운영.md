## ADR-044 — 큰 변경은 planning → delegated implementation → main-session verification으로 운영

- Status: Accepted
- Date: 2026-06-05

### 맥락

career-os는 position-recommender, study-topic-recommender, interview-prep, application-flow-agent처럼 여러 자동화 흐름이 연결돼 있다.
사용자는 애매한 결정이 구현 중에 묻히지 않고, 계획과 의사결정이 문서로 남으며, 구현은 Claude/subagent에게 맡기더라도 메인 세션이 최종 품질을 검증하는 운영 방식을 원한다.

plan037에서 `Toss active job-detail adapter + source adapter 구조화 + validation gate 강화`를 진행하며 이 패턴을 검증했다.
Claude가 phase 구현을 일부 수행했지만 timeout과 품질 이슈가 있었고, 메인 세션이 diff 확인, 직접 패치, build/smoke, active-only leak check, runner validation, 실제 수집 품질 검토를 수행한 뒤 완료 처리했다.

### 결정

- 30분 이상 걸리거나 여러 파일/흐름/정책을 건드리는 큰 변경은 먼저 `skills/planning` 흐름으로 목표, 범위, 결정사항, 열린 질문, phase를 정리한다.
- 합의된 plan은 `tasks/plan{N}-<slug>/index.json`과 phase 파일로 남긴다.
- 정책 또는 구조 결정은 해당 ADR 파일에 누적하고, 5문서 영향이 있으면 `docs/flow.md`, `docs/code-architecture.md`, `docs/data-schema.md` 등에도 반영한다.
- 구현은 가능한 경우 `skills/plan-and-build` 또는 Claude 비대화형 phase 실행에 위임한다.
- Claude/subagent 구현 결과는 바로 신뢰하지 않는다.
  메인 세션이 관련 `git diff` 확인, build/test/smoke 실행, 정책 grep 또는 validator 실행, runner syntax/freshness/validation gate 실행, 외부 API나 수집기 변경 시 실제 실행 결과와 diagnostics 검토를 직접 수행해야 한다.
- 새 collector/source adapter/cron 기본값은 구현 직후 daily 기본값으로 켜지 않는다.
  먼저 shadow 실행 또는 명시 옵션으로 2-3일 관찰하고, 수집량·품질·실패 모드가 안정적이면 별도 결정으로 기본값 전환한다.
- dirty worktree에서는 commit/push를 보류한다.
  unrelated 변경을 포함해 커밋하지 않고, 관련 diff와 검증 결과만 보고한다.

### 결과

- 사용자의 비즈니스/커리어 기준 결정과 코드 구현이 분리된다.
- Claude가 만든 변경이 정책을 깨거나 품질이 낮아도 메인 세션 gate에서 걸러진다.
- 채용 공고 수집처럼 외부 상태에 민감한 기능은 build 통과만으로 완료 처리하지 않고 실제 수집 품질까지 확인한다.
- 이후 큰 작업도 동일한 방식으로 재현 가능하며, 다음 에이전트는 `AGENTS.md`, `tasks/`, `docs/adr/INDEX.md`만 읽어도 운영 방식을 복원할 수 있다.
