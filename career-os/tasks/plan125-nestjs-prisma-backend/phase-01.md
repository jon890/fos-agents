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

| package | 버전 | 구분 |
| --- | --- | --- |
| `prisma` | `7.10.0` | dev |
| `@prisma/client` | `7.10.0` | 런타임 |
| `@prisma/adapter-mariadb` | `7.10.0` | 런타임 |
| `vitest` | 최신 안정 | dev |
| `typescript` | `^5.5.0` | dev |

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

루트 `tsconfig.json`의 `include`에서 `career-os/services/**/*.ts`를 제거한다.
남겨 두면 루트 타입 검사가 데코레이터를 모르는 설정으로 이 디렉터리를 검사한다.

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

### 4. `services/recommendation-api/prisma/migrations/` 신규

디렉터리 이름은 `20260921000000_baseline`으로 한다.
그 안의 `migration.sql`은 `migrations/001_position_schema.sql`과
`migrations/002_company_tier_assessments.sql`을 순서대로 이어 붙인 것이다. 내용을 고치지 않는다.

`prisma/migrations/migration_lock.toml`에 `provider = "mysql"` 한 줄을 둔다.
없으면 `Could not determine the connector from the migrations directory`로 실패한다.

기존 `services/recommendation-api/migrations/` 디렉터리는 이 phase에서 지우지 않는다.
Phase 06이 지운다.

### 5. `services/recommendation-api/prisma/schema.prisma` 신규

`prisma db pull`로 만든다. 손으로 쓰지 않는다.

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
model이 18개 나와야 한다. `schema_migrations`와 `_prisma_migrations`도 포함된다.

`src/generated/`를 `.gitignore`에 넣는다.

### 6. 운영 DB에 적용 완료로 표시하는 절차를 문서에 남긴다

`services/recommendation-api/README.md`에 아래 명령을 적는다. 이 phase에서 운영 DB에 실행하지 않는다.
실행은 Phase 06이 한다.

```bash
# cwd: career-os/services/recommendation-api
npx prisma migrate resolve --applied 20260921000000_baseline
```

### 7. 이 phase를 검증하는 `prisma/baseline.test.ts`

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

## 검증

**운영과 같은 MySQL 8.4.8을 로컬 container로 띄운다. collation을 맞춰야 한다.**
운영 `fos_career`는 `utf8mb4_unicode_ci`다. 기본값인 `utf8mb4_0900_ai_ci`로 만들면
foreign key가 `incompatible` 오류로 붙지 않는다.

```bash
# cwd: 저장소 루트
docker run -d --name plan125-mysql \
  -e MYSQL_ROOT_PASSWORD=plan125 -e MYSQL_DATABASE=fos_career_test \
  -p 13400:3306 mysql:8.4.8 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci

docker exec plan125-mysql sh -c \
  'until mysqladmin ping -uroot -pplan125 --silent 2>/dev/null; do sleep 1; done'

docker exec plan125-mysql mysql -uroot -pplan125 \
  -e "CREATE DATABASE fos_career_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

```bash
# cwd: 저장소 루트
cd career-os/services/recommendation-api
npm install
npx prisma validate
npm run typecheck
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `prisma validate`가 종료 코드 0
- `typecheck`가 종료 코드 0
- `baseline.test.ts`의 네 항목이 모두 통과
- 테스트 출력에 `skipped`가 없다

루트에서 기존 Bun 테스트가 여전히 통과하는지 확인한다. 이 phase는 그것을 건드리지 않았다.

```bash
# cwd: 아무 곳. 아래에서 저장소 루트로 옮긴다
cd /path/to/fos-agents
PATH="$HOME/.bun/bin:$PATH" bun test career-os/services/recommendation-api
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/package.json` | 신규 |
| `career-os/services/recommendation-api/tsconfig.json` | 신규 |
| `career-os/services/recommendation-api/vitest.config.ts` | 신규 |
| `career-os/services/recommendation-api/prisma.config.ts` | 신규 |
| `career-os/services/recommendation-api/prisma/schema.prisma` | 신규 |
| `career-os/services/recommendation-api/prisma/migrations/20260921000000_baseline/migration.sql` | 신규 |
| `career-os/services/recommendation-api/prisma/migrations/migration_lock.toml` | 신규 |
| `career-os/services/recommendation-api/prisma/baseline.test.ts` | 신규 |
| `career-os/services/recommendation-api/README.md` | 신규 |
| `career-os/services/recommendation-api/.gitignore` | 신규 |
| `tsconfig.json` | 수정 |
