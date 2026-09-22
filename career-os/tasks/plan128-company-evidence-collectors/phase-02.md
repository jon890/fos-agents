# Phase 02. 인증키가 필요 없는 수집기 셋을 만든다

**Execution profile**: deep

## 목표

기술 블로그 RSS와 GitHub organization과 우리가 이미 모은 공고에서
회사 근거를 뽑는 수집기 셋을 만든다.

세 수집기가 `growth-scope`와 `team-growth` 축을 채운다.

**범위 외**: OpenDART와 Blind 수집기는 Phase 03이다.
모델이 근거를 읽고 판정하는 것은 Phase 04다.

## 컨텍스트

수집기는 `scripts/position-recommender/company-evidence/collectors/`에 소스마다 하나씩 둔다.
`scripts/position-recommender/live-postings/adapters/`가 이미 쓰는 모양이다.
등록은 `adapters/index.ts`와 같은 자리에서 `collectors/index.ts`가 한다.

근거를 저장하는 자리는 첫째 계획이 만들었다.
`PUT api/positions/v1/company-tier-runs/:companyTierRunId/evidence`다.

2026-09-22에 실제로 요청해 확인한 것이다.
토스, 우아한형제들, 카카오, 네이버 D2, 당근, LINE, 쿠팡, 무신사 여덟 곳의 RSS가 모두 200이고,
우아한형제들 RSS의 항목이 `title`과 `dc:creator`와 `category`와 `pubDate`를 담는다.
GitHub organization API는 저장소마다 `language`와 `stargazers_count`와 `pushed_at`을 준다.

**근거 문서**: `docs/code-architecture.md`의 「근거 수집기」 절,
`docs/data-schema.md`의 「회사 근거」 절,
`docs/adr/ADR-125-회사-판정은-세-축을-각각-낸다.md`

## 의도 메모

**회사 목록을 수집기 코드에 넣지 않는다.**
회사별 RSS 주소와 GitHub organization 이름은 `company_preferences`가 담는다.
수집기에 넣으면 회사를 더할 때마다 코드를 고치게 된다.

**수집기 하나가 실패해도 다른 수집기는 계속한다.**
`docs/flow.md`의 「근거 수집이 실패했을 때」 표가 무엇이 어떻게 되는지 정한다.
실패를 던져 전체를 멈추지 않는다.

**RSS 본문을 통째로 저장하지 않는다.**
`summary`는 500자까지다. 판정에 필요한 것은 무엇을 얼마나 자주 쓰는지이고
본문 전체가 아니다. `payload_json`에는 최근 글 목록의 제목과 분류와 날짜만 담는다.

**공고 수집기는 외부를 부르지 않는다.**
이미 저장된 `positions`를 읽는다. 이것이 축 2의 가장 직접적인 근거다.
다만 `first_seen_at`의 가장 이른 값이 2026-09-18이라 아직 나흘치다.
**시간이 지나야 값이 쌓이는 축이라는 것을 수집기가 `summary`에 적는다.**

## 작업 항목

### 1. `company_preferences`에 수집 대상 주소를 더한다

`prisma/migrations/`에 새 디렉터리를 만들어 칸 둘을 더한다.

- `tech_blog_feed_url` `VARCHAR(2048)` NULL
- `github_org` `VARCHAR(191)` NULL

`src/positions/schema.ts`의 `companyPreferenceUpdateSchema`에 둘을 더한다.
`tech_blog_feed_url`은 HTTPS만 받는다.

### 2. `company-evidence/collectors/` 골격을 만든다

`collectors/types.ts`가 수집기 인터페이스를 정한다.
입력은 회사 하나의 `companyKey`와 `companyName`과 `company_preferences` 행이고,
출력은 `CompanyEvidence` 배열이다.

`collectors/index.ts`가 수집기를 등록한다.
`collectors/registry.ts`가 회사마다 어느 수집기를 돌릴지 정하고,
Backend에서 받은 유효한 근거가 있으면 그 수집기를 건너뛴다.

### 3. `collectors/tech-blog.ts`

`tech_blog_feed_url`이 있는 회사만 대상이다.
RSS와 Atom을 모두 읽는다. 최근 20건까지 본다.

한 회사에 근거 한 건을 만든다.

| 칸 | 값 |
| --- | --- |
| `sourceType` | `tech-blog` |
| `url` | feed 주소 |
| `summary` | 최근 몇 달에 몇 건을 냈고 어느 분류가 많은지 한 줄 |
| `payloadJson` | 최근 글의 `title`과 `category`와 `pubDate`와 `creator` |
| `validUntil` | 오늘부터 14일 |

feed가 응답하지 않거나 항목이 0건이면 근거를 만들지 않고 진단만 남긴다.

### 4. `collectors/github.ts`

`github_org`가 있는 회사만 대상이다.
`https://api.github.com/orgs/<org>/repos?per_page=100&sort=pushed`를 읽는다.
인증 없이 부르면 시간당 60회 제한이 있다. 회사 수가 그보다 적지만
제한에 걸리면 근거를 만들지 않고 진단만 남긴다.

한 회사에 근거 한 건을 만든다.
`summary`는 최근 1년 안에 push된 저장소 수와 많이 쓰인 언어를 담는다.
`payloadJson`에는 상위 20개 저장소의 이름과 언어와 star 수와 `pushed_at`을 담는다.
`validUntil`은 30일이다.

### 5. `collectors/job-posting.ts`

Backend의 활성 공고를 읽는다. 외부를 부르지 않는다.
`summary`는 그 회사의 활성 공고 수와 최근 30일에 새로 뜬 공고 수를 담는다.
공고 이력이 짧으면 그 사실을 `summary`에 함께 적는다.

`payloadJson`에는 공고 제목과 `first_seen_at`을 담는다.
`validUntil`은 오늘이다. 수집 실행마다 다시 만든다.

### 6. 이 phase를 검증하는 `company-evidence/collectors/collectors.test.ts`

확인할 것이다.

- RSS 응답을 고정한 입력으로 주면 `summary`와 `payloadJson`이 정해진 모양으로 나온다
- Atom 형식도 같은 결과를 낸다
- feed가 404면 근거를 만들지 않고 진단을 남기며 예외를 던지지 않는다
- GitHub이 403을 내면 같은 동작이다
- `tech_blog_feed_url`이 없는 회사는 그 수집기를 건너뛴다
- `registry.ts`가 유효한 근거가 이미 있는 수집기를 건너뛴다
- 수집기 하나가 예외를 던져도 나머지 둘의 결과가 남는다
- `summary`가 500자를 넘지 않는다

외부 요청은 stub으로 막는다. 테스트가 네트워크를 타지 않는다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender
bunx tsc --noEmit
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

- 넷이 모두 종료 코드 0
- `collectors.test.ts`의 항목이 모두 통과
- 출력에 `skipped`가 없다

**수집기가 네트워크를 타지 않는지 센다.**

```bash
# cwd: 저장소 루트
grep -rn "fetch(" career-os/scripts/position-recommender/company-evidence/collectors \
  --include=*.test.ts
```

출력이 비어야 한다. 테스트에서 직접 `fetch`를 부르면 외부에 의존하는 테스트다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/company-evidence/collectors/types.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/index.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/registry.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/tech-blog.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/github.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/job-posting.ts` | 신규 |
| `career-os/scripts/position-recommender/company-evidence/collectors/collectors.test.ts` | 신규 |
| `career-os/services/recommendation-api/prisma/migrations/*/migration.sql` | 신규 |
| `career-os/services/recommendation-api/src/positions/schema.ts` | 수정 |
