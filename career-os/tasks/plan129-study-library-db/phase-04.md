# Phase 04. client 를 Backend 에 붙이고 파일모드를 지운다

**Execution profile**: deep

## 목표

`study-topic-recommender` 의 client 가 Phase 01 부터 03 의 Backend 만 쓰게 한다.
파일모드와 config 소스 동기화와 import preview 를 지우고,
사람이 소스와 기준 버전을 고치는 명령과 파일 원본을 옮기는 일회성 명령을 만든다.

이 phase 가 끝나면 `morning_reading_cli.ts` 가 파일에 이력을 읽거나 쓰지 않는다.

**범위 외**: skill 문서는 Phase 05 다. 운영 이관은 하지 않는다.

## 컨텍스트

지금 `scripts/study-topic-recommender/morning_reading_cli.ts` 의 `main` 은 `--library` 가 있으면
`runLibrary` 로, 없으면 파일모드로 간다.
파일모드는 `persistence/history.ts` 가 소유하는 `state/morning-study-history.json` 을 읽고 `--commit-history` 로 쓴다.
`runLibrary` 는 시작할 때 `study-library/source-sync.ts` 로 `config/external-reading-sources.ts` 를 API 에 밀어 넣는다.
`--import-preview` 는 `study-library/imports.ts` 를 쓴다.

client 의 환경값은 `study-library/client.ts` 가 `STUDY_LIBRARY_URL` 과 `STUDY_SERVICE_TOKEN` 으로 읽는다.
`STUDY_LIBRARY_URL` 은 HTTPS origin 만 받는다.
포지션 client 인 `scripts/position-recommender/recommendation-api/client.ts` 는
`CAREER_RECOMMENDATION_API_URL` 과 `CAREER_RECOMMENDATION_API_TOKEN` 과 `CAREER_RECOMMENDATION_API_TOKEN_FILE` 을 읽고
프로토콜을 제한하지 않는다. 홈서버 cron 은 container 내부망의 http 주소로 Backend 를 부른다.

**Backend 의 멱등 처리는 `Idempotency-Key` 헤더를 요구한다.** 지금 공부 client 는 그 헤더를 보내지 않는다.
ingestion 과 publication 본문에는 `idempotencyKey` 가 있지만 추천과 소스, 기준 변경 본문에는 없다.
이대로면 모든 쓰기 요청이 거절된다.

파일 원본이다. 운영에서 옮기기 전에는 지우지 않는다.

| 원본 | 규모 |
| --- | --- |
| `config/external-reading-sources.ts` | 소스 목록. 활성 35개 |
| `state/morning-study-history.json` | 운영 이관 대상. 이 작업에서는 읽지 않는다 |

`career-os/state/` 는 gitignore 라 워크트리에 없다. 옮기는 명령은 원본 경로를 인자로 받는다.
오버레이가 `state/` 읽기 전에 홈서버 동기화를 요구하므로, 이 작업은 원본을 읽지 않고
같은 구조의 fixture 로 검증한다. 원본 dry-run 과 운영 이관은 코디네이터가 나중에 확인한다.

**근거 문서**: `docs/flow.md` 의 「study-topic-recommender」 절,
`docs/code-architecture.md` 의 「study-topic-recommender」 절,
`docs/data-schema.md` 의 「파일에서 옮기는 것」 절,
`docs/adr/ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md`,
`docs/adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md`

## 의도 메모

**환경값을 포지션 client 와 합친다.** 같은 Backend 를 두 이름으로 가리키지 않는다.
token 파일을 읽는 규칙도 같게 한다. 두 client 가 쓸 함수를
`scripts/lib/recommendation-api-config.ts` 로 옮겨 함께 쓴다.

**모델이 고르지 않은 후보에 이유를 남긴다.**
선택 파일의 zod 계약인 `reading_contracts.ts` 에 `rejections` 를 더한다. `{ candidateId, reason }` 배열이다.
후보풀의 모든 후보를 덮을 필요는 없다. 이유 없이 빠진 후보는 판정이 없어 다음 날 다시 나온다.
`rejections` 의 `candidateId` 는 후보풀에 있어야 하고 선택한 것과 겹치면 안 된다.

**`--render-only` 는 남긴다.** 실행 디렉터리 안의 리포트를 다시 그리는 도구이고 저장소의 `state/` 를 읽지 않는다.

**이관은 기존 경로를 그대로 쓴다.** 새 import endpoint 를 만들지 않는다.
이력의 자료는 `study_materials` 에 없으므로 추천을 저장하기 전에 `POST /ingestions` 로 먼저 넣는다.
이때 소스의 현재 cursor 를 받아 그 값을 그대로 돌려보내 cursor 내용이 바뀌지 않게 한다.
자료의 `kind` 는 소스의 adapter 가 `youtube` 면 `feed-video`, 아니면 `feed-article` 이다.
`url` 은 `canonicalUrl`, `published` 는 빈 문자열, `publishedAt` 과 `excerpt` 는 `null`, `collectedAt` 은 entry 의 `recommendedAt` 이다.
이력에 없는 값은 지어내지 않는다.

