# 전환 전 HTTP 계약 기록

추천 Backend 를 Bun 에서 NestJS·Prisma 로 옮길 때 HTTP 계약이 바뀌지 않았음을 확인하려면,
전환 전 구현이 실제로 낸 값이 남아 있어야 한다.
`cases.json` 이 그 기록이고 `capture-legacy.bun.ts` 가 그것을 만든 스크립트다.

기대값을 손으로 적지 않았다. 코드를 읽고 추론해 적은 값도 없다.
모두 MySQL 을 초기화하고 서버를 띄워 요청을 보낸 뒤 받은 응답과 그때의 DB 행이다.

## 파일

| 파일 | 내용 |
| --- | --- |
| `capture-legacy.bun.ts` | 포착 스크립트. 전환이 끝나면 다시 돌지 않고 기록으로 남는다 |
| `cases.json` | case 34개의 요청 전문, 응답 전문, 쓰기 뒤의 DB 행 |
| `README.md` | 이 문서 |

## 뽑은 방법

### 전제

테스트용 MySQL 이 떠 있어야 한다. 포착에 쓴 컨테이너는 아래 명령으로 만든 것이다.

```bash
docker run -d --name plan125-mysql \
  -e MYSQL_ROOT_PASSWORD=plan125 -e MYSQL_DATABASE=fos_career_test \
  -p 13400:3306 mysql:8.4.8 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

접속 정보는 `LEGACY_CAPTURE_DB_HOST`, `LEGACY_CAPTURE_DB_PORT`, `LEGACY_CAPTURE_DB_USER`,
`LEGACY_CAPTURE_DB_PASSWORD`, `LEGACY_CAPTURE_DB_NAME` 으로 바꿀 수 있다.

**이 값이 가리키는 database 는 실행할 때마다 통째로 지워진다.**
스크립트가 `DROP DATABASE IF EXISTS` 를 조건 없이 실행한다.
운영 database 나 다른 작업이 쓰는 database 를 가리키지 않는지 확인하고 돌린다.

### 실행

`bun` 이 PATH 에 없으므로 같은 줄에 PATH 를 준다.

```bash
cd career-os/services/recommendation-api
PATH="$HOME/.bun/bin:$PATH" bun test/fixtures/legacy-contract/capture-legacy.bun.ts
```

스크립트는 회차를 시작할 때마다 `fos_career_test` 를 지우고 다시 만든다.
실행마다 달라지는 값을 가려내려고 전체 case 를 두 번 돌리므로 초기화도 두 번 일어난다.

database 는 `CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci` 로 만든다.
migration 파일에 `CHARACTER SET` 과 `COLLATE` 절이 없어 table 과 column 이 database 기본값을 그대로 받으므로,
서버 기본값이 다른 곳에서 돌려도 같은 collation 이 되도록 만들 때 명시한다.

그 뒤 `migrations/` 의 `.sql` 파일을 이름 순으로 적용한다.
지금은 `001_position_schema.sql` 과 `002_company_tier_assessments.sql` 둘이다.

### 요청을 보내는 방식

`app.ts` 의 `createApp` 을 `Bun.serve` 에 붙여 실제 HTTP 서버를 띄우고 `fetch` 로 요청을 보낸다.
설정은 `config.ts` 의 `loadConfig` 를 그대로 쓰므로 본문 상한도 운영 기본값인 2 MiB 다.
database 는 `CAREER_RECOMMENDATION_DATABASE_URL` 형식 하나만 준다.
운영 형식인 `DB_HOST` 계열과 함께 주면 `loadConfig` 가 시작 전에 실패한다.

서버가 그 database 에서 실제로 뜨는 것은 `ok-02-health-ready` 가 확인한다.
`GET /health/ready` 가 200 과 `{"ok":true}` 를 냈다. migration 두 개가 적용됐고 checksum 도 맞다는 뜻이다.

요청 한 건마다 서버를 새로 띄운다.
`SqlPositionRepository` 는 첫 요청에서 DB 를 읽어 메모리에 들고 있기 때문에,
SQL 로 바꾼 상태를 반영하려면 매번 새로 읽어야 한다.

### 매 case 사이의 상태 초기화

case 를 시작할 때마다 schema 는 그대로 두고 데이터만 지운다.

```sql
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE <17개 table>;   -- schema_migrations 는 제외한다
SET FOREIGN_KEY_CHECKS = 1;
```

대상 table 은 `capture-legacy.bun.ts` 의 `ALL_TABLES` 에 있다.
`schema_migrations` 를 남기므로 case 마다 migration 을 다시 적용하지 않는다.

각 case 는 자기 선행 상태를 `given` 으로 스스로 만든다.
`given` 은 대부분 요청이지만 세 case 는 SQL 문장도 담는다.
어느 case 가 왜 SQL 을 쓰는지는 아래 「요구한 상태를 만들려고 SQL 을 직접 쓴 case」 에 있다.
앞 case 가 남긴 상태에 기대는 case 는 없다.

### 시간대를 UTC 로 고정한다

스크립트는 첫 줄에서 `process.env.TZ = "UTC"` 를 설정한다.

Bun 의 MySQL driver 는 `DATETIME` 을 프로세스의 지역 시간으로 해석한다.
컨테이너는 UTC 로 기록하므로, 지역 시간이 `Asia/Seoul` 이면 다시 읽은 시각이 9시간 앞선 값이 된다.
그 상태에서는 회사 tier 임차권이 방금 만든 실행에서도 만료로 판정돼
정상 경로가 `COMPANY_TIER_LEASE_EXPIRED` 로 끝난다.

이 어긋남은 상태를 메모리에서 다시 읽을 때만 드러나므로,
서버를 재시작하지 않는 운영에서는 잘 보이지 않는다.
전환 후 구현에서도 같은 값이 나오는지 확인할 필요가 있다.

### 실행마다 달라지는 값을 가려낸 방법

전체 case 를 두 번 돌리고 두 회차의 응답 본문을 비교했다.
달라진 경로를 case 마다 `response.volatileResponsePaths` 에 적었다.

비교로 잡히지 않아도 실행마다 새로 만들어지는 것이 분명한 이름은 그 목록에 함께 넣었다.
`generatedAt`, `reportDate`, `positionId`, `companyTierAssessmentId`,
`companyTierAssessedAt`, `companyTierValidUntil` 이 그것이다.
두 회차가 같은 날에 돌면 날짜에서 나온 값은 비교만으로는 드러나지 않기 때문이다.

DB 행도 같은 방식으로 두 회차를 비교했다.
행이 다르면 그 case 에 `unstableTables` 가 붙고 스크립트가 표준 오류로 목록을 찍는다.
지금 `cases.json` 에는 그 필드를 가진 case 가 없다. 34개 case 모두에서 같은 행이 나왔다는 뜻이다.

## `cases.json` 을 읽는 방법

파일 맨 위는 아래를 담는다.

| 항목 | 내용 |
| --- | --- |
| `capturedFrom`, `capturedWith` | 어느 구현을 어느 스크립트로 포착했는지 |
| `apiToken` | 포착에만 쓴 Bearer token. 운영 값이 아니다 |
| `databaseUrlShape` | 접속 문자열의 형태. 계정과 비밀번호는 담지 않는다 |
| `maxBodyBytes` | 포착 당시의 본문 상한 |
| `comparedColumns` | table 마다 어느 열을 어떤 순서로 읽었는지 |
| `cases` | case 34개 |

case 하나는 아래를 담는다.

| 항목 | 내용 |
| --- | --- |
| `id`, `group`, `name` | 식별자와 구분과 사람이 읽는 이름 |
| `precondition` | 사람이 읽는 선행 상태 설명 |
| `given` | 그 상태를 만드는 요청과 SQL 의 목록. 요청은 전문과 응답 status 를 담는다 |
| `request` | method, 경로, `Authorization` 의 유무와 `Idempotency-Key` 의 값, 본문 |
| `response` | status, 본문 전체, `Cache-Control` 의 값, `X-Request-Id` 의 유무 |
| `response.volatileResponsePaths` | 본문에서 실행마다 달라지는 자리 |
| `database.tables` | 쓰기 요청 뒤의 DB 행 |
| `database.note` | 그 행에서 볼 것이 따로 있으면 그 설명 |

`X-Request-Id` 는 값이 실행마다 달라지므로 유무만 담았다.
`Idempotency-Key` 는 재생에 그 값이 필요하므로 값을 담았다. 헤더를 보내지 않은 case 는 `null` 이다.

`database.tables` 는 그 case 가 확인하기로 고른 table 만 담는다.
`comparedColumns` 가 17개 table 전부를 적고 있지만 case 하나가 그 전부를 읽지는 않는다.
어떤 table 이 `database.tables` 에 없는 것은 확인하지 않았다는 뜻이지 행이 없다는 뜻이 아니다.

### 경로와 본문에 실행 값이 들어간 요청

`positionId` 와 `analysisRunId` 처럼 앞선 응답에서 받은 값을 경로나 본문에 넣는 요청이 있다.
그런 요청에는 `derivedFields` 를 붙여 어느 응답의 어느 자리에서 가져왔는지 적었다.
새 테스트는 `cases.json` 에 적힌 값을 그대로 보내지 말고, 앞선 응답에서 다시 가져와야 한다.

### 본문이 큰 요청

본문 상한 case 는 2 MiB 를 넘는 문자열을 보낸다.
그 본문을 그대로 담으면 파일이 커지므로 만드는 방법만 적었다.

```json
{ "generated": { "kind": "padded-json", "totalBytes": 2097252, "padField": "pad" } }
```

`{"pad":"<a 를 채워 전체 길이를 totalBytes 로 맞춘 문자열>"}` 를 보내면 같은 본문이 된다.

## 비교에서 뺀 열

| 열 | 뺀 이유 |
| --- | --- |
| `created_at`, `updated_at`, `applied_at`, `completed_at` | 요청을 처리한 시각이라 실행마다 달라진다 |
| `assessed_at`, `analyzed_at`, `generated_at` | 같다 |
| `valid_until` | 처리 시각에 정책의 보관 일수를 더해 만든다 |
| `position_id`, `position_version_id`, `analysis_id` | `crypto.randomUUID()` 로 만든다 |
| `company_tier_assessment_id`, `recommendation_run_id` | 같다 |
| `snapshot_json` (`position_versions`) | 요청 본문의 공고를 그대로 담아 요청 전문이 이미 가진 값이다 |
| `pending_candidates_json` (`position_recommendation_runs`) | 응답 본문의 `pendingCandidates` 와 같은 값이다 |
| `response_body` (`request_receipts`) | 저장한 응답 본문이라 그 응답의 실행 값을 그대로 가진다 |
| `request_hash` (`request_receipts`) | 요청 본문에서 만든다. 본문에 `positionId` 가 들어가면 해시도 달라진다 |

`request_hash` 를 뺀 대신 정규화 해시의 동작은 두 case 가 확인한다.
같은 키에 같은 본문을 보내는 `err-01` 과 다른 본문을 보내는 `err-02` 다.

시각을 담는 열이라도 `first_seen_at`, `last_seen_at`, `pending_since`, `collected_at`, `observed_at`
다섯은 비교 대상에 넣었다. 처리 시각이 아니라 요청 본문의 `collectedAt` 에서 나오는 값이라 실행마다 같다.

## 포착한 case

### 정상 경로 12개

`app.ts` 의 세 개와 `routes/positions.ts` 의 아홉 개를 합친 12개가 이 구현의 모든 endpoint 다.
그 전부를 하나씩 담았다.

| case | endpoint | status |
| --- | --- | --- |
| `ok-01-health-live` | `GET /health/live` | 200 |
| `ok-02-health-ready` | `GET /health/ready` | 200 |
| `ok-03-auth-check` | `GET /api/v1/auth/check` | 204 |
| `ok-04-put-analysis-policy` | `PUT /api/positions/v1/analysis-policy` | 200 |
| `ok-05-put-company-preference` | `PUT /api/positions/v1/company-preferences/{companyKey}` | 200 |
| `ok-06-get-company-preferences` | `GET /api/positions/v1/company-preferences` | 200 |
| `ok-07-post-collection-run` | `POST /api/positions/v1/collection-runs` | 201 |
| `ok-08-post-company-tier-results` | `POST /api/positions/v1/company-tier-runs/{id}/results` | 200 |
| `ok-09-post-analysis-run` | `POST /api/positions/v1/collection-runs/{id}/analysis-runs` | 201 |
| `ok-10-post-analysis-results` | `POST /api/positions/v1/analysis-runs/{id}/results` | 200 |
| `ok-11-post-recommendation-run` | `POST /api/positions/v1/recommendation-runs` | 201 |
| `ok-12-get-run` | `GET /api/positions/v1/runs/{id}` | 200 |

### 오류와 경계 22개

요구한 항목 21개를 case 22개로 모두 만들었다.
임차권 만료는 거절 응답과 그 뒤의 회수·재선택이 서로 다른 요청이라 두 case 로 나눴다.

| case | 확인하는 것 | status |
| --- | --- | --- |
| `err-01-idempotent-replay` | 같은 키에 같은 본문을 다시 보내면 저장한 응답을 그대로 준다 | 201 |
| `err-02-idempotency-conflict` | 같은 키에 다른 본문 | 409 `IDEMPOTENCY_CONFLICT` |
| `err-03-missing-idempotency-key` | 쓰기 요청에 `Idempotency-Key` 없음 | 400 `BAD_REQUEST` |
| `err-04-wrong-token` | 틀린 token | 401 `UNAUTHORIZED` |
| `err-05-missing-token` | token 없음 | 401 `UNAUTHORIZED` |
| `err-06-body-too-large` | 상한을 넘는 본문 | 400 `BODY_TOO_LARGE` |
| `err-07-unknown-path` | 없는 경로 | 404 `NOT_FOUND` |
| `err-08-unknown-run-id` | 없는 실행 ID 로 실행 조회 | 404 `NOT_FOUND` |
| `err-09-schema-violation` | 본문 schema 위반 | 400 `BAD_REQUEST` |
| `err-10-policy-not-configured` | 정책 없는 수집 요청 | 409 `POLICY_NOT_CONFIGURED` |
| `err-11-company-tier-run-pending` | 회사 tier 가 pending 인데 분석 실행 생성 | 409 `COMPANY_TIER_RUN_PENDING` |
| `err-12-company-tier-run-missing` | 회사 tier 실행이 없는데 분석 실행 생성 | 409 `COMPANY_TIER_RUN_MISSING` |
| `err-13-tier-results-unknown-company` | 끝난 실행에 그 실행이 고르지 않은 회사 | 409 `VERSION_CONFLICT` |
| `err-14-analysis-results-partial-submission` | 끝나지 않은 항목 일부만 제출 | 409 `VERSION_CONFLICT` |
| `err-15a-company-tier-lease-expired` | 처리 중 표시가 2시간을 넘은 회사에 결과 반영 | 409 `COMPANY_TIER_LEASE_EXPIRED` |
| `err-15b-company-tier-lease-reclaimed` | 회수 뒤 `lease_expired` 로 남고 다음 수집이 다시 선택한다 | 201 |
| `err-16-analysis-run-partial` | 실패 한 건을 함께 보낸 뒤 실행이 `partial` | 200 |
| `err-17-analysis-run-completed-after-retry` | 남은 항목만 다시 보내 `completed` | 200 |
| `err-18-company-tier-queue-empty` | 대기열이 비면 실행이 만들어지는 즉시 `completed` | 201 |
| `err-19-recommendation-without-new-analysis` | 분석 대상이 없을 때의 재사용 수, 분석 대기 수, 수집 진단 | 201 |
| `err-20-tier-resolution-prefers-manual` | manual 과 model 을 모두 가진 회사가 manual 로 해결된다 | 201 |
| `err-21-excluded-company-dropped` | exclude 회사가 tier 값을 해결하기 전에 제거된다 | 201 |

### 요구한 상태를 만들려고 SQL 을 직접 쓴 case

세 case 는 HTTP 요청만으로 만들 수 없는 상태를 SQL 로 만들었다. `given` 에 그 문장이 남아 있다.

| case | 쓴 문장 | 왜 필요했는지 |
| --- | --- | --- |
| `err-12-company-tier-run-missing` | `DELETE FROM company_tier_assessment_runs` | 수집 요청은 회사 tier 실행을 항상 함께 만든다. 이 오류는 회사 tier 평가를 도입하기 전에 저장된 수집에서만 난다 |
| `err-15a`, `err-15b` | `UPDATE company_tier_assessment_runs SET created_at = DATE_SUB(NOW(3), INTERVAL 3 HOUR)` | 임차권 판정은 실행을 만든 지 2시간이 지나야 한다. 그 시각을 요청으로는 바꿀 수 없다 |

## 오류 코드

정의된 12개 가운데 10개가 한 번 이상 나왔다.

| 코드 | 나온 case |
| --- | --- |
| `BAD_REQUEST` | `err-03`, `err-09` |
| `BODY_TOO_LARGE` | `err-06` |
| `COMPANY_TIER_LEASE_EXPIRED` | `err-15a` |
| `COMPANY_TIER_RUN_MISSING` | `err-12` |
| `COMPANY_TIER_RUN_PENDING` | `err-11` |
| `IDEMPOTENCY_CONFLICT` | `err-02` |
| `NOT_FOUND` | `err-07`, `err-08` |
| `POLICY_NOT_CONFIGURED` | `err-10` |
| `UNAUTHORIZED` | `err-04`, `err-05` |
| `VERSION_CONFLICT` | `err-13`, `err-14` |

나오지 않은 둘은 아래와 같다.

| 코드 | 만들지 않은 이유 |
| --- | --- |
| `INTERNAL_ERROR` (500) | 정상 경로로 만들 수 없다. 예외를 직접 던지는 검사로 응답 형식만 확인한다 |
| `DATABASE_UNAVAILABLE` (503) | 같다 |

## 공통 응답 헤더

포착한 본 요청 34건의 응답이 모두 `Cache-Control: no-store` 와 `X-Request-Id` 를 담는다.
본문이 없는 204 응답도 같다. `cases.json` 의 각 `response` 가 그 값을 담고 있다.
`given` 의 요청은 status 만 기록했으므로 헤더가 없다.
