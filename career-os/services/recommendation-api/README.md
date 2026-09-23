# recommendation-api

추천 Backend 서비스다. 모노레포 루트와 분리된 Node 22 package 로 동작한다.

## 요구 환경

- Node `>=22.18.0`
- MySQL 8.4

## Prisma CLI 와 테스트가 읽는 환경 변수

기동에 쓰는 환경값은 여기가 아니라
[`../../docs/code-architecture.md`](../../docs/code-architecture.md) 의 「추천 상태 Backend」 절이 소유한다.
`API_HOST` 와 `API_PORT`, database 접속 형식 두 가지, API token 이 그것이다.
같은 목록을 두 곳에 두지 않는다.

| 이름 | 쓰는 곳 |
| --- | --- |
| `DATABASE_URL` | `prisma.config.ts` 의 datasource |
| `SHADOW_DATABASE_URL` | `prisma migrate diff --from-migrations` 가 쓰는 임시 database |
| `CAREER_RECOMMENDATION_TEST_DATABASE_URL` | 테스트가 붙는 MySQL |

## 명령

```bash
npm install
npm run typecheck
npm test
npm run build
npm run prisma:generate
npm run prisma:status
```

`npm run test:deployed` 는 배포한 서비스를 상대로 도는 검사다.
기본 `npm test` 에 들어가지 않는다. 「배포한 서비스 확인」 절이 실행 방법을 적는다.

## Prisma migration

`prisma/migrations/20260921000000_baseline/` 이 운영 schema 의 기준점이다.
그 `migration.sql` 은 같은 디렉터리의 `source/001_position_schema.sql` 과
`source/002_company_tier_assessments.sql` 을 순서대로 이어 붙인 것이고 내용을 고치지 않는다.
`source/` 의 둘은 전환 전 구현이 쓰던 원본이고 비교 대상으로만 남긴다.
`prisma/baseline.test.ts` 가 그 동일성을 바이트 단위로 확인한다.

### migration 을 만들고 고치는 규칙

**Backend 는 기동할 때 DDL 을 실행하지 않는다.** 연결과 적용 기록 조회만 한다.
적용 기록은 `_prisma_migrations` table 에 있다.

**적용한 migration 파일은 고치지 않는다.** checksum 이 달라져 다음 적용이 거절된다.
schema 를 바꿀 때는 `prisma migrate` 로 새 migration 을 만든다.

**`CHECK` 제약은 migration SQL 에 직접 쓴다.** `schema.prisma` 가 표현하지 못한다.
`prisma migrate diff --from-empty --to-config-datasource --script` 의 출력은 `CHECK` 제약을 모두 빠뜨린다.
Prisma 7.10.0 과 MySQL 8.4.8 에서 확인했다. 초기 migration 을 손으로 이어 붙인 이유다.
Prisma 가 이 제약을 지우지는 않는다.

### 운영 DB 에 적용 완료로 표시한다

운영 DB 에는 `001` 과 `002` 가 이미 적용되어 있다.
초기 migration 을 다시 실행하지 않고 적용 완료로만 기록한다.

```bash
# cwd: career-os/services/recommendation-api
npx prisma migrate resolve --applied 20260921000000_baseline
npx prisma migrate status
```

이 명령은 배포 단계에서 한 번만 실행한다.
`status` 가 적용하지 않은 migration 이 없다고 답해야 한다.

## 배포

### image 를 만든다

build context 는 이 디렉터리다. 모노레포 루트가 아니다.

```bash
# cwd: career-os/services/recommendation-api
docker build -t <registry>/career-recommendation-backend:<태그> .
docker push <registry>/career-recommendation-backend:<태그>
docker inspect --format '{{index .RepoDigests 0}}' <registry>/career-recommendation-backend:<태그>
```

마지막 명령이 내는 digest 를 인프라 저장소의
`services/career-recommendation-backend/.env.example` 의 `CAREER_BACKEND_IMAGE` 에 적는다.
그 저장소의 변경이므로 별도 검토 단위로 올린다.

**바꾸기 전의 digest 를 먼저 적어 둔다.** 되돌릴 때 그 값이 필요하다.

### image 가 담는 것

