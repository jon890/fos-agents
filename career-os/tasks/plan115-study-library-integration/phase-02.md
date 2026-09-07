# Phase 02. 최근·과거 수집과 cursor 저장을 연결한다

**Execution profile**: deep

## 목표

소스별 `recent`와 `archive` 수집을 분리하고, 자료 배치와 다음 cursor를 fos-blog API에 같은 요청으로 저장한다.

**범위 외**: 추천 모델 선택, HTML 렌더링, 기존 이력 가져오기 UI, 서버 트랜잭션 구현, 파일모드 동작 변경.

## 컨텍스트

기준은 저장소 루트의 AGENTS.md와 career-os/AGENTS.md다.
기존 최신 수집은 `career-os/scripts/study-topic-recommender/source/adapters/`와 `reading_candidate_pool.ts`가 담당한다.
새 archive 수집은 `career-os/scripts/study-topic-recommender/source/archive/`에 두고, API cursor는 sourceKey와 mode별로 읽고 저장한다.
archive 진입점은 `config/external-reading-sources.ts`에 추가하지 않고 sourceKey별 고정 지원 registry로 둔다.
registry에는 Kurly와 OliveYoung sitemap index URL, Kakao sitemap URL과 `/posts/` prefix, YouTube uploads playlist ID 해석 규칙을 둔다.
이 phase에서는 config schemaVersion을 올리지 않는다.
Kurly와 OliveYoung의 현재 adapter는 `feed`로 유지하고, archive mode에서만 registry가 sitemap index 수집기를 고른다.

recent와 archive의 실행 한도는 외부 요청량과 배치 크기를 제한한다.
누적 자료 보관 개수로 사용하면 안 된다.
수집 실패 또는 YouTube API 키 부재처럼 다음 위치를 확정할 수 없는 상태에서는 ingestion 요청을 보내지 않는다.

**근거 문서**: repo root 기준 `career-os/docs/flow.md`, `career-os/docs/code-architecture.md`, `career-os/docs/data-schema.md`. career-os cwd 검증 기준 `docs/flow.md`, `docs/code-architecture.md`, `docs/data-schema.md`

## 의도 메모

cursor 단독 저장을 만들면 자료 저장 실패 뒤 다음 실행이 자료를 건너뛸 수 있다.
자료 배치와 cursor는 API의 `POST /ingestions` 하나로만 진행한다.
응답이 유실되면 같은 idempotencyKey와 같은 본문으로 재시도한다.

## 작업 항목

### 1. career-os/scripts/study-topic-recommender/source/archive/ 과거 수집 cursor와 지원 registry를 구현한다

다음 수집기와 지원 registry를 만든다.

- `registry.ts`: `kurly-tech`, `oliveyoung-tech`, `kakao-tech`, YouTube sourceKey의 archive 지원 여부와 진입점을 정의한다. 지원하지 않는 sourceKey는 archive mode에서 명확한 skipped 상태를 반환한다.
- sitemap index 수집기: `sitemapIndexUrl`, `indexDigest`, `pendingSitemaps`, `completedSitemaps`, `currentSitemap`, `lastUrl`, `done` cursor를 사용한다. Kurly `https://helloworld.kurly.com/sitemap-index.xml`과 OliveYoung `https://oliveyoung.tech/sitemap-index.xml`을 처리한다.
- 단일 sitemap posts 수집기: `sitemapUrl`, `sitemapDigest`, `onlyPathPrefix`, `lastUrl`, `done` cursor를 사용한다. Kakao `https://tech.kakao.com/sitemap.xml`에서 `/posts/` URL만 수집한다.
- YouTube uploads 수집기: `uploadsPlaylistId`, `pageToken`, `pendingVideoIds`, `apiKeyRequired`, `done` cursor를 사용한다. `YOUTUBE_DATA_API_KEY`가 없으면 archive mode는 `PHASE_BLOCKED: YOUTUBE_DATA_API_KEY 없음`을 출력하지 말고 해당 소스만 수집 불가 상태로 반환한다.

