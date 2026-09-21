# Phase 01. 서비스를 독립 package로 세우고 Prisma 기준을 만든다

**Execution profile**: deep

## 목표

`career-os/services/recommendation-api/`를 모노레포 루트와 분리된 Node 22 package로 만들고,
운영 DB의 현재 schema를 Prisma의 초기 migration으로 등록한다.

이 phase가 끝나면 Prisma가 운영 schema를 정확히 알고, 앞으로의 schema 변경을
`prisma migrate`로 만들 수 있다.

**범위 외**: NestJS 코드, 기존 Bun 코드 제거, 도메인 로직.
이 phase는 기존 Bun 서비스를 건드리지 않는다. 두 스택이 잠시 같은 디렉터리에 공존한다.

## 컨텍스트

지금 `services/recommendation-api/`는 모노레포 루트 `package.json`과 `tsconfig.json`을 쓴다.
루트 tsconfig의 `verbatimModuleSyntax: true`는 NestJS의 의존성 주입과 충돌하므로
서비스가 자기 tsconfig를 가져야 한다.

운영 DB에는 `001_position_schema`와 `002_company_tier_assessments`가 이미 적용되어 있다.
두 파일은 `services/recommendation-api/migrations/`에 있다.

**근거 문서**: `docs/data-schema.md`의 「MySQL schema 적용」 절,
`docs/adr/ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md`

## 의도 메모

**`prisma migrate diff`가 만든 SQL을 초기 migration으로 쓰지 않는다.**
`--from-empty --to-config-datasource`로 운영 schema를 뽑으면 360줄이 나오는데
`CHECK` 제약 16개가 모두 빠진다. MySQL 8.4.8에서 실측했다.
초기 migration은 `001`과 `002`의 SQL 원문을 이어 붙인 것이어야 한다.

**버전을 정확히 적는다.** `prisma` CLI의 npm `latest` 태그가 다음 major의 RC를 가리킨다.
`^`나 `latest`로 적으면 CLI 8과 client 7이 섞인다.

**Prisma 7은 `prisma.config.ts`를 요구한다.** `datasource` 블록에 `url`을 쓰면
`P1012`로 거절한다. 연결 문자열은 config 파일이 소유한다.

`@prisma/adapter-mariadb`를 쓰는 이유는 MariaDB 때문이 아니다.
Prisma 7이 MySQL에 붙는 driver adapter가 이것이고, 순수 JavaScript 드라이버라
Rust engine 바이너리가 없어 Docker image의 libc 종류를 따지지 않아도 된다.

## 작업 항목

### 1. `services/recommendation-api/package.json` 신규

`name`은 `@career-os/recommendation-api`, `private: true`, `type: "module"`.

의존을 정확한 버전으로 적는다. 범위 지정자를 붙이지 않는다.

이 표가 닫힌 목록이다. 여기 없는 package를 뒤 phase에서 더 넣지 않는다.

| package | 버전 | 구분 |
| --- | --- | --- |
| `prisma` | `7.10.0` | dev |
| `@prisma/client` | `7.10.0` | 런타임 |
| `@prisma/adapter-mariadb` | `7.10.0` | 런타임 |
| `@nestjs/core` | `12` 계열의 정확한 최신 patch | 런타임 |
| `@nestjs/common` | `@nestjs/core`와 같은 버전 | 런타임 |
| `@nestjs/platform-express` | `@nestjs/core`와 같은 버전 | 런타임 |
| `reflect-metadata` | 최신 안정 | 런타임 |
| `rxjs` | 최신 안정 | 런타임 |
| `zod` | `^4.4.3` | 런타임 |
| `vitest` | 최신 안정 | dev |
| `typescript` | `^5.5.0` | dev |

NestJS 계열 여섯은 Phase 02가 쓴다. 여기서 함께 넣는 이유는 Phase 06의 runtime 단계가
`dist/`와 **운영 의존**과 `prisma/`만 담기 때문이다. 런타임 구분이 빠지면 배포한 image가 기동하지 않는다.

