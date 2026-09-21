# recommendation-api

추천 Backend 서비스다. 모노레포 루트와 분리된 Node 22 package 로 동작한다.

## 요구 환경

- Node `>=22.18.0`
- MySQL 8.4

## 환경 변수

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
npm run prisma:generate
npm run prisma:status
```

## Prisma migration

`prisma/migrations/20260921000000_baseline/` 이 운영 schema 의 기준점이다.
그 `migration.sql` 은 같은 디렉터리의 `source/001_position_schema.sql` 과
`source/002_company_tier_assessments.sql` 을 순서대로 이어 붙인 것이고 내용을 고치지 않는다.
`source/` 의 둘은 전환 전 구현이 쓰던 원본이고 비교 대상으로만 남긴다.
`prisma/baseline.test.ts` 가 그 동일성을 바이트 단위로 확인한다.

### 운영 DB 에 적용 완료로 표시한다

운영 DB 에는 `001` 과 `002` 가 이미 적용되어 있다.
초기 migration 을 다시 실행하지 않고 적용 완료로만 기록한다.

```bash
# cwd: career-os/services/recommendation-api
npx prisma migrate resolve --applied 20260921000000_baseline
```

이 명령은 배포 단계에서 한 번만 실행한다.

## 벤더링한 파일

`src/contracts/posting-candidate.ts` 는
`career-os/scripts/position-recommender/live-postings/contracts.ts` 의 사본이다.
소유자는 공고를 수집하는 `scripts/` 쪽이다.
사본을 고치지 말고 원본을 고친 뒤 다시 복사한다.
`src/contracts/posting-candidate.drift.test.ts` 가 두 파일이 어긋나지 않았는지 확인한다.
