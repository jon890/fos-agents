# Phase 03. 누적 후보 조회와 추천 저장을 연결한다

**Execution profile**: standard

## 목표

fos-blog API의 누적 후보와 추천 이력을 기존 모델 선택·검증·HTML 렌더링 흐름에 연결하고, 추천 리포트 전체를 서버에 저장한다.

**범위 외**: 자료 수집 cursor 구현, 기존 이력 가져오기, 공개 게시 실행, 모델 판단을 점수 스크립트로 대체하는 변경.

## 컨텍스트

기준은 저장소 루트의 AGENTS.md와 career-os/AGENTS.md다.
기존 추천 검증은 `career-os/scripts/study-topic-recommender/reading_selection.ts`, HTML 렌더링은 `career-os/scripts/study-topic-recommender/render/report.ts`, report schema는 `reading_contracts.ts`를 사용한다.
기존 테스트는 `career-os/scripts/study-topic-recommender/reading_candidate_pool.test.ts`, `render/report.test.ts`, `render/html.test.ts`를 기준으로 삼는다.

API 후보 조회는 `historyVersion`과 pagination을 제공한다.
연동모드는 `--prepare-candidates`로 유한 후보 페이지를 읽고 기존 `ReadingCandidatePool` 스키마로 변환한다.
추천 생성은 HTML과 report JSON을 만들기까지만 수행한다.
추천 저장은 `validate_outputs` 검증 뒤 `--commit-recommendation --report <path>`로 같은 report JSON을 재사용해 수행하고, 게시 기록은 외부 게시 성공 뒤 별도 요청으로만 수행한다.

**근거 문서**: repo root 기준 `career-os/docs/flow.md`, `career-os/docs/data-schema.md`, `career-os/docs/code-architecture.md`. career-os cwd 검증 기준 `docs/flow.md`, `docs/data-schema.md`, `docs/code-architecture.md`

## 의도 메모

모델의 추천 판단은 기존처럼 원문과 사용자 방향을 읽어 수행한다.
고정 점수나 키워드 필터는 후보 조회 보조가 될 수 있어도 최종 추천으로 승격하지 않는다.
추천 저장 실패는 추천 완료가 아니다.

## 작업 항목

### 1. career-os/scripts/study-topic-recommender/study-library/candidates.ts 후보 페이지 조회를 구현한다

`GET /candidates`를 CLI 인자에 맞는 유한 페이지로 호출한다.
`limit`은 기본 100이고 최대 100이다.
`--source-key`, `--category`, `--published-from`, `--published-to`, `--limit`, `--cursor`를 query로 전달한다.
첫 페이지의 `historyVersion`을 고정하고 다음 페이지에서 `409 VERSION_CONFLICT`가 오면 후보풀 파일을 만들지 않고 실패한다.
자동으로 처음부터 다시 조회하지 않는다.
응답 후보는 기존 `ReadingCandidatePool`으로 변환한다.

변환 규칙은 다음과 같다.

- `candidate.id`와 `candidate.contentKey`는 API `contentKey`
- `sourceName`, `category`, `title`, `url`, `published`, `kind`, `previouslyRecommended`는 API 응답값
- `excerpt`가 없으면 필드를 생략
- `policy.selection`은 `llm`, `fixedKeywordsUsed`와 `sourcePriorityUsed`는 `false`
- `recentStudyTopicKeys`는 API 응답 배열
- `collectionLog`는 빈 배열. 후보 조회를 수집 성공으로 꾸미지 않는다

`historyVersion`, 요청 필터, API `nextCursor`와 `GET /sources`의 enabled 소스 요약은 후보풀 파일 옆의 `study-library-meta.json`에 저장한다.

### 2. career-os/scripts/study-topic-recommender/study-library/recommendations.ts 추천 저장을 구현한다

기존 `MorningReadingReport`를 API recommendation-runs payload로 변환한다.
`reportId`는 서울 날짜 기준 `morning-YYYY-MM-DD`를 사용한다.
report 파일의 `generatedAt`을 그대로 사용하고 commit 명령에서 새로 생성하지 않는다.
`historyVersion`은 서버 요청 본문에 넣지 않는다.
빈 추천은 `topics: []`로 저장할 수 있어야 한다.
서버가 `ALREADY_RECOMMENDED`나 `RECENT_TOPIC_CONFLICT`를 반환하면 파일 이력에 쓰지 않고 실패한다.
같은 reportId와 같은 본문 재시도는 성공으로 처리하고, 다른 본문 충돌은 실패한다.