`zod`는 지금 루트 `package.json`의 `dependencies.zod`로 해결되고 있다.
서비스가 독립 package가 되면 루트 의존이 닿지 않으므로 서비스가 직접 가진다.
버전을 루트와 같게 두어 같은 schema 정의가 두 런타임에서 같게 동작하도록 한다.

`engines.node`를 `>=22.18.0`으로 적는다. Prisma 7이 요구하는 하한이다.

script 넷을 둔다.

```
"typecheck": "tsc --noEmit"
"test": "vitest run"
"prisma:generate": "prisma generate"
"prisma:status": "prisma migrate status"
```

### 2. `services/recommendation-api/tsconfig.json` 신규

루트 tsconfig를 상속하지 않고 독립으로 쓴다. 다음을 지킨다.

- `"experimentalDecorators": true`, `"emitDecoratorMetadata": true`
- `"verbatimModuleSyntax"`를 켜지 않는다
- `"module": "nodenext"`, `"moduleResolution": "nodenext"`, `"target": "ES2023"`
- `"strict": true`
- `"outDir": "dist"`, `"rootDir": "."`

`rootDir`를 `"."`로 두므로 이 디렉터리 밖의 파일을 import하면 `TS6059`로 emit이 깨진다.
지금 `position/schema.ts`가 패키지 밖 `contracts.ts`에서 값을 가져오고 있다. 작업 항목 8이 그것을 없앤다.

**서비스 안의 상대 import는 `.js` 확장자로 쓴다.** 확장자를 빼거나 `.ts`로 쓰면
`module: nodenext`로 emit할 때 거절된다. 지금 옮겨올 파일들은 `.ts`로 쓰고 있다.
루트 `tsconfig.json`의 `allowImportingTsExtensions: true`와 `noEmit: true` 조합이 그것을 허용해 왔을 뿐이다.

루트 `tsconfig.json`의 `include`에서 `career-os/services/**/*.ts`를 제거한다.
남겨 두면 루트 타입 검사가 `verbatimModuleSyntax: true`인 설정으로 NestJS 파일까지 검사한다.
빼고 나면 루트 검사는 `career-os/scripts/`가 실제로 import하는 서비스 파일만 끌어온다.
그것은 schema와 hash와 `canonicalRequestHash` 셋이고 데코레이터를 쓰지 않는다.

### 3. `services/recommendation-api/prisma.config.ts` 신규

```ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: {
    url: process.env.DATABASE_URL!,
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
```

`shadowDatabaseUrl`이 없으면 `prisma migrate diff --from-migrations`가 돌지 않는다.

**`DATABASE_URL`과 `SHADOW_DATABASE_URL` 둘 다 환경 변수로 주어야 한다.**
`prisma validate`, `prisma db pull`, `prisma migrate diff`, `prisma migrate deploy`가 모두 이 둘을 읽는다.
검증 절의 명령이 이 둘을 설정한다. 서비스 코드가 읽는 `CAREER_RECOMMENDATION_TEST_DATABASE_URL`과는 별개다.

### 4. `services/recommendation-api/prisma/migrations/` 신규

디렉터리 이름은 `20260921000000_baseline`으로 한다.
그 안의 `migration.sql`은 `migrations/001_position_schema.sql`과
`migrations/002_company_tier_assessments.sql`을 순서대로 이어 붙인 것이다. 내용을 고치지 않는다.

`prisma/migrations/migration_lock.toml`에 `provider = "mysql"` 한 줄을 둔다.
없으면 `Could not determine the connector from the migrations directory`로 실패한다.

기존 `services/recommendation-api/migrations/` 디렉터리는 이 phase에서 지우지 않는다.
Phase 06이 지운다.

### 5. `services/recommendation-api/prisma/schema.prisma` 신규

**`db pull` 앞에 초기 migration을 test database에 적용한다.** 빈 database를 pull하면 model이 0개다.

```bash
# cwd: career-os/services/recommendation-api
docker exec plan125-mysql mysql -uroot -pplan125 -e \
  "DROP DATABASE IF EXISTS fos_career_test;
   CREATE DATABASE fos_career_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"

DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npx prisma migrate deploy
```

