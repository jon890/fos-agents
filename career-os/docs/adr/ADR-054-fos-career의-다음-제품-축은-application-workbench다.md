## ADR-054 — fos-career의 다음 제품 축은 application workbench다

- Status: Accepted
- Date: 2026-06-07

### 맥락

plan039부터 plan053까지 fos-career는 수집 공고, source diagnostics, priority list/detail, priority write request를 보여주는 방향으로 성장했다.
하지만 사용자가 실제로 필요한 다음 단계는 "어떤 공고가 수집됐는가"보다 "어떤 지원 준비가 어디까지 됐고 지금 무엇을 해야 하는가"이다.

현재 applications 화면은 ledger record와 raw file contents를 확인할 수 있지만, 준비 상태, 산출물 완성도, 다음 행동, 차단 사유를 제품의 중심으로 보여주지는 않는다.
따라서 fos-career의 다음 기능 축은 collection dashboard가 아니라 application preparation workbench여야 한다.

### 결정

- fos-career는 frontdoor queue와 ledger를 합쳐 application workbench projection을 제공한다.
- projection은 read-only로 계산한다.
  fos-career MySQL에 새 원장을 만들지 않고, career-os 파일도 수정하지 않는다.
- 각 후보는 stage, status, fit score, material readiness, next action, blocker/risk flag를 한 화면에서 보여준다.
- material readiness는 posting, fit analysis, application package, review 파일 존재 여부에서 계산한다.
- application detail 화면은 raw record dump보다 준비 진행 상태와 다음 행동을 우선 노출한다.
- 쓰기 행동이 필요하면 plan053과 같은 pending request bridge를 먼저 설계한다.

거절한 대안:

- 현재 collected posting dashboard만 계속 확장하기.
  공고 수집 상태는 보이지만 지원 준비 행동으로 이어지는 정보 구조가 약하다.
- fos-career MySQL에 application status 원장을 새로 만들기.
  MVP에서는 career-os ledger/frontdoor와 이중 원장이 생기고 정합성 비용이 커진다.
- dashboard에서 지원 패키지를 직접 생성/수정하기.
  사용자 승인, 공개 발행, candidate-profile mutation 경계가 섞인다.
- 외부 채용 사이트 제출 자동화까지 workbench MVP에 포함하기.
  위험과 검증 비용이 커서 별도 승인된 plan으로 분리해야 한다.

### 결과

- fos-career의 사람용 화면은 수집/추천 확인에서 실제 준비 운영 화면으로 확장된다.
- career-os는 계속 데이터와 mutation의 진실 출처로 남는다.
- 준비 산출물 누락과 다음 행동이 한 화면에 드러나므로, 자율 agent가 다음 task를 고르기 쉬워진다.
- 단점: readiness projection 계산 규칙이 필요하며, frontdoor record와 ledger record의 상태 표현을 UI에서 명확히 분리해야 한다.

### 적용

- `tasks/plan054-fos-career-application-workbench/` — 구현 계획.
- `docs/prd.md` — application workbench planned scope.
- `docs/data-schema.md` — workbench projection shape.
- `docs/flow.md` — read-only workbench flow.
- `docs/code-architecture.md` — adapter/UI responsibility boundary.
