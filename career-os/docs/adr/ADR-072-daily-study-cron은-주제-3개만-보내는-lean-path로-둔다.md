## ADR-072 — daily study cron은 주제 3개만 보내는 lean path로 둔다

- Status: Accepted
- Date: 2026-06-09

### 맥락

ADR-071로 native `study-topic-recommender`의 비대화형 권한 대기 문제는 해결했다.
하지만 daily cron을 매번 native Claude skill로 실행하면 토큰 비용이 크고, Discord 결과도 실행 로그 중심으로 길어질 수 있다.

사용자가 원하는 daily 경험은 운영 로그가 아니라 오늘 공부할 주제만 빠르게 보는 것이다.
후보 refresh, 의미 기반 중복 검토, 긴 큐레이션 설명은 필요할 때 on-demand로 실행하면 충분하다.

### 결정

- daily study cron은 native Claude skill을 호출하지 않는다.
- daily study cron은 `refresh_topic_inventory.ts`를 직접 실행한다.
- Discord에는 `recommendations[0:3]`의 제목, 짧은 이유, 추천한 이유 묶음, 일부러 피한 축만 보낸다.
- 실행 로그, self-check 전문, 비용·토큰 세부사항은 Discord 요약에 남기지 않는다.
- full report 경로는 짧게 남긴다.
- 후보 refresh가 필요하면 on-demand `claude --permission-mode bypassPermissions -p "/study-topic-recommender ..."`로 별도 실행한다.

### 결과

- 매일 알림의 토큰 비용과 채널 소음을 줄인다.
- 사용자는 `#병태-이직준비방`에서 바로 공부할 주제만 본다.
- 동적 후보 발굴 경로는 유지하되 매일 cron의 기본 비용으로 만들지 않는다.

### 적용

- `docs/flow.md`
- OpenClaw cron `career-os:daily-study-topic-recommendation`