`prisma/migrations/` 를 image 에 담아야 한다.
`GET /health/ready` 가 그 디렉터리를 읽어 적용되어야 할 migration 이름을 만들기 때문에,
담지 않으면 준비 확인이 통과하지 못한다. `migrate` 명령도 같은 디렉터리를 읽는다.

### `migrate` 를 부르는 자리

`prisma migrate deploy` 는 container 의 `migrate` 명령이 부른다.
저장소의 다른 어디에서도 부르지 않는다.

```bash
docker run --rm --env-file <환경 파일> <image> migrate
```

`serve` 와 같은 환경값을 읽는다.
`CAREER_RECOMMENDATION_DATABASE_URL` 또는 `DB_*` 로 접속 문자열을 만들어
Prisma CLI 에 `DATABASE_URL` 로 넘긴다.
적용할 migration 이 없으면 아무것도 하지 않고 종료 코드 0 으로 끝난다.

인프라 저장소의 `scripts/deploy-career-recommendation-backend.sh` 가
DB 를 백업한 뒤 이 명령을 부르고, 그 다음에 `serve` 로 서비스를 띄운다.

### 배포 뒤 확인

```bash
# cwd: career-os/services/recommendation-api
CAREER_RECOMMENDATION_API_URL=<배포한 주소> \
CAREER_RECOMMENDATION_API_TOKEN=<운영 token> \
  npm run test:deployed
```

`test/deployed-contract.e2e.test.ts` 가 읽기 경로만 확인한다.
환경값이 없으면 건너뛰지 않고 실패한다.

### 되돌린다

```bash
# 인프라 저장소
# 1. `.env.example` 의 `CAREER_BACKEND_IMAGE` 를 바꾸기 전 digest 로 되돌린다
# 2. 같은 배포 스크립트를 다시 돌린다
./scripts/deploy-career-recommendation-backend.sh
```

**`schema_migrations` table 을 지우지 않는다.**
되돌린 image 가 그 table 로 적용 상태를 판정한다.
지우면 되돌린 image 가 `001_position_schema` 와 `002_company_tier_assessments` 를 다시 실행한다.

`_prisma_migrations` table 은 남겨도 된다. 되돌린 image 는 그 table 을 읽지 않는다.

## 벤더링한 파일

`src/contracts/posting-candidate.ts` 는
`career-os/scripts/position-recommender/live-postings/contracts.ts` 의 사본이다.
소유자는 공고를 수집하는 `scripts/` 쪽이다.
사본을 고치지 말고 원본을 고친 뒤 다시 복사한다.
`src/contracts/posting-candidate.drift.test.ts` 가 두 파일이 어긋나지 않았는지 확인한다.

## 전환 전 정답지

`test/fixtures/legacy-contract/` 는 Bun 구현이 실제로 낸 응답을 뽑아 둔 기록이다.
전환이 HTTP 계약 12개 endpoint 와 오류 코드 12개를 바꾸지 않았다는 것을 이 값으로 증명한다.

| 파일 | 담는 것 |
| --- | --- |
| `cases.json` | case 34개. 요청 전문, 응답 전문, 쓰기 뒤의 DB 행과 비교할 열 |
| `README.md` | 뽑은 방법, 매 case 사이의 상태 초기화, 비교에서 뺀 열과 그 이유 |
| `capture-legacy.bun.ts` | 뽑는 데 쓴 스크립트 |

e2e 검사가 `test/support/legacy-contract.ts` 를 거쳐 이 값과 대조한다.
34개가 모두 어딘가에서 대조되는지는 `test/contract.e2e.test.ts` 가 단언한다.

**대조가 깨지면 이 파일을 고쳐 통과시키지 않는다.**
값이 다르면 새 구현이 계약을 어긴 것이다. 정답지가 틀렸다고 판단되면 먼저 사람에게 알린다.

**`capture-legacy.bun.ts` 는 다시 돌지 않는다.** Bun 구현이 없어졌기 때문이다.
값이 어디서 나왔는지 읽을 수 있도록 남긴 것이고, `tsconfig.json` 과 `vitest.config.ts` 의
`exclude` 에 들어 있다.

**언제 제거하나.** 새 스택이 운영에서 검증되고, 이 계약을 의도적으로 바꾸는 변경이 올 때다.
그때까지는 남긴다. 다음에 계약을 건드리는 사람이 무엇이 기준이었는지 읽을 수 있어야 한다.

