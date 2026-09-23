## ADR-123: 회사 근거와 개인 제외 정책은 Backend가 소유한다

- **status**: `accepted`
- **결정**: `state/company-research/`의 회사 조사 파일과 `state/private-config/position-exclusions.json`을 `fos_career`로 옮긴다. 회사 근거는 `company_evidence`가, 개인 제외 규칙은 `position_exclusions`가 담는다. skill은 비공개 작업 release를 준비하고 반영하는 두 단계를 더는 밟지 않는다. 수집기는 외부 요청 전에 `GET api/positions/v1/exclusions`로 규칙을 읽고, 근거는 `PUT api/positions/v1/company-tier-runs/:companyTierRunId/evidence`로 저장한다.
- **맥락**: 포지션 추천의 상태 가운데 공고와 분석과 추천 실행은 이미 Backend가 소유한다. 파일로 남은 것은 둘뿐이고 크기도 작다. 2026-09-22 기준 회사 조사가 8개 파일, 개인 제외 규칙이 1개 파일이다. 이 둘 때문에 skill이 `career-workspace/cli.ts skill begin`과 `skill finish`를 부르고, 그 두 명령의 실패 처리까지 skill 문서가 설명한다. 읽는 자리는 `scripts/position-recommender/company-research/store.ts`와 `scripts/position-recommender/feedback/exclusions.ts` 둘이다. 그리고 근거를 깊게 모으기로 하면서 저장할 양이 는다. DART 직원 현황과 기술 블로그와 GitHub 수집 결과가 회사마다 쌓이는데, 파일에 두면 회사 하나의 근거가 늘 때마다 release 전체를 다시 전송하게 된다.
- **대안 기각**:
  - 파일을 그대로 두고 근거만 DB에 두는 안은 기각했다. 같은 회사의 사실이 두 곳에 갈려 어느 쪽이 최신인지 판정할 수 없다. 유효기간 계산도 두 벌이 된다.
  - 파일을 두고 Backend가 그 파일을 읽는 안은 기각했다. Backend는 홈서버 container에서 돌고 파일은 맥북의 작업본에 있다. 지금 release 전송이 그 간격을 메우고 있는데, 그것을 유지하려고 DB 이전을 미루면 [ADR-114](ADR-114-개인-공고-제외-정책을-비공개-release로-전송한다.md)의 전송 절차가 그대로 남는다.
  - 개인 제외 규칙만 파일에 남기는 안은 기각했다. 규칙이 한 개 파일이라 옮기는 비용이 가장 작고, 남기면 `skill begin`과 `skill finish`가 그 하나 때문에 계속 필요하다.
- **결과**:
  - 얻는 것: skill에서 파일 동기화 단계와 그 실패 처리가 사라진다. 회사 근거가 늘어도 전송량이 늘지 않는다. 유효기간 판정이 한 곳에서 일어난다. 여러 실행이 같은 근거를 공유한다.
  - 제외 규칙 전체가 새 잠금 단위가 된다. `PUT exclusions` 가 받은 배열로 통째로 대체하므로 [ADR-122](ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md)의 다섯 단위에 하나가 더해진다.
  - 감당할 것: 사람이 회사 조사와 제외 규칙을 고치던 경로가 사라진다. 지금은 파일을 직접 열어 고친다. `PUT exclusions`가 그 자리를 대신하지만 편집기로 여는 것만큼 편하지 않다. 기존 파일 9개를 옮기는 일회성 명령이 필요하고, 옮긴 뒤 원본을 지우기 전에 행 수를 대조해야 한다. Backend가 내려가면 수집 자체가 시작되지 않는다. 지금도 공고 저장이 Backend에 기대므로 새로 생기는 의존은 아니다.
- **적용 범위**: `services/recommendation-api/`의 schema와 저장 계층과 controller, `scripts/position-recommender/company-research/`와 `feedback/exclusions.ts`, `.claude/skills/position-recommender/SKILL.md`, `config/position-exclusions.ts`, `docs/data-schema.md`, `docs/flow.md`, `docs/code-architecture.md`. [ADR-114](ADR-114-개인-공고-제외-정책을-비공개-release로-전송한다.md)와 [ADR-115](ADR-115-회사-조사-사실은-유효기간과-함께-재사용한다.md)를 대체한다. ADR-115의 유효기간 재사용이라는 결정 자체는 유지하고 저장 위치만 바뀐다. 다른 skill의 `state/` 사용은 손대지 않는다.
