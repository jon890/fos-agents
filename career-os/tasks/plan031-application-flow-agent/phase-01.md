# Phase 01 — 상태 모델 + policy matrix 확정

## 목표

`plan029`의 지원 패키지 MVP 위에 올라갈 application-flow-agent의 상태 모델과 정책 결정표를 확정한다.

이번 phase는 구현보다 먼저 "agent가 어떤 상태에서 어떤 다음 행동을 선택해야 하는가"를 문서와 검증 가능한 규칙으로 고정한다.

## 배경

기존 `plan029-application-agent-mvp`는 다음 기반을 만들었다.

- `data/applications/ledger.jsonl`
- `scripts/application-agent/ledger_schema.ts`
- `application-package-writer`
- `application-reviewer`
- `daily-application-digest`
- TossPlace fixture 기반 end-to-end rehearsal

하지만 이것은 아직 skill chain에 가깝고, 다음 항목이 부족하다.

- no actionable candidate일 때의 분기
- 더 찾기와 다음 주 재시도 판단
- stale/closed/cooldown 후보 차단
- 여러 후보 중 우선순위 선택
- agent-only 작업과 user-gated 작업의 자동 분리
- 상태 전이를 코드가 검증하는 decision engine

## 확정할 상태 확장

기존 `status`는 큰 흐름으로 유지한다.

- `discovered`
- `analyzing`
- `preparing_application`
- `needs_revision`
- `ready_for_user_review`
- `approved`
- `submitted`
- `interview_prep`
- `interview_scheduled`
- `closed`
- `blocked`

새 세부 상태는 `agentPhase` 또는 `agentState`로 둔다.

- `scouting`: 후보 탐색 중
- `needs_more_search`: 검색 범위 확장 필요
- `no_good_match`: 충분히 검색했지만 actionable candidate 없음
- `scheduled_retry`: 지금은 할 일 없고 다음 실행 예약됨
- `actionable_candidate`: active + threshold 통과 후보
- `generating_package`: package writer 실행 대상
- `reviewing_package`: reviewer 실행 대상
- `collecting_evidence`: 근거 부족 보강 대상
- `revising_package`: agent 수정 루프 대상
- `waiting_user_approval`: 사용자 승인 전 정지
- `study_loop`: private study/interview action 생성 대상
- `submission_checklist`: 제출 링크/체크리스트 생성 대상

## actionable candidate 기준

MVP 기본값:

- 공고가 active 상태다.
- 공고 URL 또는 source id가 중복이 아니다.
- 회사/그룹 쿨다운 플래그가 없다.
- 공고 만료/마감 신호가 없다.
- role-fit score가 기본 threshold 이상이다.
- 최근 7일 반복 후보라면 반복 유지 사유가 있다.
- `position-recommender` freshness guard를 통과한 입력에서 왔다.

추천 threshold:

- 85점 이상: high priority actionable candidate
- 70-84점: normal actionable candidate
- 70점 미만: hold 또는 study_loop 후보

## policy matrix 초안

- `scouting` + actionable candidate 0개 + 검색량 부족
  - next action: `expand_search`
  - next state: `needs_more_search`
- `scouting` + actionable candidate 0개 + 검색량 충분
  - next action: `schedule_retry`
  - next state: `scheduled_retry`
  - `nextRunAt`: 다음 주 또는 다음 daily window
- `discovered` + active + threshold 통과
  - next action: `run_application_package_writer`
  - next state: `generating_package`
- `discovered` + closed/expired
  - next action: `close_candidate`
  - next state: `closed`
- `discovered` + cooldown/duplicate
  - next action: `block_candidate`
  - next state: `blocked`
- `preparing_application` + package exists
  - next action: `run_application_reviewer`
  - next state: `reviewing_package`
- `needs_revision` + revisionCount < maxRevisionCount + agent-fixable
  - next action: `revise_application_package`
  - next state: `revising_package`
- `needs_revision` + evidence 부족
  - next action: `collect_evidence_or_request_user_input`
  - next state: `collecting_evidence` 또는 `waiting_user_approval`
- `needs_revision` + revisionCount >= maxRevisionCount
  - next action: `block_or_request_user_input`
  - next state: `blocked`
- `ready_for_user_review`
  - next action: `notify_user_approval_needed`
  - next state: `waiting_user_approval`
- `approved`
  - next action: `create_submission_checklist`
  - next state: `submission_checklist`
- `submitted`
  - next action: `create_study_interview_actions`
  - next state: `study_loop`
- `interview_scheduled`
  - next action: `prioritize_interview_prep`
  - next state: `study_loop`

## 우선순위 큐 기본값

- 하루 신규 deep analysis 최대 2개.
- `ready_for_user_review`는 최대 3개까지만 쌓는다.
- 진행 중인 revise/review가 신규 탐색보다 우선한다.
- `interview_scheduled`가 있으면 study_loop 우선순위를 올린다.
- `blocked`는 자동 재시도하지 않고 `requiredUserAction` 또는 `nextRunAt`이 있는 경우만 재평가한다.

## 산출물

- `docs/flow.md`에 application-flow-agent planning flow 추가
- `docs/data-schema.md`에 planned agent runtime fields 추가
- `docs/code-architecture.md`에 policy engine 위치와 책임 추가
- `docs/adr.md`에 application-flow-agent runtime ADR 추가

## 검증 기준

- policy matrix가 no-match, needs_more_search, scheduled_retry, blocked, ready_for_user_review, study_loop을 모두 포함한다.
- 상태 전이 책임이 LLM이 아니라 TypeScript policy/validator에 있음을 문서화한다.
- plan030은 구현 대상이 아니라 candidate freshness prerequisite로만 참조한다.
- 제출 자동화 Level 0 제한이 명시된다.

