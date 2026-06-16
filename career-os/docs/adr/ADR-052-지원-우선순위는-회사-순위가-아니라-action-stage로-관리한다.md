## ADR-052 — 지원 우선순위는 회사 순위가 아니라 action stage로 관리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan048 이후 `position-recommender`는 사용자가 실제로 챙기고 싶은 active/open 공고를 더 잘 모을 수 있게 됐다.
다음 문제는 collected posting을 "어느 회사가 더 좋은가"라는 고정 순위로만 다루지 않고, 지금 무엇을 해야 하는지로 연결하는 것이다.

사용자는 절대적인 회사 선호 순위보다 지원 준비 행동을 관리하고 싶어 한다.
또한 LLM 추천은 매 실행마다 바뀔 수 있으므로, LLM이 만든 추천 초안과 사용자가 최종 확인한 우선순위는 같은 필드에 덮어쓰면 안 된다.

### 결정

- priority는 회사 ranking이 아니라 action-oriented stage로 저장한다.
  - 기본 stage: `prepare-now`, `investigate`, `monitor`, `low-priority`, `hold`, `excluded`.
  - 사용자 표시가 필요하면 `prepare-now=1`, `investigate=2`, `monitor=3`, `low-priority/hold/excluded=4`로 매핑한다.
- LLM은 `recommendation_snapshot`을 생성한다.
  이 snapshot은 `priority_rank`, `action_stage`, `priority_reason`, `next_action`, `risk_flags`, `evidence_urls`, `posting_analysis`, `fit_summary`, `gap_summary`, `preparation_actions`를 포함할 수 있다.
- 사용자가 확정한 값은 `user_confirmed_priority`에 별도로 저장한다.
  LLM refresh는 이 필드를 덮어쓰지 않는다.
- collected posting은 다음 순서로 분석한다.
  1. posting analysis: 공고 상태, 역할, 요구 역량, 마감/지원 경로, evidence URL.
  2. fit analysis: `config/candidate-profile.md`, 기존 resume/profile material, 공고별 application files를 재사용한다.
  3. gap analysis: 부족 근거, 준비 필요 기술, interview/study asset 연결.
  4. priority recommendation: action stage와 next action 초안.
  5. preparation actions: 지원 패키지, 면접 준비, study pack 후보.
- 새 generator를 먼저 만들기보다 기존 자산을 재사용한다.
  - plan048 collected postings와 active/open evidence.
  - `config/candidate-profile.md`와 기존 resume/profile material.
  - application-agent ledger/frontdoor/application package/review 파일.
  - prior recommendation reports와 manual active-open URLs.
  - 기존 study pack / interview asset workflow.
- dashboard는 priority badge/filter, fit summary, gap summary, next action, priority change history를 보여준다.
  user-confirmed priority write action은 별도 승인된 단계에서만 다룬다.

### 결과

- 매일 바뀌는 LLM 추천과 사용자가 확정한 진행 우선순위가 분리된다.
- "1순위 회사"보다 "지금 준비", "조사", "모니터링", "보류", "제외" 같은 행동 중심 운영이 가능해진다.
- 기존 application-agent와 dashboard 흐름을 버리지 않고 그 위에 priority layer를 얹는다.
- 단점: recommendation snapshot과 user-confirmed priority의 병합 규칙이 필요하며, UI는 두 값의 차이를 명확히 보여줘야 한다.

### 적용

- `tasks/plan050-position-priority-fit-workflow/` — 구현 계획.
- `docs/data-schema.md` — priority/action fields and history.
- `docs/flow.md` — collected postings to analysis/priority/preparation flow.
- `docs/code-architecture.md` — existing asset reuse boundary.
- `docs/prd.md` — position priority workflow planned scope.
