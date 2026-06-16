## ADR-037 — application-flow-agent runtime은 policy decision engine 중심

- Status: Accepted
- Date: 2026-05-26

### 맥락

`plan029-application-agent-mvp`는 공고별 지원 패키지 작성, evidence/drift review, daily digest까지 구현했지만, 다음 행동을 스스로 결정하는 runtime은 없다. 현재 구조만으로는 "적절한 공고 없음 -> 더 찾기 또는 다음 주 재시도", "쿨다운/중복/마감 -> block/close", "review revise -> agent 수정 또는 evidence 수집", "제출 후 study loop 우선순위 상승" 같은 상태 기반 분기가 skill 호출 순서에 흩어진다.

`plan030-position-recommender-daily-freshness`는 stale 후보를 줄이는 선행 품질 개선이다. application-flow-agent 구현 계획이 아니라, 후보 ingest 전 freshness prerequisite로 참조한다. plan030은 폐기하지 않고 `sourceFreshness` 필드 검증 경로로만 참조한다.

ADR-035에는 TypeScript helper 분해 시리즈의 예시로 `plan031 — run_with_discord_notify.ts`가 적혀 있지만, 실제 `tasks/plan031-*` 디렉터리는 존재하지 않았다. 이 ADR에서는 실제 task 번호 `plan031`을 application-flow-agent에 배정하고, ADR-035의 해당 항목은 미실행 예시/후속 후보로만 취급한다.

### 결정

- `plan031-application-flow-agent`를 새 계획으로 연다.
- application-flow-agent는 단순 skill chain이 아니라 `state -> policy decision -> action -> validation -> state update` 루프다.
- Claude native skills는 tool로 재사용한다.
  - `/position-recommender`: 후보 source
  - `application-package-writer`: 지원 패키지 생성
  - `application-reviewer`: evidence/drift review
  - `daily-application-digest`: report
  - study/interview skills: private study/interview loop
- LLM은 분석, 작성, 추천 근거 생성을 맡고, 상태 전이 허용 여부와 next action 선택은 TypeScript `policy.ts` + validator가 결정한다.
- 기존 `status` enum은 큰 흐름으로 유지하고, 세부 agent 상태는 `agentPhase` optional field로 확장한다(12개 값 — phase-01 확정).
- 실제 제출, 외부 사이트 입력/전송, 계정 로그인, 공개 fos-study 발행, 원본 candidate-profile 수정은 사용자 승인 없이 수행하지 않는다.
- plan031 MVP의 submission assistant 범위는 Level 0이다. 제출 링크와 체크리스트까지만 생성한다. 브라우저 입력 자동화는 후속 plan/ADR로 분리한다.

#### agentPhase 확정 enum (phase-01)

`scouting` / `needs_more_search` / `no_good_match` / `scheduled_retry` / `actionable_candidate` / `generating_package` / `reviewing_package` / `collecting_evidence` / `revising_package` / `waiting_user_approval` / `study_loop` / `submission_checklist`

#### policy matrix 요약 (phase-01)

| 현재 status | 조건 | next agentPhase |
|---|---|---|
| `scouting` | candidate 0 + 검색량 부족 | `needs_more_search` |
| `scouting` | candidate 0 + 검색량 충분 | `scheduled_retry` |
| `discovered` | active + fit >= 70 | `generating_package` |
| `discovered` | closed/expired | status → `closed` |
| `discovered` | cooldown/duplicate | status → `blocked` |
| `preparing_application` | package exists | `reviewing_package` |
| `needs_revision` | revisionCount < max + agent-fixable | `revising_package` |
| `needs_revision` | evidence 부족 | `collecting_evidence` 또는 `waiting_user_approval` |
| `needs_revision` | revisionCount >= max | status → `blocked` |
| `ready_for_user_review` | — | `waiting_user_approval` |
| `approved` | — | `submission_checklist` |
| `submitted` / `interview_scheduled` | — | `study_loop` |

#### actionable candidate 기준 (phase-01)

fit score 70점 이상 + active + 비중복 + 비쿨다운 + 비만료 + sourceFreshness=fresh. 85점 이상은 high priority, 70-84점은 normal. 70점 미만은 study_loop 또는 hold.

#### 우선순위 큐 기본값

- 하루 신규 deep analysis 최대 2개.
- `ready_for_user_review`는 최대 3개까지만 쌓는다.
- 진행 중인 revise/review가 신규 탐색보다 우선한다.
- `interview_scheduled`가 있으면 study_loop 우선순위를 올린다.
- `blocked`는 `requiredUserAction` 또는 `nextRunAt`이 있는 경우만 재평가한다.

### 결과

- no actionable candidate, needs_more_search, scheduled_retry, blocked, ready_for_user_review, study_loop 분기를 코드 policy로 검증할 수 있다.
- plan029 산출물은 유지하고, 그 위에 runtime 계층을 추가한다.
- plan030은 폐기하지 않고 후보 freshness prerequisite(`sourceFreshness` 검증)로 남긴다.
- public/private boundary와 제출 승인 게이트가 TypeScript `actions.ts` allowlist에서 통제된다.
- 상태 전이 책임이 LLM이 아니라 TypeScript policy/validator에 있어 실행 결과가 코드 수준에서 검증된다.

### 적용

- `docs/flow.md` — agentPhase 상태 모델 + policy matrix + actionable candidate 기준 + 우선순위 큐 추가 (phase-01).
- `docs/data-schema.md` — agentPhase enum 확정 + 검증 규칙 추가 (phase-01).
- `docs/code-architecture.md` — 책임 매트릭스 + policy.ts 결정 흐름 추가 (phase-01).
- `scripts/application-agent/policy.ts` + `ledger_schema.ts` 확장 (phase-02 이후).
- `tasks/plan031-application-flow-agent/`.