## 작업 항목

### 1. 환경값과 URL 규칙을 포지션 client 와 합친다

`study-library/client.ts` 가 `CAREER_RECOMMENDATION_API_URL` 과 token 둘 중 하나를 읽는다.
`STUDY_LIBRARY_URL` 과 `STUDY_SERVICE_TOKEN` 을 지운다. `.env.example` 에서도 지운다.
공용 모듈은 `parseRecommendationApiOrigin(raw): URL` 과
`resolveRecommendationApiConnection(environment): { baseUrl: string; token: string }` 을 내보낸다.
URL 은 HTTP 또는 HTTPS origin 만 받으며 credentials, query, hash, path 를 거부한다.
직접 token 과 token 파일은 정확히 하나만 받아야 한다. 파일은 권한 0600 이어야 하고
읽은 token 은 trim 한 뒤 32자 이상이어야 한다.
포지션 `recommendation-api/client.ts` 의 `createRecommendationApiClient` 도 이 모듈을 쓴다.
공부 client 의 명시적 origin·token 옵션은 같은 URL·token 검증을 적용한다.

### 2. 쓰기 요청에 `Idempotency-Key` 헤더를 붙인다

본문에 `idempotencyKey` 가 있는 요청은 그 값을 헤더로도 보낸다.
`PUT /sources/{sourceKey}` 는 본문에 키가 없다.
`source:` 뒤에 `{sourceKey, payload}` 의 canonical JSON SHA-256 hex 를 붙여 만든다.
`POST /recommendation-runs` 는 `recommendation:` 뒤에 `{reportId,generatedAt}` 의
canonical JSON SHA-256 hex 를 붙인다. 본문에는 `idempotencyKey` 를 추가하지 않는다.
`PUT /recommendation-control` 은 명령 실행마다 새 UUID 를 만들고 `control:<UUID>` 를
헤더에 쓴다. 한 명령 안의 네트워크 재시도에는 같은 키를 쓴다.
영구 멱등 영수증이 있으므로 값에서 키를 만들면 A → B → A 변경의 마지막 A 가
첫 A 의 응답만 재생하고 DB 는 B 로 남는다.

### 3. 파일모드와 동기화와 import preview 를 지운다

- `persistence/history.ts` 와 그 테스트
- `study-library/source-sync.ts`. 테스트 파일은 없다
- `study-library/imports.ts` 와 그 테스트
- `morning_reading_cli.ts` 의 `--library`, `--commit-history`, `--history-file`, `--import-preview`, `--pages-manifest` 와 파일모드 분기

`main` 은 하위 동작 플래그 하나를 요구한다. 없으면 쓸 수 있는 플래그를 적고 종료 코드 2 로 끝낸다.
`--library` 를 주면 사용법 오류로 끝내고 「이제 기본이다, 빼고 다시 실행한다」 를 적는다.

`morning_reading_cli.ts` 가 `config/external-reading-sources.ts` 를 import 하지 않게 한다.
켜진 소스는 `GET /sources` 에서 받는다.
`reading_contracts.ts` 의 리포트 `sourceOfTruth.config` 를
`sourceOfTruth.sources: "backend:study_sources"` 로 바꾼다.
CLI 의 리포트 생성과 `render/test_fixture.ts`, 관련 리포트 테스트도 같은 계약을 따른다.

### 4. 추천 저장에 기준 버전과 제외 판정을 싣는다

- `contracts.ts` 의 `studyLibraryCandidatePageSchema` 에 `candidateContextVersion` 을 더한다
- 후보 meta 파일에 `candidateContextVersion` 을 남긴다
- 여러 후보 페이지의 `historyVersion` 과 `candidateContextVersion` 을 첫 페이지 값과
  함께 비교한다. 둘 중 하나라도 다르면 후보풀과 meta 파일을 쓰기 전에 `409` 로 중단한다
- `reading_contracts.ts` 의 선택 계약에 `rejections` 를 더한다
- `study-library/recommendations.ts` 가 `candidateContextVersion` 과 `rejections` 를 본문에 담는다.
  `rejections` 의 `candidateId` 는 그대로 `contentKey` 다

`--reading-selection` 단계는 후보 meta 의 `candidateContextVersion` 과 선택 파일의
검증된 `rejections` 를 리포트 옆의 `state/recommendation-request.json` 에 기록한다.
이 sidecar 는 `reportId`, `generatedAt`, `candidateContextVersion`, `rejections` 만 담는다.
`--commit-recommendation --report <경로>` 는 리포트와 같은 디렉터리의 sidecar 를 읽고
`reportId` 와 `generatedAt` 이 리포트에서 계산한 값과 같은지 확인한 뒤 본문을 만든다.
sidecar 가 없거나 두 값이 다르면 저장 요청 전에 실패한다.
리포트 JSON 과 공개 HTML 에는 제외 이유를 넣지 않는다.

