## ADR-128: 커리어 Backend로 이름을 넓힌다

- **status**: `accepted`
- **결정**: `services/recommendation-api` 를 `services/career-backend` 로, 환경값 `CAREER_RECOMMENDATION_*` 를 `CAREER_BACKEND_*` 로, client 모듈과 타입의 `RecommendationApi` 를 `CareerBackend` 로 바꾼다. 문서의 「추천 Backend」 와 「추천 상태 Backend」 는 「커리어 Backend」 로 쓴다. 옛 환경값은 전환 기간에만 받고, 운영 전환을 확인한 뒤 코드에서 뺀다.
- **대체된 부분**: [ADR-121](ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md)의 이름만 대체한다. NestJS 와 Prisma 로 운영한다는 결정은 그대로다.
- **맥락**: 이 Backend 는 처음에 포지션 추천의 장기 상태만 담았다. 지금은 공부 소스와 자료, 추천 판정, 회사 근거와 개인 제외 규칙까지 담는다([ADR-123](ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md), [ADR-126](ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md)). DB 이름은 처음부터 `fos_career` 였다. 이름이 「추천」 에 묶여 있으면 추천이 아닌 데이터를 어디에 둘지 판단할 때 매번 이름과 실제 범위가 어긋난다. 홈서버 설정은 이미 `CAREER_BACKEND_IMAGE`, `CAREER_BACKEND_MEM_LIMIT` 를 쓴다.
- **대안 기각**:
  - 설명만 바꾸고 식별자를 두는 안은 기각했다. 환경값과 디렉터리 이름이 계속 「추천」 을 말해 설명과 코드가 어긋난다.
  - `career-api` 는 기각했다. 짧지만 홈서버의 `CAREER_BACKEND_*` 와 접두사가 둘로 갈린다.
  - 옛 환경값 없이 한 번에 바꾸는 안은 기각했다. hermes 는 fos-agents checkout 을 15분마다 받고 환경값은 fos-home-infra 배포 때 바뀐다. 두 시점이 달라 그 사이에 cron 이 돌면 연결 설정을 찾지 못한다.
- **결과**:
  - 얻는 것: 이름이 담는 범위와 실제 범위가 같다. 새 커리어 데이터를 이 Backend 에 둘지 판단할 때 이름이 방해하지 않는다.
  - 감당할 것: 전환 기간에는 같은 값을 두 이름으로 받는다. 환경값마다 새 이름이 있으면 새 이름을, 없으면 옛 이름을 읽는다. ghcr image 이름도 바뀌므로 옛 image 는 새 이름으로 다시 push 하지 않는다. DB 이름과 계정, API 경로는 바꾸지 않는다.
- **적용 범위**: `services/career-backend/`, `scripts/lib/career-backend-config.ts`, `scripts/position-recommender/career-backend/`, `scripts/study-topic-recommender/study-library/client.ts`, `.env.example`, `docs/code-architecture.md`, `docs/data-schema.md`, `docs/flow.md`.
