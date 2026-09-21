## ADR-121: 추천 Backend는 NestJS와 Prisma로 운영한다

- **status**: `accepted`
- **결정**: `services/recommendation-api/`는 Node 22 위의 NestJS로 돌고 Prisma로 MySQL을 읽고 쓴다. 모노레포 루트와 별도의 `package.json`과 `tsconfig.json`을 가진다. 버전은 `@nestjs/core` 12, `prisma` 7.10.0, `@prisma/client` 7.10.0, `@prisma/adapter-mariadb` 7.10.0으로 고정한다.
- **대체된 부분**: [ADR-118](ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md)의 런타임과 ORM 조항을 대체한다. 대체하기 전 문장은 `Backend는 Bun의 HTTP 서버와 Bun.SQL을 사용하며 새 ORM과 외부 queue를 도입하지 않는다` 였다. 외부 queue를 도입하지 않는다는 결정은 유지한다. 상태의 소유가 `career-os` API와 `fos_career`에 있다는 것, 수집기와 skill이 DB에 직접 붙지 않는다는 것, 배포 경계가 홈서버 인프라 저장소에 있다는 것도 모두 유지한다.
- **맥락**: 회사 tier 평가 table을 더할 때 `services/recommendation-api/migrations/002_company_tier_assessments.sql`을 230줄 손으로 썼다. MySQL 8.4에는 `ADD COLUMN IF NOT EXISTS`가 없어 `information_schema`를 조회하는 가드 블록을 열 개 넣었다. 2026-09-19 홈서버의 일회용 database에 `position_analysis_run_items`를 본뜬 table을 만들고 기존 행 둘을 넣은 뒤 `company_tier_source ENUM('manual','model','default') NOT NULL`을 한 번에 붙여 보니 두 행이 첫 값인 `manual`로 채워졌다. 그래서 nullable 추가, 이관 `UPDATE`, `MODIFY NOT NULL`, `CHECK` 추가의 네 단계로 나눴다. 같은 종류의 변경을 Prisma에 시켜 보니 `ALTER TABLE ... ADD COLUMN` 한 줄이 나왔다. 한편 `Bun.SQL`은 행과 도메인 타입 사이의 매핑을 주지 않아, 저장 계층 746줄 중 대부분이 그 변환을 손으로 쓴 것이다. column을 하나 더할 때 읽는 자리와 쓰는 자리를 둘 다 고쳐야 하고, 한쪽만 고쳐도 타입 검사를 통과한다.
- **대안 기각**:
  - Bun과 `Bun.SQL`을 유지하고 migration 도구만 더하는 안은 기각했다. 순서와 적용 기록은 얻지만 SQL은 여전히 손으로 쓴다. 위의 네 단계 분리와 가드 블록이 그대로 남으므로 가장 비싼 부분이 줄지 않는다.
  - Bun 위에서 NestJS와 Prisma를 쓰는 안은 기각했다. 모노레포 루트 `tsconfig.json`의 `verbatimModuleSyntax: true`가 type import를 지워 NestJS의 의존성 주입이 깨진다. tsconfig를 서비스 단위로 나누면 피할 수 있지만, Bun과 NestJS와 Prisma 7의 조합은 검증 사례가 적어 문제를 만났을 때 원인이 셋 중 어디인지 가리기 어렵다.
  - Drizzle을 쓰는 안은 기각했다. 질의는 타입 안전하지만 migration 생성이 Prisma보다 약하고, `CHECK` 제약이 있는 기존 schema를 기준으로 삼는 절차가 확립되어 있지 않다.
  - Prisma만 도입하고 HTTP 계층을 그대로 두는 안은 기각했다. endpoint가 9개라 NestJS의 의존성 주입과 module이 주는 이득이 작은 것은 맞다. 다만 Bun을 떠나면 `Bun.serve`를 대체해야 하고, 그 자리를 손으로 채우면 guard와 interceptor와 filter를 직접 만들게 된다.
- **결과**:
  - 얻는 것: schema 변경이 `prisma migrate`가 만든 SQL로 끝난다. column 추가에 230줄이 아니라 한 줄이 나온다. 질의 결과가 `schema.prisma`에서 파생한 타입으로 오므로 읽는 자리와 쓰는 자리가 어긋나면 타입 검사가 잡는다. `@prisma/adapter-mariadb`는 순수 JavaScript 드라이버라 Rust engine 바이너리가 없고 Docker image의 libc 종류를 따지지 않는다.
  - 감당할 것: Prisma는 `CHECK` 제약을 모델링하지 않는다. 2026-09-21 MySQL 8.4.8에 `001`과 `002`를 적용한 database를 `prisma db pull` 한 뒤 `prisma migrate diff --from-migrations --to-schema` 로 비교하니 빈 migration이 나와, Prisma가 이 제약을 지우지는 않는 것을 확인했다. 다만 `schema.prisma`에 나타나지 않으므로 코드만 읽고는 16개가 있다는 것을 알 수 없고, 제약을 바꿀 때는 migration SQL에 직접 써야 한다. `prisma` CLI의 npm `latest` 태그가 다음 major의 RC를 가리켜, 버전을 명시하지 않으면 CLI와 client의 major가 어긋난다. 빌드 단계가 생겨 컴파일 산출물을 image에 담는다. 모노레포에 실행 환경이 둘이 되며, 두 쪽이 공유하는 계약 파일은 `scripts/position-recommender/live-postings/contracts.ts` 하나다.
- **적용 범위**: `services/recommendation-api/` 전체, 루트 `tsconfig.json`, `services/recommendation-api/Dockerfile`과 `docs/code-architecture.md`. 홈서버의 image build와 배포 스크립트는 인프라 저장소가 함께 바꾼다.