### 5. `manage_reading_sources.ts` 를 편집 명령으로 바꾼다

하위 명령 다섯이다. 모두 API 를 부른다.

| 하위 명령 | 하는 일 |
| --- | --- |
| `list` | 소스 목록 |
| `add --key --title --category --adapter [--url] [--feed-url] --note` | 새 소스. `expectedVersion: 0` |
| `update --key [필드] --note` | GET 결과에 지정한 필드를 합쳐 전체 교체한다 |
| `disable --key --note`, `enable --key --note` | 켜고 끈다 |

`add`, `update`, `disable`, `enable` 은 `--note` 를 요구한다. 무엇을 왜 바꿨는지 남기는 자리다.
`update` 의 필드는 `--title`, `--category`, `--adapter`, `--url`, `--feed-url`,
`--clear-url`, `--clear-feed-url` 이다. `--url` 과 `--clear-url`, `--feed-url` 과
`--clear-feed-url` 은 각각 함께 쓸 수 없다. 필드를 하나 이상 지정해야 한다.
`update`, `disable`, `enable` 은 먼저 GET 으로 현재 행을 읽고 바꾸지 않은 필드와
현재 `version` 을 보존해 PUT 한다. `note` 는 새 필수 값으로 교체한다.
PUT 이 `409` 를 내면 자동 재시도하지 않고 다시 조회한 뒤 명령을 다시 실행하도록 알린다.

### 6. `configure_study_recommendation.ts` 추가

`--candidate-context-version <값>` 을 받아 `PUT /recommendation-control` 을 부른다.
`scripts/position-recommender/configure_position_analysis_policy.ts` 와 같은 모양이다.
같은 값 A 를 설정하고 B 를 설정한 뒤 다시 A 를 설정하면 마지막 요청이 실제 DB 를 A 로 바꿔야 한다.

### 7. `import_study_state.ts` 추가

`--dry-run` 이 기본이고 `--commit` 을 줘야 보낸다.
`--sources-file <경로>` 기본값은 `config/external-reading-sources.ts`,
`--history-file <경로>` 는 필수다.

순서다.

1. 소스를 `GET /sources` 와 비교해 없는 것만 `PUT` 한다. `note` 는 「config 에서 이관」
2. 리포트를 `reportId` 오름차순으로 하나씩 처리한다
3. 그 리포트의 entry 를 소스별로 묶어 `POST /ingestions` 로 넣는다. 위 「의도 메모」 의 규칙을 따른다
4. 같은 리포트를 `POST /recommendation-runs` 로 저장한다.
   `studyTopicKey` 로 묶어 주제를 만들고 `title` 은 `studyTopic`, `careerQuestion` 은 `null` 이다.
   자료의 `summary` 와 `reason` 은 `null`, `careerValue` 는 entry 값이다. `rejections` 는 빈 배열이다

추천 본문의 `generatedAt` 은 이력 `reports[].recommendedAt` 을 그대로 쓴다.
각 리포트의 ingestion 전에 `GET /candidates?limit=1` 로 현재
`candidateContextVersion` 을 받고 추천 본문에 넣는다. 이관 중 값이 바뀌면 서버의
`409` 를 그대로 알리고 중단한다.

각 리포트의 ingestion 전에 `GET /recommendation-runs/{reportId}/status` 를 조회한다.
`exists: true` 면 ingestion 도 추천 저장도 건너뛴다.
이관 ingestion 의 `mode` 는 `recent` 다. 소스별 현재 recent cursor 를 조회하고
내용은 그대로 돌려보내며 `expectedCursorVersion` 은 받은 값을 쓴다.
다른 요청이 cursor 를 먼저 바꿔 `409` 가 나면 해당 리포트의 이관을 중단한다.
서버의 추천 저장 충돌도 임의로 성공 처리하지 않고 이관을 중단한다.
이미 있는 `reportId` 는 건너뛴 사실을 출력한다. 다시 돌려도 안전해야 한다.
stdout 에는 소스 건수, 리포트 건수, 자료 건수, 건너뛴 건수만 낸다.

### 8. 이 phase 를 검증하는 테스트

있는 파일을 고친다.

- `study-library/client.test.ts`: 쓰기 요청에 `Idempotency-Key` 헤더가 붙는다. `http://` 내부 주소를 받는다
- `study-library/client.test.ts`: 추천은 같은 본문으로, 기준 변경은 같은 명령 안에서
  재시도하면 같은 헤더를 보낸다. 기준 변경의 별도 명령은 새 헤더를 쓴다