외부 게시가 별도 성공한 뒤 호출할 `recordPublication` 함수를 만든다.
이 함수는 report 저장 함수와 분리하고, 게시 실패를 recommendation-runs 저장 실패로 되돌리지 않는다.
CLI는 `--run-dir <RUN_DIR> --library --record-publication --report-id <id> --channel <name> --external-id <id> --published-at <UTC_ISO> --url <HTTPS_URL>`를 제공한다.
`idempotencyKey`는 `publication:` 뒤에 고정 순서 `{reportId,channel,publishedAt,externalId,url}` JSON의 UTF-8 SHA-256 hex를 붙여 만든다.
같은 CLI 입력값을 재사용한 재시도는 같은 키를 써야 한다.

### 3. career-os/scripts/study-topic-recommender/morning_reading_cli.ts library 추천 실행을 연결한다

`--library --prepare-candidates`는 자료 수집 없이 후보풀과 meta만 만든다.
`--library`에서 `--reading-selection`이 있으면 다음 순서로 실행한다.

1. `--candidate-pool`로 지정한 후보풀 로드
2. 기존 `selectReadings` 검증
3. 기존 `writeReportArtifacts`로 HTML 생성. counts는 meta의 enabled 소스 수, 후보에 나타난 sourceKey 수, 후보풀 길이와 카테고리별 enabled 소스 수로 만든다
4. 성공 JSON에 `report`, `html`, `topicCount`, `library:true` 출력

`--library --commit-recommendation --report <RUN_DIR>/state/morning-reading.json`은 검증된 report JSON을 읽어 `POST /recommendation-runs`로 저장한다.
이 명령은 HTML이나 `generatedAt`을 새로 만들지 않는다.

`--library` 추천·후보 준비 실행에서는 `--history-file`을 요구하지 않는다.
`--commit-history`, `--history-file`, `--render-only`와 함께 쓰면 사용법 오류로 실패한다.
파일모드의 기존 `--history-file`, `--candidate-pool`, `--reading-selection`, `--commit-history`, `--render-only` 동작은 유지한다.

### 4. career-os/scripts/study-topic-recommender/study-library/recommendations.test.ts 후보 조회와 추천 저장 테스트를 추가한다

다음을 검증한다.

- pagination으로 받은 후보를 기존 후보풀 schema가 통과한다.
- `historyVersion`이 meta 파일에 남는다.
- 후보 조회 필터와 limit, cursor가 query에 반영된다.
- 페이지 중간 `VERSION_CONFLICT`는 실패로 끝나고 자동 재시작하지 않는다.
- 후보풀 `collectionLog`가 빈 배열이고 report counts가 meta와 후보풀에서 계산된다.
- 후보 조회 성공을 최근 수집 성공으로 출력하지 않는다.
- `previouslyRecommended:true` 후보를 선택하면 기존 선택 검증이 실패한다.
- HTML과 report JSON 생성 단계는 recommendation-runs 요청을 보내지 않는다.
- `validate_outputs` 뒤 commit 명령이 같은 report JSON의 `generatedAt`으로 빈 topics 리포트를 저장 요청으로 보낸다.
- recommendation-runs 요청 본문에 `historyVersion`을 넣지 않는다.
- publication idempotencyKey가 `publication:` 접두사와 고정 순서 JSON SHA-256으로 만들어진다.
- 같은 `--record-publication` CLI 입력값 재시도는 같은 idempotencyKey를 사용한다.
- 추천 저장의 `409 ALREADY_RECOMMENDED`와 `RECENT_TOPIC_CONFLICT`는 완료 JSON을 출력하지 않는다.
- `--library` 추천 실행은 `state/morning-study-history.json`을 쓰지 않는다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/study-topic-recommender/study-library/recommendations.test.ts career-os/scripts/study-topic-recommender/study-library/candidates.test.ts
bun test career-os/scripts/study-topic-recommender/reading_candidate_pool.test.ts career-os/scripts/study-topic-recommender/render/report.test.ts career-os/scripts/study-topic-recommender/render/html.test.ts
bunx tsc -p tsconfig.json
```

- 추천 연동 테스트: 종료 코드 0
- 기존 선택과 렌더 테스트: 종료 코드 0
- CLI 검증은 mock HTTP와 테스트가 만든 임시 run-dir만 사용하며 live `career-os/.env`를 읽지 않음
- TypeScript 검사: 종료 코드 0

## Critical Files

| 파일 | 변경 |
| --- | --- |
| career-os/scripts/study-topic-recommender/study-library/candidates.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/candidates.test.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/recommendations.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/recommendations.test.ts | 신규 |
| career-os/scripts/study-topic-recommender/morning_reading_cli.ts | 수정 |
| career-os/scripts/study-topic-recommender/reading_stage.ts | 필요 시 수정 |
| career-os/docs/flow.md | 참조 |
| career-os/docs/data-schema.md | 참조 |
| career-os/docs/code-architecture.md | 참조 |
