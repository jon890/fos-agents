# Phase 01. 새 환경값을 읽고 옛 환경값도 받는다

**Execution profile**: standard

## 목표

client 와 서버가 `CAREER_BACKEND_*` 환경값을 먼저 읽고, 없으면 옛 `CAREER_RECOMMENDATION_*` 를 읽게 한다.
홈서버가 환경값을 바꾸는 시점과 fos-agents 코드가 바뀌는 시점이 달라도 연결이 끊기지 않게 하려는 것이다.

**범위 외**: 디렉터리, 모듈, 타입 이름 변경은 phase 02, 옛 이름 제거는 phase 03 이 한다.
홈서버의 hermes 환경값과 container 이름은 fos-home-infra 가 바꾼다.

## 컨텍스트

환경값을 읽는 곳은 두 곳뿐이다.

- client: `career-os/scripts/lib/recommendation-api-config.ts` 의 `resolveRecommendationApiConnection`
  - 포지션 client `career-os/scripts/position-recommender/recommendation-api/client.ts` 와
    공부 client `career-os/scripts/study-topic-recommender/study-library/client.ts` 가 이 함수를 쓴다
- 서버: `career-os/services/recommendation-api/src/config/config.ts` 의 `environmentSchema` 와 `loadConfig`

이름 대응이다.

| 옛 이름 | 새 이름 | 읽는 쪽 |
| --- | --- | --- |
| `CAREER_RECOMMENDATION_API_URL` | `CAREER_BACKEND_URL` | client |
| `CAREER_RECOMMENDATION_API_TOKEN` | `CAREER_BACKEND_TOKEN` | client, 서버 |
| `CAREER_RECOMMENDATION_API_TOKEN_FILE` | `CAREER_BACKEND_TOKEN_FILE` | client, 서버 |
| `CAREER_RECOMMENDATION_DATABASE_URL` | `CAREER_BACKEND_DATABASE_URL` | 서버 |
| `CAREER_RECOMMENDATION_MAX_BODY_BYTES` | `CAREER_BACKEND_MAX_BODY_BYTES` | 서버 |
| `CAREER_RECOMMENDATION_TEST_DATABASE_URL` | `CAREER_BACKEND_TEST_DATABASE_URL` | 서버 테스트만 |

`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD`, `API_HOST`, `API_PORT` 는 이름을 바꾸지 않는다.

**근거 문서**: `docs/adr/ADR-128-커리어-backend로-이름을-넓힌다.md`, `docs/code-architecture.md` 의 「추천 상태 Backend」 절

## 의도 메모

- **환경값마다 따로 대체한다.** 이름마다 `새 값 ?? 옛 값` 으로 읽는다. 빈 문자열은 지금처럼 없는 값으로 본다.
  묶음 단위로 고르는 안은 기각했다. 규칙이 하나 더 생기고, 운영에서 셋을 동시에 바꾸므로 얻는 것이 없다.
- 대체한 뒤의 검사는 지금과 같다. token 과 token 파일 중 정확히 하나, database URL 과 `DB_*` 중 정확히 하나다.
  그래서 새 `CAREER_BACKEND_TOKEN` 과 옛 `CAREER_RECOMMENDATION_API_TOKEN_FILE` 이 함께 있으면 둘 다 있다는 오류가 난다. 의도한 동작이다.
- **오류 문구는 새 이름으로 쓴다.** 예: `CAREER_BACKEND_URL 환경값이 필요하다.`
  옛 이름을 오류에 함께 적지 않는다. 전환 기간이 끝나면 옛 이름은 사라진다.
- 옛 이름을 읽었다고 경고를 출력하지 않는다. CLI 계약 테스트가 stderr 를 비교하고, phase 03 에서 어차피 뺀다.
- 서버 테스트의 `CAREER_RECOMMENDATION_TEST_DATABASE_URL` 은 운영 값이 아니므로 대체 없이 새 이름으로만 바꾼다.
- **문서는 코드와 같은 phase 에서 고친다.** 결정은 ADR-128 이 이 계획보다 먼저 커밋됐다. 환경값 이름과 경로를 적은 문서는 코드가 바뀌기 전에 고치면 없는 이름을 가리키므로, 코드 변경과 같은 phase 의 별도 커밋으로 둔다.
- **`services/recommendation-api/test/fixtures/legacy-contract/` 는 고치지 않는다.** 옛 서버를 실행해 계약을 찍어 둔 기록이라 그 서버가 읽던 옛 이름이 맞다.

## 작업 항목

### 1. `career-os/scripts/lib/recommendation-api-config.ts`

`resolveRecommendationApiConnection` 이 URL, token, token 파일을 각각 새 이름 먼저, 없으면 옛 이름으로 읽는다.
`parseRecommendationApiOrigin` 의 오류 문구와 이 파일의 다른 오류 문구에서 환경값 이름을 새 이름으로 바꾼다.
문구의 「추천 API」 는 「커리어 Backend」 로 바꾼다.

### 2. `career-os/services/recommendation-api/src/config/config.ts`

`environmentSchema` 에 새 이름 셋(`CAREER_BACKEND_DATABASE_URL`, `CAREER_BACKEND_TOKEN`, `CAREER_BACKEND_TOKEN_FILE`, `CAREER_BACKEND_MAX_BODY_BYTES`)을 더하고 옛 이름도 둔다.
`loadConfig` 는 검사 전에 이름마다 새 값 ?? 옛 값으로 합친다. `MAX_BODY_BYTES` 기본값 `2 * 1_024 * 1_024` 와 범위 검사는 합친 값에 한 번 적용한다.
오류 문구의 「추천 API」 는 「커리어 Backend」 로 바꾼다.