- `study-library/candidates.test.ts`: meta 파일에 `candidateContextVersion` 이 남는다
- `study-library/candidates.test.ts`: 두 페이지의 기준 버전이 다르면 후보풀과 meta 를 쓰지 않는다
- `study-library/recommendations.test.ts`: 본문에 `candidateContextVersion` 과 `rejections` 가 들어간다
- `study-library/recommendations.test.ts`: 후보 준비 → 선택 → 리포트와 sidecar → 추천 요청으로 이어지고,
  sidecar 가 없거나 리포트와 다르면 쓰기 요청을 보내지 않는다

새로 만든다.

- `morning_reading_cli.test.ts`: `--library` 와 `--commit-history` 가 사용법 오류로 끝난다
- `reading_selection.test.ts`: `rejections` 가 후보풀 밖이거나 선택과 겹치면 거부된다
- `manage_reading_sources.test.ts`: `--note` 없는 `disable` 이 거부된다. API 는 stub 이다
- `import_study_state.test.ts`: 임시 디렉터리의 이력 파일로 `--dry-run` 집계가 리포트 3, 자료 15 로 나온다.
  YouTube 소스의 entry 가 `feed-video` 가 된다. 이미 있는 `reportId` 는 ingestion 전에 건너뛴다
- `import_study_state.test.ts`: 추천 본문은 `reports[].recommendedAt` 과 조회한 기준 버전을 사용한다
- `configure_study_recommendation.test.ts`: A → B → A 순서가 마지막 A 를 실제로 저장한다
- `scripts/position-recommender/recommendation-api/client.test.ts`: 공용 환경 해석으로
  직접 token, 0600 token 파일, 두 token 동시 설정 거부, HTTP/HTTPS,
  credentials·query·hash·path 거부를 확인한다

기존 `study-library/ingestion.test.ts` 와 `study-library/recommendations.test.ts` 의
`--library` 성공 경로도 새 기본 실행으로 바꾼다.
삭제하는 파일의 테스트는 삭제하고, `runtime-paths` 관련 테스트가 제거한 옵션을
기대하면 새 사용법에 맞춰 갱신한다.

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun test career-os/scripts/study-topic-recommender
bunx tsc --noEmit
```

기대값이다.

- 둘 다 종료 코드 0
- 위 테스트가 모두 통과
- 출력에 `skipped` 가 없다

**지운 경로가 남아 있지 않은지 센다.**

```bash
# cwd: 저장소 루트
if rg -n -g '!*.test.ts' -g '!import_study_state.ts' \
  'STUDY_LIBRARY_URL|STUDY_SERVICE_TOKEN|morning-study-history|source-sync|--commit-history|--import-preview' \
  career-os/scripts career-os/.env.example; then exit 1; else test "$?" -eq 1; fi
if rg -n \
  'STUDY_LIBRARY_URL|STUDY_SERVICE_TOKEN|source-sync|--commit-history|--import-preview' \
  career-os/scripts/study-topic-recommender/import_study_state.ts; then exit 1; else test "$?" -eq 1; fi
```

`import_study_state.ts` 안에서 이력 파일 이름이 나오는 것만 허용한다.
테스트 파일에도 사용법 오류를 검증하는 금지 문자열은 허용한다.

**로컬 Backend 에 이관을 dry-run 으로 돌린다.**
Phase 01 의 container 에 Backend 를 띄운 뒤 리포트 3건, entry 15건,
YouTube 소스 entry 한 건 이상을 담은 fixture 를 가리킨다.
메인 checkout 의 `state/` 원본은 읽지 않는다.

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun career-os/scripts/study-topic-recommender/import_study_state.ts --dry-run \
  --history-file <테스트 fixture 경로>
```

리포트 3건과 자료 15건이 나와야 한다.
실제 원본 dry-run 은 코디네이터가 검증 단계에서 확인한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/recommendations.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_selection.ts` | 수정. `rejections` 검증 |
| `career-os/scripts/study-topic-recommender/manage_reading_sources.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/configure_study_recommendation.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/import_study_state.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/persistence/history.ts` | 삭제 |
| `career-os/scripts/study-topic-recommender/study-library/source-sync.ts` | 삭제 |
| `career-os/scripts/study-topic-recommender/study-library/imports.ts` | 삭제 |
| `career-os/scripts/lib/` | 신규. 두 client 가 함께 쓰는 환경값 해석 |
| `career-os/scripts/position-recommender/recommendation-api/client.ts` | 공용 환경값 해석 사용 |
| `career-os/scripts/position-recommender/recommendation-api/client.test.ts` | 공용 환경값 회귀 검증 |
| `career-os/scripts/study-topic-recommender/render/test_fixture.ts` | 리포트 소스 원본 계약 변경 |
| `career-os/.env.example` | 수정 |
