# Phase 01. 개인 공고 제외 규칙을 Backend로 옮긴다

**Execution profile**: deep

## 목표

`state/private-config/position-exclusions.json`이 담던 개인 공고 제외 규칙을
`fos_career.position_exclusions`로 옮기고, 읽고 쓰는 HTTP 경로 둘을 만든다.

이 phase가 끝나면 `GET api/positions/v1/exclusions`가 규칙을 돌려주고
`PUT`이 전체를 바꾼다.

**범위 외**: 수집기가 이 경로를 실제로 부르게 바꾸는 것은 Phase 03이다.
회사 근거는 Phase 02다.

## 컨텍스트

기존 계약은 `scripts/position-recommender/feedback/exclusions.ts`가 소유한다.
`scope`가 `posting`, `company`, `company-role` 셋이고 각각 요구하는 필드가 다르다.
`decisionKind`가 `career-downside`일 때 `scope`가 `company`면 근거 URL이 두 개 이상 필요하다는
검사가 같은 파일의 `validateCareerDownsideExclusion`에 있다. 이 검사를 Backend로 옮긴다.

Backend의 기존 패턴을 따른다.

| 무엇 | 따를 곳 |
| --- | --- |
| controller의 경로와 검증 pipe | `src/positions/positions.controller.ts` |
| zod 계약 | `src/positions/schema.ts` |
| 저장 계층 | `src/positions/repository/positions.repository.ts` |
| migration | `prisma/migrations/` 아래 새 디렉터리 |

**근거 문서**: `docs/data-schema.md`의 「개인 공고 제외 설정」 절,
`docs/adr/ADR-123-회사-근거와-개인-제외-정책은-backend가-소유한다.md`

## 의도 메모

**규칙을 한 건씩 고치는 경로를 만들지 않는다.**
`PUT`이 받은 배열로 기존 규칙을 통째로 대체한다. 규칙이 열 건 안팎이고 사람이 한 번에 검토하는 단위라
부분 갱신은 어느 규칙이 지금 유효한지를 흐린다.

**`scope`마다 다른 필수 칸을 `CHECK`로 강제한다.**
애플리케이션 검증만 두면 이관 명령이나 손으로 넣은 행이 규칙을 빠져나간다.
`CHECK` 제약이 이 저장소의 방식이고 지금 16개가 있다.

**버전 1 형식은 옮기지 않는다.**
`legacyPostingExclusionSchema`는 `scope`가 없는 옛 형태다.
이관 명령이 읽을 때 `scope: "posting"`을 붙여 버전 2로 올린다.

## 작업 항목

### 1. `prisma/migrations/`에 `position_exclusions` migration 추가

`docs/data-schema.md`의 「개인 공고 제외 설정」 표가 칸과 타입을 정한다.

`CHECK` 제약 셋을 함께 넣는다.

- `scope`가 `posting`이면 `source_key`와 `identity_hash`와 `normalized_url` 중 하나 이상이 NOT NULL
- `scope`가 `company`나 `company-role`이면 `company_key`가 NOT NULL
- `scope`가 `company-role`이면 `title_keywords_json`이 NOT NULL

collation은 기존 table과 같은 `utf8mb4_unicode_ci`를 쓴다.
다르면 foreign key가 붙지 않는다.

`prisma/schema.prisma`에 모델을 더한다. Prisma는 `CHECK`를 표현하지 못하므로
migration SQL에 직접 쓰고 `schema.prisma`에는 칸만 적는다.

### 2. `src/positions/schema.ts`에 제외 규칙 계약 추가

`positionExclusionSchema`를 `scope`로 갈리는 discriminated union으로 쓴다.
`exclusionsRequestSchema`는 `schemaVersion: 2`와 `exclusions` 배열을 담는다.

`career-downside`이고 `scope`가 `company`면 `evidenceUrls`가 두 개 이상이어야 한다는 검사를
`superRefine`으로 넣는다. `scripts/position-recommender/feedback/exclusions.ts`의
`validateCareerDownsideExclusion`과 같은 판정이어야 한다.

### 3. 저장 계층과 service에 읽기와 일괄 대체 추가

`PositionsRepository`에 `listExclusions`와 `replaceExclusions`를 더한다.
일괄 대체는 한 트랜잭션에서 기존 행을 지우고 받은 행을 넣는다.
`docs/adr/ADR-122-추천-상태는-질의-단위로-읽고-쓴다.md`를 따라
트랜잭션 시작에서 자기 대상을 잠근다.

`expires_at`이 오늘보다 이전인 규칙은 `listExclusions`가 제외한다.
판정 기준 날짜는 Seoul 기준이고 `scripts/lib/date-format.ts`의 `formatSeoulIsoDate`와 같은 규칙이다.

### 4. controller에 경로 둘 추가

`src/positions/positions.controller.ts`에 더한다.

| 메서드와 경로 | 반환 |
| --- | --- |
| `GET exclusions` | 유효한 규칙 배열 |
| `PUT exclusions` | 대체한 뒤의 규칙 배열 |

`PUT`은 멱등 처리 대상이다. 기존 쓰기 경로와 같이 멱등 키를 요구한다.

### 5. 이 phase를 검증하는 `test/positions-exclusions.e2e.test.ts`

확인할 것이다.

- `PUT` 뒤 `GET`이 같은 규칙을 돌려준다
- `expires_at`이 어제인 규칙이 `GET`에 나오지 않는다
- `career-downside`이고 `scope`가 `company`인데 근거 URL이 하나면 `400`이다
- `scope`가 `company-role`인데 `title_keywords_json`이 없으면 DB의 `CHECK`가 막는다
- 같은 멱등 키로 두 번 `PUT`하면 두 번째가 저장된 응답을 돌려주고 행이 늘지 않는다

`CHECK` 확인은 repository를 우회해 SQL로 직접 넣어야 한다.
계약 검증만 통과하는 값이 DB에서도 막히는지가 이 항목의 목적이다.

## 검증

**테스트용 MySQL container를 확인한다. 떠 있으면 다시 만들지 않는다.**
collation이 운영 `fos_career`와 같은 `utf8mb4_unicode_ci`여야 한다.
기본값으로 다시 만들면 foreign key가 `incompatible` 오류로 붙지 않는다.

```bash
# cwd: 아무 곳
docker ps --filter name=plan125-mysql --format '{{.Names}} {{.Status}}'
```

```bash
# cwd: 아무 곳
# 위 명령의 출력이 비었을 때만 실행한다
docker run -d --name plan125-mysql \
  -e MYSQL_ROOT_PASSWORD=plan125 -e MYSQL_DATABASE=fos_career_test \
  -p 13400:3306 mysql:8.4.8 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck`가 종료 코드 0
- `positions-exclusions.e2e.test.ts`의 항목이 모두 통과
- 기존 e2e 테스트가 계속 통과
- 출력에 `skipped`가 없다

`CHECK` 제약이 실제로 만들어졌는지 센다. 기존 16개에 셋이 늘어 19개여야 한다.

```bash
# cwd: 아무 곳
docker exec plan125-mysql mysql -uroot -pplan125 -N -e \
  'SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA="fos_career_test";'
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/prisma/migrations/*/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/schema.prisma` | 수정 |
| `career-os/services/recommendation-api/src/positions/schema.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/repository/positions.repository.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.service.ts` | 수정 |
| `career-os/services/recommendation-api/src/positions/positions.controller.ts` | 수정 |
| `career-os/services/recommendation-api/test/positions-exclusions.e2e.test.ts` | 신규 |
