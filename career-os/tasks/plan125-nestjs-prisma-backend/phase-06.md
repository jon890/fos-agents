# Phase 06. image를 바꾸고 운영에 올린다

**Execution profile**: deep

## 목표

새 스택의 Docker image를 만들고, 운영 DB에 Prisma의 초기 migration을 적용 완료로 표시한 뒤,
홈서버의 실행 중인 서비스를 한 번에 교체한다.

**범위 외**: 홈서버 인프라 저장소의 변경.
그 저장소는 이 저장소가 소유하지 않으므로 별도 검토 단위로 위임한다.

## 컨텍스트

운영 `fos_career`에는 `001_position_schema`와 `002_company_tier_assessments`가 이미 적용되어 있고
`schema_migrations` table에 두 행이 있다.
Prisma는 이 사실을 모르므로, 아무것도 하지 않으면 초기 migration을 다시 실행하려 한다.
**다시 실행하면 이미 있는 table을 만들려다 실패한다.**

지금까지 배포는 인프라 저장소의 `scripts/deploy-career-recommendation-backend.sh`가 했고,
image digest는 `services/career-recommendation-backend/.env.example`의
`CAREER_BACKEND_IMAGE`에 고정되어 있다.
그 스크립트는 배포 전에 DB를 백업하고 migration을 돌린다.

**근거 문서**: `docs/data-schema.md`의 「MySQL schema 적용」 절,
`docs/adr/ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md`의 「적용 범위」

## 의도 메모

**적용 완료 표시를 배포보다 먼저 한다.**
순서를 뒤집으면 새 image가 올라가 기동하면서 초기 migration을 실행하려 한다.

**`schema_migrations` table을 지우지 않는다.**
이 phase가 실패해 이전 image로 되돌릴 때 그 image가 이 table을 읽어 적용 상태를 판정한다.
지우면 되돌린 image가 `001`과 `002`를 다시 실행하려 한다.

**되돌리는 경로를 미리 확인한다.**
이전 image digest는 `sha256:cc9ebbb...` 계열이 아니라 이번 전환 직전의 값이다.
배포하기 전에 `.env.example`의 현재 값을 적어 둔다.
되돌릴 때는 그 digest로 `.env.example`을 되돌리고 같은 배포 스크립트를 다시 돌린다.
`_prisma_migrations` table이 남아 있어도 이전 image는 그것을 읽지 않으므로 무해하다.

**cron 실행 시각을 피한다.** 매일 도는 포지션 추천 cron과 겹치면
전환 중간 상태에서 실행이 걸린다.

## Blocked 조건

- Phase 05의 테스트가 하나라도 통과하지 않으면 `PHASE_BLOCKED: 전환 검증 미완료`를 출력하고 종료한다
- 운영 DB 백업이 만들어지지 않으면 `PHASE_BLOCKED: 백업 없음`을 출력하고 종료한다

## 작업 항목

### 1. `services/recommendation-api/Dockerfile` 수정

Node 22 기반으로 다시 쓴다. 두 단계로 나눈다.

- build 단계에서 의존을 설치하고 `prisma generate`와 `tsc`를 돌린다
- runtime 단계에 `dist/`와 운영 의존과 `prisma/`만 담는다

`prisma/migrations/`를 image에 담아야 한다. 배포 스크립트가 migration을 돌린다.

`ENTRYPOINT`가 `serve`와 `migrate` 두 명령을 받는 것은 그대로 유지한다.
인프라 저장소의 배포 스크립트가 그 형태를 가정한다.

`@prisma/adapter-mariadb`는 순수 JavaScript라 별도 바이너리를 담지 않는다.

### 2. `services/recommendation-api/README.md`에 배포 절차를 적는다

image build 명령, 적용 완료 표시 명령, 되돌리는 절차를 적는다.
holds 하는 값이 아니라 실행할 명령을 적는다.

### 3. 운영 DB에 초기 migration을 적용 완료로 표시한다

**배포보다 먼저 한다.** 홈서버에서 돌린다.

```bash
# cwd: career-os/services/recommendation-api
npx prisma migrate resolve --applied 20260921000000_baseline
npx prisma migrate status
```

`status`가 적용하지 않은 migration이 없다고 답해야 한다.

### 4. image를 만들고 배포한다

인프라 저장소의 `docs/operations.md`가 정한 image build 절차를 따른다.
`.env.example`의 `CAREER_BACKEND_IMAGE`를 새 digest로 바꾸는 것은
그 저장소의 변경이므로 별도 검토 단위로 올린다.

배포 스크립트를 돌리기 전에 그 스크립트가 DB를 백업하는 것을 확인한다.

### 5. 배포 뒤 확인

SQL로 확인할 것이다.

