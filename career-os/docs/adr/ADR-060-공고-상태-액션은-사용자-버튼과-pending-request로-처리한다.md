## ADR-060 — 공고 상태 액션은 사용자 버튼과 pending request로 처리한다

- Status: Accepted
- Date: 2026-06-07

### 맥락

fos-career workbench는 frontdoor queue와 ledger를 함께 보여주고, plan055 이후 이력서 패키지 생성까지 연결할 수 있다.
하지만 사용자가 특정 공고를 명시적으로 보류하거나 제외하거나 지원 준비로 넘기는 조작은 아직 화면과 request contract가 분리되어 있지 않다.

dashboard가 career-os 파일을 직접 쓰면 read-only safety boundary가 깨진다.
반대로 모든 결정을 채팅이나 수동 CLI로만 처리하면 공고 검토 흐름이 느려지고, 사용자의 의사결정 이력이 화면에 남지 않는다.

### 결정

- plan059를 공고 상태 사용자 액션으로 연다.
- dashboard 버튼은 `보류`, `제외`, `지원 준비` 세 가지를 기본값으로 둔다.
- 사유 입력은 optional로 둔다.
  사용자가 사유를 쓰지 않으면 시스템 기본 사유를 `effectiveReason`으로 저장한다.
- `보류`는 action stage를 `hold`로 바꾼다.
- `제외`는 action stage를 `excluded`로 바꾸고 추천/준비 후보에서 제외한다.
- `지원 준비`는 상태 변경에서 멈추지 않고 필요한 내부 산출물 생성을 시작한다.
  frontdoor 후보는 ledger 승격을 거친 뒤 이력서 패키지 생성 흐름으로 이어진다.
- fos-career는 career-os 파일을 직접 쓰지 않고 `user_position_action_requests` pending queue에 요청을 저장한다.
- processor는 요청 당시 snapshot과 현재 career-os record를 비교해 stale 요청을 막는다.
- 외부 제출, 로그인, 업로드, 공개 발행은 수행하지 않는다.

### 결과

- 사용자는 dashboard에서 공고별 의사결정을 빠르게 남길 수 있다.
- 지원 준비 버튼은 이력서 패키지 생성까지 이어지지만, 최종 제출은 사용자 수동 행동으로 남는다.
- action history와 request status가 fos-career DB에 남아 실패, stale, 재시도 판단이 쉬워진다.
- career-os 원장 mutation은 controlled runner가 수행해 read-only dashboard 경계를 유지한다.

### 적용

- `tasks/plan059-position-state-actions/` — 후속 구현 계획.
- `docs/prd.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/code-architecture.md`