`fos_career_test`에는 `001`과 `002`가 이미 적용되어 있다. 그대로 pull하면
Prisma가 만들지 않은 상태를 기준점으로 굳히게 되므로 위에서 database를 다시 만든다.
**container 자체는 다시 만들지 않는다.** 이미 떠 있고 collation이 운영과 맞춰져 있다.

그 다음 `prisma db pull`로 만든다. 손으로 쓰지 않는다.

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "mysql"
}
```

`db pull`은 `CHECK` 제약을 무시했다는 경고를 낸다. 정상이다.

**model이 18개 나와야 한다.** `001`의 `CREATE TABLE` 15개와 `002`의 3개를 합한 수이고,
그 안에 `schema_migrations`가 이미 들어 있다. `_prisma_migrations`는 `migrate deploy`가 만든 것이라
`db pull` 대상에서 빼야 한다. 포함되면 19개가 되므로 그때는 `schema.prisma`에서 그 model을 지운다.

`src/generated/`를 `.gitignore`에 넣는다.

### 6. 운영 DB에 적용 완료로 표시하는 절차를 문서에 남긴다

`services/recommendation-api/README.md`에 아래 명령을 적는다. 이 phase에서 운영 DB에 실행하지 않는다.
실행은 Phase 06이 한다.

```bash
# cwd: career-os/services/recommendation-api
npx prisma migrate resolve --applied 20260921000000_baseline
```

### 7. `contracts.ts`를 서비스 안으로 벤더링한다

`career-os/scripts/position-recommender/live-postings/contracts.ts`를
`services/recommendation-api/src/contracts/posting-candidate.ts`로 **파일 전체를 바이트 그대로** 복사한다.
필요한 부분만 떼어 오지 않는다. 161줄이라 통째로 두는 비용이 작고, 떼는 범위가 판단이 되면
대조 테스트가 무엇을 비교해야 하는지도 흔들린다.

원본은 `zod` 하나만 import하고 상대 경로 import가 없다. 그래서 옮긴 자리에서 그대로 컴파일된다.

파일 머리에 아래 주석 블록을 붙인다. 이 블록은 대조에서 뺀다.

```ts
// 이 파일은 career-os/scripts/position-recommender/live-postings/contracts.ts 의 사본이다.
// 고치지 말고 원본을 고친 뒤 다시 복사한다.
```

**원본을 지우지 않는다.** `scripts/position-recommender/`의 8개 파일이 원본을 계속 쓴다.
소유자는 공고 수집을 하는 `scripts/` 쪽이고, 서비스는 받는 쪽의 검증 schema를 자기 안에 두는 것뿐이다.

### 8. `services/recommendation-api/vitest.config.ts` 신규

`prisma/`와 `src/`와 `test/` 아래의 `*.test.ts`를 모두 잡도록 `include`를 적는다.
`node_modules`와 `dist`와 `src/generated`를 `exclude`한다.
Phase 02 이후가 `test/` 아래에 파일을 더하므로 그 경로가 처음부터 들어 있어야 한다.

### 9. 이 phase를 검증하는 `prisma/baseline.test.ts`

Vitest로 쓴다. `CAREER_RECOMMENDATION_TEST_DATABASE_URL`이 없으면
**건너뛰지 말고 실패한다.** 건너뛴 실행을 완료 근거로 쓰지 않기 위해서다.

확인할 것 넷이다.

1. 초기 migration을 빈 database에 적용하면 `CHECK` 제약이 16개 생긴다.
   `information_schema.CHECK_CONSTRAINTS`를 센다.
2. 적용한 database와 `schema.prisma`의 차이가 없다.
   `prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --script`의
   출력이 `-- This is an empty migration.` 이다.
3. `schema.prisma`에 model이 18개 있다.
4. 초기 migration의 SQL이 `migrations/001_position_schema.sql`과
   `migrations/002_company_tier_assessments.sql`을 이어 붙인 것과 바이트 단위로 같다.
   손으로 고치면 여기서 깨진다.

### 10. 벤더링이 어긋나지 않는지 확인하는 `src/contracts/posting-candidate.drift.test.ts`

원본 파일을 텍스트로 읽어 사본과 대조한다. 주석 블록 두 줄을 뺀 나머지가 바이트 단위로 같아야 한다.

**`env`로 가리지 않는다.** 기본 `npm test`에 들어간다. 이 테스트가 없으면 벤더링은 그냥 중복이다.
원본 파일이 없으면 **건너뛰지 말고 실패한다.**

Docker image 안에는 원본이 없지만 image에 테스트를 담지 않으므로 문제가 되지 않는다.

## 검증

**테스트용 MySQL container는 이미 떠 있다. 다시 만들지 않는다.**
계획 단계에서 실측하느라 띄워 둔 것이고, collation이 운영 `fos_career`와 같은 `utf8mb4_unicode_ci`다.
기본값 `utf8mb4_0900_ai_ci`로 다시 만들면 foreign key가 `incompatible` 오류로 붙지 않는다.

| 항목 | 값 |
| --- | --- |
| container | `plan125-mysql` |
| image | `mysql:8.4.8` |
| port | `13400` |
| database | `fos_career_test`, `fos_career_shadow` |
| 계정 | `root` / `plan125` |

떠 있는지 먼저 확인한다. 없을 때만 아래로 만든다.

```bash
# cwd: 아무 곳
docker ps --filter name=plan125-mysql --format '{{.Names}} {{.Status}}'
```

```bash
# 위 명령의 출력이 비었을 때만 실행한다
docker run -d --name plan125-mysql \
  -e MYSQL_ROOT_PASSWORD=plan125 -e MYSQL_DATABASE=fos_career_test \
  -p 13400:3306 mysql:8.4.8 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

