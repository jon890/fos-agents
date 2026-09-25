# Phase 02. 디렉터리, 모듈, 타입과 문서 설명을 새 이름으로 바꾼다

**Execution profile**: standard

## 목표

Backend 와 그 client 의 경로, 패키지, 타입, 함수 이름과 문서 설명을 「커리어 Backend」 로 바꾼다. 동작은 바꾸지 않는다.

**범위 외**: 환경값 대체는 phase 01, 옛 환경값 제거는 phase 03 이 한다.
홈서버 image 빌드 경로와 container 이름은 fos-home-infra 가 바꾼다.
DB 이름 `fos_career`, 계정 `fos_career_*`, API 경로(`/api/positions/v1`, `/api/study/v1`)는 바꾸지 않는다.
`docs/adr/` 와 `tasks/` 의 기존 파일은 결정 당시 기록이라 고치지 않는다.

## 컨텍스트

phase 01 이 끝난 상태에서 시작한다. 이름 대응이다.

| 옛 이름 | 새 이름 |
| --- | --- |
| `career-os/services/recommendation-api/` | `career-os/services/career-backend/` |
| 패키지 `@career-os/recommendation-api` (`package.json`, `package-lock.json`) | `@career-os/career-backend` |
| `career-os/scripts/position-recommender/recommendation-api/` | `career-os/scripts/position-recommender/career-backend/` |
| `career-os/scripts/lib/recommendation-api-config.ts` | `career-os/scripts/lib/career-backend-config.ts` |
| `RecommendationApiClient` | `CareerBackendClient` |
| `createRecommendationApiClient` | `createCareerBackendClient` |
| `RecommendationApiClientError` | `CareerBackendClientError` |
| `RecommendationApiClientOptions` | `CareerBackendClientOptions` |
| `RecommendationApiConfig` | `CareerBackendConfig` |
| `RecommendationApiConnection` | `CareerBackendConnection` |
| `resolveRecommendationApiConnection` | `resolveCareerBackendConnection` |
| `parseRecommendationApiOrigin` | `parseCareerBackendOrigin` |
| 문서와 문구의 「추천 Backend」, 「추천 상태 Backend」, 「추천 API」 | 「커리어 Backend」 |

`docs/code-architecture.md` 의 「추천 상태 Backend」 절 제목도 「커리어 Backend」 로 바꾼다.
이 절을 가리키는 anchor 링크(`code-architecture.md#추천-상태-backend`)도 함께 고친다. `docs/flow.md` 에 있다.
`docs/flow.md` 의 같은 이름 절도 제목을 바꾼다.

절 첫 문장 「포지션과 공부 추천의 장기 상태를 제공하는 Backend다」 는
「포지션 추천, 공부 추천, 회사 근거처럼 커리어 데이터의 장기 상태를 제공하는 Backend다」 로 바꾼다.

**근거 문서**: `docs/adr/ADR-128-커리어-backend로-이름을-넓힌다.md`

## 의도 메모

- 파일 이동은 `git mv` 로 한다. 이력이 이어진다
- `services/career-backend/node_modules` 는 추적되지 않으므로 이동 뒤 `npm ci` 로 다시 만든다
- 「추천」 이 도메인 뜻으로 쓰인 곳은 바꾸지 않는다. 예: `position-recommender`, `study_recommendation_*` 테이블, `recommendations` 경로, `RecommendationRun` 같은 추천 결과 타입
  - 판정 기준: 그 낱말이 Backend 나 API 전체를 가리키면 바꾸고, 추천이라는 기능이나 결과를 가리키면 둔다
- `services/career-backend/test/fixtures/legacy-contract/` 는 디렉터리와 함께 이동만 하고 내용은 고치지 않는다. 옛 서버의 계약을 찍은 기록이다. 그 README 의 cwd 경로처럼 이동 때문에 틀려지는 경로만 새 경로로 고친다
- 이름만 바꾸고 동작과 오류 코드는 바꾸지 않는다. 오류 문구의 「추천 API」 는 phase 01 에서 이미 바꿨다