```sql
SELECT migration_name, finished_at FROM fos_career._prisma_migrations;
SELECT version FROM fos_career.schema_migrations ORDER BY version;
SELECT COUNT(*) FROM information_schema.CHECK_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'fos_career';
SELECT company_tier_source, COUNT(*) FROM fos_career.position_analysis_run_items
  GROUP BY company_tier_source;
```

기대값이다.

- `_prisma_migrations`에 `20260921000000_baseline` 한 행이 `finished_at`과 함께
- `schema_migrations`에 `001_position_schema`와 `002_company_tier_assessments` 두 행 그대로
- `CHECK` 제약이 16개 그대로
- `position_analysis_run_items`의 행 수와 분포가 배포 전과 같다

HTTP로 확인할 것이다.

- `GET /health/live`가 200
- `GET /health/ready`가 200
- `GET /api/v1/auth/check`가 유효한 token에 204, 틀린 token에 401
- 401 응답의 본문이 `{ error: { code: "UNAUTHORIZED", ... } }`
- container가 `status=running health=healthy restarts=0`

쓰기 경로를 멱등 키 4단계로 확인한다.
새 키는 처리, 같은 키에 같은 본문은 저장된 응답, 같은 키에 다른 본문은 409,
새 키는 다시 처리다.
**확인에 쓴 행을 지우고 잔여가 0건인 것을 확인한다.**

### 6. 전환 표시를 문서에서 지운다

`docs/code-architecture.md`의 「추천 상태 Backend」 절을 새 배치로 바꾼다.
「전환 전의 배치다」와 「옮기는 중이다」 문장을 지운다.

`docs/data-schema.md`의 「MySQL schema 적용」 절에서
「Prisma로 옮기는 중이다」를 지우고 현재형으로 바꾼다.

두 문서가 실제 디렉터리와 같은지 `ls`로 대조한 뒤 지운다.

### 7. 이 phase를 검증하는 `test/deployed-contract.e2e.test.ts`

**배포한 운영 서비스를 상대로 도는 테스트다.** 로컬 container가 아니다.
`CAREER_RECOMMENDATION_API_URL`과 `CAREER_RECOMMENDATION_API_TOKEN`을 받아
그 주소로 요청을 보낸다. 둘 중 하나가 없으면 건너뛰지 말고 실패한다.

읽기만 한다. 운영 데이터를 바꾸지 않는다.

- `GET /health/live`가 200
- `GET /health/ready`가 200
- `GET /api/v1/auth/check`가 유효한 token에 204, 틀린 token에 401
- 401 응답의 본문이 `{ error: { code: "UNAUTHORIZED", ... } }` 형식이다
- 모든 응답에 `Cache-Control: no-store`와 `X-Request-Id`가 있다
- 없는 경로가 `404 NOT_FOUND`이고 형식이 같다
- `GET /api/positions/v1/company-preferences`의 응답이
  `src/positions/schema.ts`의 schema를 통과한다

쓰기 경로의 멱등 4단계는 이 테스트에 넣지 않는다.
운영 DB에 행을 남기므로 5번의 수동 확인으로 하고 확인 뒤 지운다.


**이 파일을 기본 `npm test`에 넣지 않는다.**
운영 endpoint와 token을 요구하므로 로컬에서는 환경이 없다.
기본 `npm test`에 들어가면 이 파일이 생긴 뒤부터 로컬 검증이 항상 실패한다.

`vitest.config.ts`의 기본 `include`에서 빼고 `package.json`에 script를 따로 둔다.

```
"test:deployed": "vitest run test/deployed-contract.e2e.test.ts"
```

**env가 없으면 건너뛰지 말고 실패한다.** 이 script를 부른 것은 운영을 확인하려는 것이므로,
건너뛴 실행을 확인 근거로 쓰면 안 된다.

## 검증

**보고의 문장이 아니라 명령의 출력으로 판정한다.**
위 5번의 SQL 네 개와 HTTP 확인의 실제 출력이 기대값과 같아야 한다.

배포 전 백업 경로를 보고에 적는다. 없으면 이 phase는 완료가 아니다.

전환 표시를 지우기 전에 대조한다.

```bash
# cwd: 저장소 루트
ls career-os/services/recommendation-api/
grep -n 'src/\|prisma/' career-os/docs/code-architecture.md
```

문서의 표에 적힌 경로가 `ls` 결과에 모두 있어야 한다.

## 계획 마감

위 검증을 모두 통과하고 전환 표시를 지운 뒤
`index.json`의 `status`를 `completed`, `current_phase`를 6으로 바꾼다.

구현이 운영에 반영됐으므로 `tasks/plan125-nestjs-prisma-backend/` 디렉터리를 제거한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/Dockerfile` | 수정 |
| `career-os/services/recommendation-api/README.md` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
| `career-os/docs/data-schema.md` | 수정 |
| `career-os/services/recommendation-api/test/deployed-contract.e2e.test.ts` | 신규 |