발행일을 sitemap 발견 시각으로 채우지 않는다.
원문에서 발행일을 확인하지 못하면 `published: ""`, `publishedAt: null`에 해당하도록 변환한다.
최근 feed 수집은 기존처럼 `feed-article` 또는 `feed-video` kind를 사용하고, archive sitemap 수집은 같은 sourceKey라도 `page-link` kind를 사용한다.
YouTube uploads archive 수집은 `page-video` kind를 사용한다.
각 수집기는 최대 `maxItems`까지만 자료를 만들고 다음 cursor를 반환한다.
YouTube API는 한 페이지가 50개이므로 `maxItems: 48`에서 pageToken만 진행하면 남은 2개가 유실된다.
pendingVideoIds에 현재 페이지에서 아직 저장하지 않은 video ID를 보존하고, pendingVideoIds를 모두 저장한 뒤에만 nextPageToken으로 이동한다.
sitemap 수집도 한 sitemap 중간에서 멈추면 `currentSitemap`과 `lastUrl`을 보존한다.
sitemap index나 sitemap 본문 digest가 이전 cursor와 달라지면 실패하고 cursor를 진행하지 않는다.
cursor JSON은 64 KiB를 넘지 않아야 하며, 초과가 예상되면 pending 목록 대신 현재 sitemap과 lastUrl 중심으로 줄인다.
더 가져올 항목이 없으면 `done:true`를 저장한다.

### 2. career-os/scripts/study-topic-recommender/study-library/ingestion.ts 자료 배치 저장을 구현한다

recent 수집은 library 전용 strict 수집 경계를 사용한다.
기존 파일모드 adapter의 실패 처리와 cache fallback 동작은 유지한다.
library 수집에서는 HTTP 실패, 파싱 실패와 stale cache를 성공으로 바꾸지 않고 ingestion을 보내지 않는다.
정상 문서 구조를 검증한 빈 feed나 빈 페이지만 성공한 빈 수집으로 취급한다.
recent cursor는 `lastSeen`에 직전 성공 수집에서 확인한 contentKey를 보존하고, feed와 page는 `fetchedAt`에 확인 시각을 기록한다.
YouTube recent는 `rssOnly:true`와 `lastSeen`을 사용하고 API 키 없이 공식 RSS를 수집한다.
이번 응답에서 이미 `lastSeen`에 있는 자료는 제외하며 새 자료를 maxItems까지만 보낸다.
한도로 아직 저장하지 못한 자료의 키는 다음 lastSeen에 넣지 않는다.
다음 lastSeen은 현재 응답에 있는 기존 키와 이번에 저장할 키만 합쳐 cursor 크기 제한 안에서 보존한다.
키가 cursor에서 빠져 다시 수집돼도 서버의 contentKey upsert가 중복 자료 생성을 막는다.
다음 cursor는 ingestion 성공 응답을 받은 경우에만 진행된 것으로 처리한다.

`GET /sources/{sourceKey}/cursor?mode=recent|archive`로 cursor와 version을 읽는다.
수집 결과를 API item으로 변환하고, `expectedCursorVersion`과 `idempotencyKey`를 포함해 `POST /ingestions`로 보낸다.
한 배치는 100개 이하로 자른다.
같은 배치 안의 contentKey 중복은 API 호출 전에 실패시킨다.
`--reset-cursor`가 있으면 기존 cursor 값은 무시하고 source registry의 초기 archive cursor에서 배치를 만든다.
이때도 기존 cursor version을 `expectedCursorVersion`에 넣는다.
standalone reset API를 만들지 않는다.
ingestion이 성공해야 기존 cursor가 새 cursor로 교체되며, 실패하거나 충돌하면 기존 cursor를 유지한다.
`done:true` archive 재수집도 이 경로만 사용한다.

idempotencyKey는 sourceKey, mode, 조회한 cursor version, 정렬된 contentKey 목록과 다음 cursor hash가 바뀌면 달라져야 한다.
같은 본문 재시도에는 같은 key를 재사용한다.
API 성공 응답을 받기 전에는 cursor 진행 로그를 남기지 않는다.

### 3. career-os/scripts/study-topic-recommender/morning_reading_cli.ts library 수집 CLI를 연결한다

다음 인자를 추가한다.

- `--run-dir <path>`: 실행별 시스템 임시 디렉터리. 기존 `CAREER_OS_ROOT`와 같은 검증을 적용한다.
- `--library`: API 연동모드
- `--mode recent|archive`: 기본 `recent`
- `--source-key <key>`: 지정하면 해당 소스만 수집
- `--max-items <n>`: 한 실행에서 소스별로 처리할 자료 수. 기본은 기존 `DEFAULT_MAX_CANDIDATES_PER_SOURCE`
- `--reset-cursor`: archive 단일 source를 초기 cursor에서 다시 수집한다

`--library --collect-only`는 소스 동기화, cursor 조회, 수집, ingestion 저장 순서로 실행한다.
성공 JSON에는 `mode`, `sourceCount`, `acceptedCount`, `cursorUpdates`를 포함한다.
API 오류는 code와 requestId를 포함해 실패한다.
`--library --collect-only`는 `--history-file`, `--commit-history`, `--render-only`와 함께 쓰면 실패한다.
`--reset-cursor`는 `--library --collect-only --mode archive --source-key <key>` 조합에서만 허용한다.
sourceKey가 없거나 recent mode이면 사용법 오류로 실패한다.
파일모드에서는 새 인자가 기존 동작을 바꾸지 않아야 한다.

