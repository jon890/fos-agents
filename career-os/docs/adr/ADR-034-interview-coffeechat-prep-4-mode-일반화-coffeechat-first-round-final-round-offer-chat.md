## ADR-034 — interview-coffeechat-prep 4 mode 일반화 (coffeechat / first-round / final-round / offer-chat)

- Status: Accepted
- Date: 2026-05-19

### 맥락

interview-coffeechat-prep skill은 `mvp-target.json` `primary.coffeechat` 단일 객체 기반으로 커피챗 전략 리포트만 생성했다.
1차 면접 임박으로 first-round 분석 자료도 필요해졌다.
4 mode를 별도 skill로 분리하면 자산 중복이 4배로 늘고 `mvp-target.json` 단일 진실원 원칙이 무너진다.

### 결정

- interview-coffeechat-prep skill을 4 mode로 일반화한다.
  mode: `coffeechat`, `first-round`, `final-round`, `offer-chat`.
- `mvp-target.json` 스키마를 `primary.coffeechat` → `primary.interview.{coffeechat, first_round, final_round, offer_chat}`으로 마이그레이션한다.
  `final-round`와 `offer-chat`은 스키마만 정의하고, 이번 plan에서는 `first-round`만 활성화한다.
- mode 트리거는 slash arg 우선, 자연어 키워드를 fallback으로 사용한다.
- 산출물은 private `report.md`와 개인 정보를 마스킹한 `report-public.md` 두 파일로 생성한다.
- skill rename은 이번 plan 범위 밖으로 별도 결정한다.

거절한 대안:

- 4 mode 각자 별도 skill: 중복 자산 4배. `mvp-target.json` 단일 진실원 원칙이 무너진다.
- public-safe 산출물 inline 마커 + 후처리 split: Claude 프롬프트 정합 부담이 커진다. 두 파일 동시 생성이 더 단순하다.
- coffeechat-prompt.md 4 파일 분리: 중복이 늘어나며, 단일 prompt 안에서 mode를 분기하는 것이 더 낫다.

### 결과

- first-round 즉시 운영이 가능하다.
- `final-round`, `offer-chat` 향후 활성화 비용이 낮다. 스키마와 트리거 분기가 이미 준비됐기 때문이다.
- 기존 `/interview-coffeechat-prep` 호출 동작이 그대로 유지된다.
- 단점: 4 mode 모두 활성화되면 SKILL.md 본문 분기가 비대해질 수 있어 별도 split plan이 필요할 수 있다.
