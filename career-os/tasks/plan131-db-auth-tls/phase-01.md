# Phase 01. DB 연결을 TLS 로 바꾼다

**Execution profile**: deep

## 목표

MySQL 의 인증 캐시가 비어 있어도 추천 Backend 가 DB 에 바로 붙게 한다.

**범위 외**: 홈서버 배포 스크립트. 그쪽 우회는 fos-home-infra 에서 따로 한다.

## 컨텍스트

2026-09-25 운영 배포가 두 번 실패했다. 원인이다.

- 배포 스크립트가 배포마다 `ALTER USER` 와 `FLUSH PRIVILEGES` 를 실행한다
- 그러면 MySQL 8.4 의 `caching_sha2_password` 인증 캐시가 비워진다
- 캐시가 빈 상태에서 전체 인증을 하려면 TLS 연결이거나 서버 공개키를 받아야 한다
- 추천 Backend 의 mariadb driver 는 둘 다 켜지 않아 connect timeout 10초 뒤 `GET /health/ready` 가 503 을 냈다

재현 결과다. `FLUSH PRIVILEGES` 직후 probe 는 503 에 10,032ms,
app 계정으로 `mysql --ssl-mode=REQUIRED` 로그인을 한 번 한 뒤 probe 는 200 에 31ms 다.
운영 MySQL 이 TLS 를 지원한다는 뜻이기도 하다.

MySQL 이 재시작해도 캐시가 비므로 배포 스크립트만 고쳐서는 막을 수 없다.

연결 설정은 `career-os/services/recommendation-api/src/prisma/prisma.service.ts` 의 `mariaDbPoolConfig` 가 만든다.
`@prisma/adapter-mariadb` 가 이 `PoolConfig` 를 그대로 mariadb driver 에 넘긴다.

**근거 문서**: `docs/code-architecture.md` 의 「추천 상태 Backend」 절,
`docs/adr/ADR-121-추천-backend는-nestjs와-prisma로-운영한다.md`

## 의도 메모

**`allowPublicKeyRetrieval` 대신 TLS 를 쓴다.**
공개키 방식은 TLS 가 없어도 되지만, 중간에서 공개키를 바꿔치기하면 비밀번호가 새어 나간다.
TLS 는 채널 자체를 암호화한다. 운영 MySQL 이 이미 TLS 를 지원한다.

**인증서 검증은 끈다.** MySQL container 가 스스로 만든 인증서라 검증할 CA 가 없다.
Backend 와 MySQL 은 같은 docker network 안에 있다. 이 판단을 코드 주석에 남긴다.

**TLS 를 끄는 경로를 만들지 않는다.** 로컬 테스트 container 인 `mysql:8.4.8` 도 기본으로 TLS 를 켠다.
끄는 설정이 있으면 이번 장애가 다시 난다.

## 작업 항목

### 1. `mariaDbPoolConfig` 에 TLS 를 켠다

`ssl: { rejectUnauthorized: false }` 를 더한다.
위 판단을 주석으로 남긴다. 이 함수의 기존 주석 모양을 따른다.

### 2. 문서에 연결 방식을 적는다

`docs/code-architecture.md` 의 「추천 상태 Backend」 절에 한 줄을 더한다.
DB 연결은 TLS 를 쓰고 그 이유가 MySQL 인증 캐시라는 것이다.

### 3. 이 phase 를 검증하는 `test/db-auth-cache.e2e.test.ts`

이번 장애를 재현한다.

- root 연결로 `FLUSH PRIVILEGES` 를 실행한다
- `FLUSH PRIVILEGES` 전에 root 연결의 `CURRENT_USER()` 에 해당하는
  `mysql.user.plugin` 이 `caching_sha2_password` 인지 단언한다
- 곧바로 `mariaDbPoolConfig` 로 새 pool 을 만들어 `SELECT 1` 을 보낸다
- 2초 안에 성공해야 한다

TLS 를 빼면 이 테스트가 실패하는지도 한 번 확인하고, 그 결과를 커밋 본문에 적는다.
테스트 파일에는 TLS 를 뺀 판을 남기지 않는다.

`src/prisma/` 에 `mariaDbPoolConfig` 의 단위 테스트가 있으면 `ssl` 칸을 단언하는 항목도 더한다.

## 검증

테스트용 MySQL container 의 존재와 실행 상태를 확인한다.
없으면 만들고 중지돼 있으면 시작한다. 이미 실행 중이면 그대로 쓴다.
어느 경우든 응답할 때까지 기다린 뒤 `fos_career_shadow` 를 만들고 migration 을 적용한다.

```bash
# cwd: 아무 곳
docker ps -a --filter name=plan125-mysql --format '{{.Names}} {{.Status}}'
```

```bash
# container 가 없을 때만 실행한다
docker run -d --name plan125-mysql \
  -e MYSQL_ROOT_PASSWORD=plan125 -e MYSQL_DATABASE=fos_career_test \
  -p 13400:3306 mysql:8.4.8 \
  --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
# container 가 중지돼 있을 때만 실행한다
docker start plan125-mysql
```

```bash
# container 상태와 관계없이 실행한다
until docker exec plan125-mysql mysqladmin ping -uroot -pplan125 --silent; do sleep 1; done
docker exec plan125-mysql mysql -uroot -pplan125 \
  -e 'CREATE DATABASE IF NOT EXISTS fos_career_shadow'

# cwd: career-os/services/recommendation-api
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx prisma migrate deploy
```

```bash
# cwd: career-os/services/recommendation-api
npx prisma generate
npm run typecheck
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_RECOMMENDATION_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

기대값이다.

- `typecheck` 가 종료 코드 0
- `db-auth-cache.e2e.test.ts` 가 통과
- 기존 테스트가 계속 통과
- 출력에 `skipped` 가 없다

## 이 plan 을 마감한다

위 검증이 모두 통과하면 `tasks/plan131-db-auth-tls/index.json` 의
`status` 를 `completed` 로 바꾸고 `current_phase` 를 1 로 둔다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/recommendation-api/src/prisma/prisma.service.ts` | 수정 |
| `career-os/services/recommendation-api/test/db-auth-cache.e2e.test.ts` | 신규 |
| `career-os/docs/code-architecture.md` | 수정 |
