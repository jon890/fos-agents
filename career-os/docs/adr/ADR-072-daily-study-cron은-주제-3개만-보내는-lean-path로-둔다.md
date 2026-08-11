## ADR-072 — daily study 자동화는 주제 3개를 만드는 lean path로 둔다

- Status: Accepted
- Date: 2026-06-09

### 맥락

매일 자동화에 전체 skill 흐름과 후보 발굴을 포함하면 비용과 출력 소음이 커진다.
사용자가 매일 필요로 하는 것은 운영 로그가 아니라 오늘 공부할 주제다.

### 결정

- 자동화 entrypoint는 `scripts/study-topic-recommender/send_daily_recommendation.ts`로 둔다.
- entrypoint는 topic inventory를 갱신하고 최상위 3개 주제를 표준 출력으로 내보낸다.
- 출력은 제목, 짧은 이유, 선택 축, 피한 축을 담는다.
- 후보 refresh와 긴 큐레이션은 필요할 때 skill로 실행한다.
- 스케줄과 외부 전달은 저장소 밖의 실행 환경이 선택한다.

### 결과

매일 자동화는 결정론적인 로컬 스크립트로 동작하고 외부 runtime에 의존하지 않는다.
