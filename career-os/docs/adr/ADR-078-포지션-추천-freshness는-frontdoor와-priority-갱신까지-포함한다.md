## ADR-078 — 포지션 추천 freshness는 frontdoor와 priority 갱신까지 포함한다

- Status: Accepted
- Date: 2026-06-12

### 맥락

ADR-077로 position daily runner는 최신 추천 리포트 생성 실패를 감지하게 됐다.
하지만 dashboard가 읽는 `frontdoor-queue.jsonl`과 priority snapshot은 별도 runner가 갱신해야 해서, 추천 리포트가 최신이어도 application workbench는 오래된 후보와 action stage를 보여줄 수 있었다.

또한 fos-career web container는 career-os를 읽기 전용으로 mount한다.
이는 dashboard 안전 경계에는 맞지만, pending request processor가 career-os 원장을 갱신하려면 host-side writable checkout에서 실행돼야 한다.
interview request processor에는 host-side wrapper가 있었지만 position/application action processor에는 같은 운영 진입점이 없었다.

### 결정

- position daily runner의 성공 기준은 최신 `position-recommendation.md` 생성에서 끝나지 않는다.
- daily runner 성공 후 frontdoor queue builder와 priority recommendation refresh를 순서대로 실행한다.
- frontdoor queue 갱신은 기존 user decision과 protected status를 보존해야 한다.
- priority refresh는 recommendation snapshot을 갱신하되 user-confirmed priority를 덮어쓰지 않는다.
- fos-career write processor는 web container 안이 아니라 host-side wrapper로 실행한다.
- host-side wrapper는 `.env`를 로드하고, Docker network hostname을 host-published MySQL port로 보정한다.
- dashboard container에 writable career-os mount를 주는 대안은 거절한다.

### 결과

- daily 추천 알림과 dashboard application workbench가 같은 최신 추천 cycle을 보게 된다.
- 사용자가 `지원 준비`, `보류`, `제외`를 누른 뒤 processor를 실행할 운영 진입점이 명확해진다.
- web app의 read-only mount 안전 경계는 유지된다.
- 단점은 daily runner가 추천 리포트 생성 외에도 queue/priority refresh 실패를 함께 다뤄야 한다는 점이다.

### 적용

- `scripts/position-recommender/run_daily_with_claude.ts`
- `scripts/application-agent/frontdoor_queue_builder.ts`
- `scripts/application-agent/priority_recommendation.ts`
- `/home/bifos/services/fos-career/scripts/run-*-processor.sh`
- `docs/flow.md`
- `docs/code-architecture.md`