### 3. 서버 테스트의 테스트 DB 환경값

`CAREER_RECOMMENDATION_TEST_DATABASE_URL` 을 `CAREER_BACKEND_TEST_DATABASE_URL` 로 바꾼다. 대상은 셋이다.

- `career-os/services/recommendation-api/test/` 아래 파일 (`test/fixtures/legacy-contract/` 는 제외)
- `career-os/services/recommendation-api/prisma/baseline.test.ts` (54행과 101행 부근, 오류 문구 포함)
- `career-os/services/recommendation-api/README.md`

### 4. `career-os/.env.example`

client 묶음과 서버 묶음을 모두 바꾼다.

- `# 포지션 추천 client` 주석을 `# 커리어 Backend client. 포지션 추천, 공부 추천, 회사 근거가 함께 쓴다` 로 바꾼다
- 그 아래 변수 셋을 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN`, `CAREER_BACKEND_TOKEN_FILE` 로 바꾼다
- `# recommendation-api Backend: 개발은 URL, 운영은 DB_* 묶음 중 하나만 사용한다.` 주석을 `# 커리어 Backend 서버: 개발은 URL, 운영은 DB_* 묶음 중 하나만 사용한다.` 로 바꾼다
- 그 아래 `CAREER_RECOMMENDATION_DATABASE_URL` 과 `CAREER_RECOMMENDATION_MAX_BODY_BYTES` 를 `CAREER_BACKEND_DATABASE_URL`, `CAREER_BACKEND_MAX_BODY_BYTES` 로 바꾼다

### 5. 문서의 환경값 이름

`docs/code-architecture.md` 에서 환경값을 적은 곳(「추천 상태 Backend」 절의 client·Backend 환경값 문단, 공부 추천 client 환경값 표)을 새 이름으로 바꾸고,
「전환 기간에는 옛 `CAREER_RECOMMENDATION_*` 이름도 읽는다」 한 줄을 그 절에 둔다.
`services/recommendation-api/README.md` 의 환경값 표와 예시 명령도 새 이름으로 바꾼다.
스킬 문서 두 곳도 바꾼다.

- `career-os/.claude/skills/position-recommender/SKILL.md` 37행의 `CAREER_RECOMMENDATION_API_URL` → `CAREER_BACKEND_URL`
- `career-os/.claude/skills/study-topic-recommender/references/execution.md` 19행의 `CAREER_RECOMMENDATION_API_URL` → `CAREER_BACKEND_URL`

### 6. 테스트

- `career-os/scripts/position-recommender/recommendation-api/client.test.ts` 또는 연결 설정을 검사하는 기존 테스트에
  - 새 이름만 있을 때 연결된다
  - 옛 이름만 있을 때 연결된다
  - 둘 다 있으면 새 이름 값을 쓴다
  - 새 `TOKEN` 과 옛 `TOKEN_FILE` 이 함께 있으면 정확히 하나 오류가 난다
- `career-os/services/recommendation-api/src/config/config.test.ts` 에 같은 네 경우와 `MAX_BODY_BYTES` 대체를 넣는다
- 기존 테스트가 옛 이름으로 환경을 만드는 곳은 새 이름으로 바꾼다. 옛 이름 경로는 위에서 따로 검사한다

## 검증

저장소 루트에서 실행한다.

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
```

서버는 `career-os/services/recommendation-api` 에서 테스트 MySQL 을 준비해 실행한다. 준비 방법은 그 README 가 소유한다.

```bash
# cwd: career-os/services/recommendation-api
npm run typecheck && npm run build
CAREER_BACKEND_TEST_DATABASE_URL=<테스트 DB> SHADOW_DATABASE_URL=<빈 shadow DB> npm test
```

기대값: 모두 실패 0. 아래 명령이 종료 코드 0 이다. 허용 목록 밖의 파일이 있거나 목록의 파일이 빠지면 `diff` 가 1 로 끝난다.

```bash
# cwd: 저장소 루트
diff <(git grep -l "CAREER_RECOMMENDATION_" -- career-os ':!career-os/docs/adr' ':!career-os/tasks' | sort) <(sort <<'LIST'
career-os/docs/code-architecture.md
career-os/scripts/lib/recommendation-api-config.ts
career-os/scripts/position-recommender/recommendation-api/client.test.ts
career-os/services/recommendation-api/src/config/config.test.ts
career-os/services/recommendation-api/src/config/config.ts
career-os/services/recommendation-api/test/fixtures/legacy-contract/README.md
career-os/services/recommendation-api/test/fixtures/legacy-contract/capture-legacy.bun.ts
LIST
)
```

`config.ts` 와 `recommendation-api-config.ts` 는 옛 이름 읽기, 두 테스트는 옛 이름 경로 검사, `code-architecture.md` 는 전환 기간 한 줄, legacy-contract 두 파일은 과거 계약 기록이다.

## 마무리

검증이 통과하면 `career-os/tasks/plan132-career-backend-rename/index.json` 의 이 phase 를 완료로 표시하고 `current_phase` 를 다음 번호로 올린다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/recommendation-api-config.ts` | 수정 |
| `career-os/services/recommendation-api/src/config/config.ts` | 수정 |
| `career-os/services/recommendation-api/src/config/config.test.ts` | 수정 |
| `career-os/scripts/position-recommender/recommendation-api/client.test.ts` | 수정 |
| `career-os/services/recommendation-api/test/` (legacy-contract 제외) | 수정 |
| `career-os/services/recommendation-api/prisma/baseline.test.ts` | 수정 |
| `career-os/services/recommendation-api/README.md` | 수정 |
| `career-os/.env.example` | 수정 |
| `career-os/docs/code-architecture.md` | 수정 |
