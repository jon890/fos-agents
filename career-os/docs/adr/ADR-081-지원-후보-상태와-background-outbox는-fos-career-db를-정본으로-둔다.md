## ADR-081 — 지원 후보 상태와 background outbox는 fos-career DB를 정본으로 둔다

- Status: Accepted
- Date: 2026-06-14

### 맥락

기존 포지션 추천 흐름은 daily Markdown 리포트에서 추천 카드를 추출해 `frontdoor-queue.jsonl`에 저장한 뒤, 사용자가 선택한 후보만 `ledger.jsonl`로 승격했다.
이 구조는 agent-first workflow에서는 빠르게 동작했지만, 웹 대시보드가 중심이 되자 세 가지 문제가 드러났다.

- `frontdoor queue`라는 이름이 사용자 관점에서 의미를 설명하지 못한다.
- HTML 리포트 카드와 실제 action 가능한 queue record를 다시 매칭해야 한다.
- 제외, 보류, 지원 시작 같은 현재 상태를 웹 대시보드에서 일관되게 필터링하기 어렵다.

사용자는 앞으로 웹 대시보드를 최대한 활용하고, 그날 HTML 리포트는 읽기용 snapshot으로 두며, 최종 상태는 DB로 보는 구조를 원한다.
또한 카드 전체 클릭은 외부 제출이 아니라 내부 지원 시작 workflow로 해석하기로 했다.

### 결정

- `frontdoor queue`를 새 workflow 용어로 사용하지 않는다.
- 화면 용어는 `지원 후보`로 둔다.
- 내부 모델은 `application candidate state`로 둔다.
- 추천 후보 상태와 stage의 정본은 fos-career MySQL이다.
- `frontdoor-queue.jsonl`은 DB import와 diff 검증 후 삭제한다.
- 포지션 추천 run은 Markdown/HTML 리포트와 함께 structured recommendation item을 만든다.
- fos-career는 recommendation item을 DB로 ingest한다.
- 같은 공고는 candidate key unique constraint로 중복 생성하지 않는다.
  - 1차 key는 normalized posting URL hash다.
  - URL이 없거나 불안정하면 `company + title + source + closeDate` fallback hash를 쓴다.
- 지원 후보는 `state`와 `stage`를 분리해 관리한다.
  - `state`: `recommended`, `held`, `excluded`, `started`, `closed`.
  - `stage`: `company_analysis`, `posting_analysis`, `fit_analysis`, `study_pack`, `resume_draft`, `submitted`, `resume_passed`, `interview_prep`.
- state/stage 의미와 전이 규칙은 master/transition table로 관리한다.
- 카드 전체 클릭은 `지원 시작`으로 처리한다.
- `지원 시작`은 내부 workflow 시작이다.
  회사 분석, 공고 분석, fit 분석, 공부팩 생성, 이력서 초안, 제출 후 면접 대비까지 포함한다.
- 실행은 dependency 순서대로 진행한다.
  첫 실행 묶음은 회사 분석, 공고 분석, fit 분석이다.
- 공부팩과 이력서 초안은 fit 분석 결과가 준비된 뒤 다음 stage로 실행한다.
- 오래 걸리는 skill 실행은 fos-career DB outbox job으로 관리한다.
- worker는 pending job을 주기적으로 lock해 처리하고, 재시도와 실패 상태를 DB에 남긴다.
- HTML 리포트는 그날의 읽기용 snapshot이며 action source가 아니다.
- 외부 제출, 업로드, 로그인, 공개 발행은 계속 사용자 별도 승인 밖에서 실행하지 않는다.

### 결과

- 대시보드가 추천 후보의 현재 상태를 한 곳에서 판단할 수 있다.
- 제외한 후보는 다음 추천 화면에 다시 기본 노출되지 않는다.
- 보류, 제외, 지원 시작, 서류 통과, 면접 대비 같은 상태가 리포트 HTML과 독립적으로 유지된다.
- report card와 queue record를 URL로 다시 맞추는 fragile matching을 줄인다.
- legacy `frontdoor-queue.jsonl`과 `user_position_action_requests`는 migration compatibility가 된다.
- DB schema, migration, worker, 대시보드 UI가 함께 바뀌는 큰 작업이므로 plan073으로 phase를 나눠 진행한다.

### 적용

- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `AGENTS.md`
- `tasks/plan073-dashboard-application-candidate-state/`