### 4. career-os/scripts/study-topic-recommender/runtime-paths.ts 경로 해석을 확장한다

기존 `resolveStudyRunRoot`는 `CAREER_OS_ROOT`만 읽는다.
`--run-dir <path>`도 같은 시스템 임시 실행 경로 검증을 통과하도록 추가한다.
CLI 인자와 환경값이 둘 다 있으면 같은 실제 경로일 때만 허용하고, 다르면 사용법 오류로 실패한다.
`validate_outputs.ts`도 같은 경로 해석을 사용하게 수정해 문서의 `validate_outputs.ts --run-dir <RUN_DIR>` 예제가 동작하게 한다.

### 5. career-os/scripts/study-topic-recommender/study-library/ingestion.test.ts 수집 저장 테스트를 추가한다

다음을 검증한다.

- recent cursor의 lastSeen 자료는 제외하고 새 자료와 다음 cursor를 함께 저장한다.
- recent 한도로 남은 자료는 lastSeen에 넣지 않아 다음 실행에서 수집할 수 있다.
- 정상 빈 feed는 빈 ingestion을 보내고, HTTP 실패·파싱 실패·stale cache는 ingestion을 보내지 않는다.
- YouTube recent는 API 키 없이 RSS를 수집하고 rssOnly와 lastSeen을 보존한다.
- Kurly와 OliveYoung sitemap index cursor가 다음 sitemap과 URL 위치를 보존한다.
- Kakao 수집기는 `/posts/` 경로만 후보로 만든다.
- YouTube API 키가 없으면 archive ingestion 요청을 보내지 않고 상태를 출력한다.
- YouTube 수집기는 한 페이지 50개 중 `maxItems:48` 이후 남은 2개를 pendingVideoIds로 다음 실행에서 처리한다.
- sitemap digest가 바뀌면 ingestion 요청을 보내지 않는다.
- `--reset-cursor`는 archive 단일 source에서만 허용되고, 기존 cursor version을 expectedCursorVersion으로 보낸다.
- `--reset-cursor` 성공은 ingestion 성공 응답으로만 판정하며 standalone reset API를 호출하지 않는다.
- `done:true` cursor도 `--reset-cursor`가 있으면 초기 cursor에서 다시 수집한다.
- cursor JSON이 64 KiB를 넘지 않는지 검증한다.
- 자료 저장 API가 실패하면 다음 cursor가 진행된 것으로 기록되지 않는다.
- 정상 빈 페이지는 items 빈 배열과 다음 cursor를 저장할 수 있다.
- `--library --collect-only --mode recent --run-dir <RUN_DIR>`는 파일모드 history를 읽지 않는다.
- `--run-dir`와 `CAREER_OS_ROOT`가 같으면 통과하고 다르면 사용법 오류로 실패한다.
- `validate_outputs.ts --run-dir <RUN_DIR>`가 같은 실행 경로를 읽는다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/study-topic-recommender/source/archive career-os/scripts/study-topic-recommender/study-library/ingestion.test.ts
bun test career-os/scripts/study-topic-recommender/source/adapters
bun test career-os/scripts/study-topic-recommender/runtime-paths.test.ts
bun test career-os/scripts/study-topic-recommender/render/report.test.ts
bunx tsc -p tsconfig.json
```

- archive와 ingestion 테스트: 종료 코드 0
- 기존 source adapter 테스트: 종료 코드 0
- CLI 검증은 mock HTTP와 테스트가 만든 임시 run-dir만 사용하며 live `career-os/.env`를 읽지 않음
- TypeScript 검사: 종료 코드 0

## Critical Files

| 파일 | 변경 |
| --- | --- |
| career-os/scripts/study-topic-recommender/source/archive/ | 신규 |
| career-os/scripts/study-topic-recommender/source/archive/registry.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/ingestion.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/ingestion.test.ts | 신규 |
| career-os/scripts/study-topic-recommender/morning_reading_cli.ts | 수정 |
| career-os/scripts/study-topic-recommender/runtime-paths.ts | 수정 |
| career-os/scripts/study-topic-recommender/runtime-paths.test.ts | 수정 |
| career-os/scripts/study-topic-recommender/validate_outputs.ts | 수정 |
| career-os/scripts/study-topic-recommender/reading_contracts.ts | 필요 시 수정 |
| career-os/docs/flow.md | 참조 |
| career-os/docs/code-architecture.md | 참조 |
| career-os/docs/data-schema.md | 참조 |