docker exec plan125-mysql sh -c \
  'until mysqladmin ping -uroot -pplan125 --silent 2>/dev/null; do sleep 1; done'

docker exec plan125-mysql mysql -uroot -pplan125 \
  -e "CREATE DATABASE fos_career_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

작업 항목 5가 `fos_career_test`를 지우고 다시 만든 뒤 `migrate deploy`까지 끝낸 상태여야 한다.

```bash
# cwd: 저장소 루트
cd career-os/services/recommendation-api
npm install
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npx prisma validate
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `prisma validate`가 종료 코드 0
- `typecheck`가 종료 코드 0
- `baseline.test.ts`의 네 항목이 모두 통과
- `posting-candidate.drift.test.ts`가 통과
- 테스트 출력에 `skipped`가 없다

루트에서 기존 Bun 테스트가 여전히 통과하는지 확인한다. 이 phase는 그것을 건드리지 않았다.
기준값은 `395 pass / 1 skip / 0 fail`이고, 그 1 skip은 env로 막힌 S3 통합 테스트다.

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
npx tsc --noEmit
```

`tsc`가 종료 코드 0이어야 한다. 작업 항목 2가 루트 `include`에서 서비스를 뺐으므로
루트 검사는 `career-os/scripts/`가 import하는 서비스 파일만 끌어온다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/package.json` | 신규 |
| `career-os/services/recommendation-api/tsconfig.json` | 신규 |
| `career-os/services/recommendation-api/vitest.config.ts` | 신규 |
| `career-os/services/recommendation-api/prisma.config.ts` | 신규 |
| `career-os/services/recommendation-api/prisma/schema.prisma` | 신규 |
| `career-os/services/recommendation-api/prisma/migrations/20260921000000_baseline/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/baseline.test.ts` | 신규 |
| `career-os/services/recommendation-api/src/contracts/posting-candidate.ts` | 신규 (벤더링) |
| `career-os/services/recommendation-api/src/contracts/posting-candidate.drift.test.ts` | 신규 |
| `tsconfig.json` | 루트 `include`에서 `career-os/services/**/*.ts` 제거 |
| `career-os/services/recommendation-api/prisma/migrations/20260921000000_baseline/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/migrations/migration_lock.toml` | 신규 |
| `career-os/services/recommendation-api/prisma/baseline.test.ts` | 신규 |
| `career-os/services/recommendation-api/README.md` | 신규 |
| `career-os/services/recommendation-api/.gitignore` | 신규 |
| `tsconfig.json` | 수정 |