## 작업 항목

### 1. 디렉터리와 패키지 이동

위 표의 세 경로를 `git mv` 로 옮기고, 패키지 이름을 바꾸고, `package-lock.json` 의 이름을 맞춘다.
`services/career-backend/Dockerfile` 의 build context 주석을 새 경로로 바꾼다.

### 2. import 와 타입, 함수 이름

옮긴 경로를 import 하는 파일(현재 22개. `grep -rln "recommendation-api/" career-os/scripts career-os/.claude` 로 찾는다)과
`recommendation-api-config` 를 import 하는 파일 셋을 새 경로로 고친다.
위 표의 타입과 함수 이름을 모두 바꾼다.

### 3. 문서와 스킬 문서의 설명

- `career-os/docs/code-architecture.md`, `docs/data-schema.md`, `docs/flow.md`
- `career-os/services/career-backend/README.md` (제목 `# recommendation-api` 포함)
- `career-os/.claude/skills/study-topic-recommender/references/source-management.md`, `references/execution.md`
- 저장소 루트의 `docs/code-architecture.md` 에 이 경로가 있으면 함께 고친다

경로와 cwd 주석(`# cwd: career-os/services/recommendation-api`)도 새 경로로 바꾼다.

### 4. 테스트

이름 변경만이므로 새 동작 테스트는 두지 않는다. 옛 이름이 남지 않았다는 검사를 하나 둔다.
`career-os/scripts/lib/career-backend-naming.test.ts` 를 두고 `git ls-files career-os` 로 추적 파일을 읽어 검사한다.
검사 대상에서 빼는 경로는 `career-os/docs/adr/`, `career-os/tasks/`, `career-os/services/career-backend/test/fixtures/legacy-contract/`, 이 테스트 파일 자신이다.

- `recommendation-api`, `RecommendationApi`, `추천 Backend`, `추천 상태 Backend`, `추천 API` 가 0건
- `CAREER_RECOMMENDATION_` 가 든 파일이 정확히 아래 다섯 개다
  - `career-os/scripts/lib/career-backend-config.ts`
  - `career-os/services/career-backend/src/config/config.ts`
  - `career-os/scripts/position-recommender/career-backend/client.test.ts`
  - `career-os/services/career-backend/src/config/config.test.ts`
  - `career-os/docs/code-architecture.md`

## 검증

저장소 루트에서 실행한다.

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
```

```bash
# cwd: career-os/services/career-backend
npm ci && npm run typecheck && npm run build
CAREER_BACKEND_TEST_DATABASE_URL=<테스트 DB> SHADOW_DATABASE_URL=<빈 shadow DB> npm test
```

기대값: 모두 실패 0. `docker build career-os/services/career-backend` 가 성공한다.

```bash
# cwd: 저장소 루트
git grep -nE "recommendation-api|RecommendationApi|추천 (상태 )?Backend|추천 API" -- career-os \
  ':!career-os/docs/adr' ':!career-os/tasks' ':!career-os/services/career-backend/test/fixtures/legacy-contract' \
  ':!career-os/scripts/lib/career-backend-naming.test.ts'
```

결과 0건. `CAREER_RECOMMENDATION_` 파일 목록은 naming 테스트가 검사한다.

## 마무리

검증이 통과하면 `career-os/tasks/plan132-career-backend-rename/index.json` 의 이 phase 를 완료로 표시하고 `current_phase` 를 다음 번호로 올린다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/` | 이동 (옛 `services/recommendation-api/`) |
| `career-os/scripts/position-recommender/career-backend/` | 이동 (옛 `recommendation-api/`) |
| `career-os/scripts/lib/career-backend-config.ts` | 이동 |
| import 하는 스크립트 25개 안팎 | 수정 |
| `career-os/docs/code-architecture.md`, `docs/data-schema.md`, `docs/flow.md` | 수정 |
| 공부 추천 스킬 references 2개 | 수정 |
| `career-os/scripts/lib/career-backend-naming.test.ts` | 신규 |
