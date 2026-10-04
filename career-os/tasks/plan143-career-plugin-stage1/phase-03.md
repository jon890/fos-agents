# Phase 03. 공부 추천 MCP 도구 둘을 연다

**Execution profile**: standard

## 목표

fos-career 커넥터에 `get_study_candidates` 와 `save_study_recommendation` 을 더한다.
fos-assistant 대화에서 이미 수집된 후보로 공부 주제를 고르고 추천 이력을 저장하게 하려는 것이다.

**범위 외**: 외부 피드 수집, HTML 리포트, 외부 게시 기록(`POST /api/study/v1/publications`), 소스 관리는 커넥터가 하지 않는다. 2단계의 로컬 실행기 몫이다. plugin 스킬 문서는 Phase 04 다.

## 컨텍스트

Phase 02 가 `career-os/plugin/src/interview.ts`, `seoul-date.ts` 를 만들고 `CareerBackend.request` 가 `POST` 를 받게 했다. 같은 모양으로 `career-os/plugin/src/study.ts` 를 만든다.
plugin 은 자기 `zod` 를 쓰고 `services/` 와 `scripts/lib/` 를 번들하지 않는다(`career-os/docs/code-architecture.md` 의 「fos-career 커넥터」 절).

Backend 계약이다(`career-os/services/career-backend/src/study/schema.ts`, `study.controller.ts`).

| 경로 | 요청 | 응답 |
| --- | --- | --- |
| `GET /api/study/v1/candidates` | query `limit`(1 이상 100 이하), 선택 `category`, `sourceKey`, `publishedFrom`, `publishedTo`, `cursor` | `{ candidates, recentStudyTopicKeys, nextCursor, historyVersion, candidateContextVersion, learningInterests: { version, body } }` |
| `POST /api/study/v1/recommendation-runs` | `studyRecommendationRunSchema`: `reportId`(40자 이하), `generatedAt`(ISO), `candidateContextVersion`, `topics`(20개 이하), `rejections`. `Idempotency-Key` 필수 | `{ reportId, historyVersion }` |

후보 한 줄의 칸은 `scripts/study-topic-recommender/study-library/contracts.ts` 의 `studyLibraryCandidateSchema` 와 같다(`id`, `contentKey`, `canonicalUrl`, `sourceKey`, `sourceName`, `category`, `title`, `url`, `published`, `excerpt?`, `kind`, `previouslyRecommended`).
추천 항목은 `{ contentKey, summary, reason, careerValue }` 이고 `summary`, `reason` 은 300자 이하, `careerValue` 는 `current-work`, `target-role`, `engineering-judgment`, `product-business` 또는 `null` 이다.
`topicKey` 는 191자 이하, `title` 500자 이하, `careerQuestion` 300자 이하 또는 `null`, 주제 하나의 `items` 는 1개 이상이다.

CLI 의 키 계산은 `scripts/study-topic-recommender/study-library/client.ts` 의 `createRecommendationRun` 이다. `hashKey("recommendation", { reportId, generatedAt })` 로 `recommendation:<sha256(canonical JSON)>` 을 만든다. plugin 의 `src/idempotency.ts` 의 `idempotencyKey(prefix, value)` 가 같은 계산이다.
CLI 의 `reportId` 는 `study-library/recommendations.ts` 의 `reportIdForMorningReading` 이고 `morning-<generatedAt 의 Asia/Seoul 날짜>` 다.

**근거 문서**: `career-os/docs/data-schema.md` 의 「fos-career 커넥터」 절의 공부 추천 도구 계약 목록과 「커넥터 오류 코드」 표,
`career-os/docs/flow.md` 의 「대화에서 공부 추천」 절과 「커넥터에서 갈라지는 곳」 표,
`career-os/docs/adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md`

## 의도 메모

- `limit` 상한을 30 으로 둔 이유: fos-assistant 는 승인이 필요한 호출의 인자를 UTF-8 16KB 까지만 받는다. 후보마다 `contentKey`(약 68자)와 제외 이유를 단 저장 인자가 그 안에 들어야 한다. cursor 로 다음 쪽을 읽는 인자는 만들지 않는다
- `excerpt` 를 500자에서 자르는 이유: 외부 글을 결과에 길게 싣지 않는다. fos-assistant 커넥터 작성 규칙이다
- 409 를 `CAREER_VERSION_CONFLICT` 로 두지 않고 `CAREER_STUDY_CONFLICT` 로 바꾸는 이유: 기존 코드의 고정 문구가 「문서가 바뀌었다」 여서 같은 날 리포트 중복이나 관심사 변경을 설명하지 못한다
- 추천을 저장하기 전에 `previouslyRecommended` 나 중복을 커넥터가 다시 검사하지 않는다. Backend 가 판정한다

## 작업 항목

### 1. `career-os/plugin/src/backend.ts` 수정

- `messages` 에 `CAREER_STUDY_CONFLICT: "같은 날 추천이 이미 저장됐거나 그 사이 관심사 문서나 추천 이력이 바뀌었습니다. 후보를 다시 읽어 확인해 주세요."` 를 더한다

### 2. `career-os/plugin/src/study.ts` 신규

- 입력 스키마(`z.strictObject`)
  - `getStudyCandidatesSchema`: `limit` 은 1 이상 30 이하 정수이고 선택, `category` 선택 enum `techBlog | geek | ai | video`
  - `saveStudyRecommendationSchema`: `candidateContextVersion`(공백 아닌 191자 이하), `generatedAt` 선택(UTC ISO, `new Date(v).toISOString() === v`), `topics` 는 20개 이하, `rejections` 는 2000개 이하. 칸 제약은 위 Backend 계약과 같다
- 응답 스키마: 후보 페이지와 `{ reportId, historyVersion }`
- `getStudyCandidates(backend, args)`: `GET /api/study/v1/candidates?limit=<limit ?? 30>[&category=]` 한 번. 결과는 `{ candidateContextVersion, historyVersion, learningInterests, recentStudyTopicKeys, nextCursor, candidates: [{ contentKey, title, url, sourceName, category, kind, published, excerpt }] }`. `excerpt` 는 500자에서 자르고 없으면 칸을 뺀다
- `saveStudyRecommendation(backend, args, now)`: `generatedAt = args.generatedAt ?? now().toISOString()`, `reportId = "morning-" + seoulDate(new Date(generatedAt))`. 키는 `idempotencyKey("recommendation", { reportId, generatedAt })`. 본문은 `{ reportId, generatedAt, candidateContextVersion, topics, rejections }`
  - `CAREER_VERSION_CONFLICT` 를 잡으면 `CAREER_STUDY_CONFLICT` 로 바꿔 던진다
  - `CAREER_NETWORK` 를 잡으면 `new CareerError("CAREER_NETWORK", { reportId, generatedAt })` 로 다시 던진다
  - 결과는 `{ reportId, generatedAt, historyVersion }`

### 3. `career-os/plugin/src/tools.ts` 수정

- `toolDefinitions` 에 두 도구를 더하고 `switch` 에서 `study.ts` 로 넘긴다

### 4. `career-os/plugin/connector.json` 수정

- `tools` 에 `get_study_candidates`(`READ`, `none`, `공부 후보 읽기`), `save_study_recommendation`(`WRITE`, `required`, `공부 추천 저장`)을 더한다
- `errors` 에 `"CAREER_STUDY_CONFLICT": "invalid_input"` 을 더한다

### 5. `career-os/docs/data-schema.md` 수정

- 「커넥터 오류 코드」 표의 `CAREER_VERSION_CONFLICT` 줄 아래에 `| \`CAREER_STUDY_CONFLICT\` | 공부 추천 저장에 Backend 가 409 로 답함. 같은 날 리포트, 이미 저장한 자료나 주제, 바뀐 관심사 문서 | \`invalid_input\` |` 를 더한다. `connector-config.test.ts` 가 이 표와 `connector.json` 의 `errors` 를 대조한다

### 6. 테스트

- `career-os/plugin/src/study.test.ts` 신규. fetch 대역으로 확인한다
  - `get_study_candidates`: 기본 `limit=30` 이 query 에 실리고, 2,000자 `excerpt` 가 500자로 잘리며, 결과에 `id`, `canonicalUrl`, `sourceKey`, `previouslyRecommended` 가 없다. `limit: 31` 은 fetch 없이 `CAREER_INVALID_INPUT`
  - `save_study_recommendation`: `now` 를 `2026-10-03T16:00:00.000Z` 로 고정하면 `reportId` 가 `morning-2026-10-04` 다. 본문이 입력과 같고 키가 `recommendation:` 으로 시작한다
  - 409 응답이면 `CAREER_STUDY_CONFLICT`, fetch 가 던지면 `{ error: { code: "CAREER_NETWORK" }, reportId, generatedAt }`
  - 대역이 받은 메서드와 경로의 쌍이 두 경로 밖으로 나가지 않는다
- `career-os/plugin/src/contract-parity.test.ts` 수정
  - 같은 리포트로 `createStudyLibraryClient({ origin, token, fetchImpl }).createRecommendationRun(payload)` 와 `save_study_recommendation` 이 보낸 URL, 본문, `Idempotency-Key` 가 같다
  - plugin 의 저장 입력 스키마와 Backend `studyRecommendationRunSchema` 가 같은 지어낸 페이로드를 둘 다 받아들이고, 주제 21개를 둘 다 거절한다
- `career-os/plugin/src/server.test.ts` 수정: 도구 수 단언을 16 으로, 테스트 이름을 「열여섯 개」 로
- `career-os/plugin/scripts/connector-config.test.ts` 수정: 개수를 16 으로, `WRITE` 목록에 `save_study_recommendation` 을 더한다

### 7. `career-os/plugin/dist/career-mcp.js` 재생성

## 검증

```bash
# cwd: 저장소 루트
bun install --frozen-lockfile
bun install --frozen-lockfile --cwd career-os/plugin
bun run --cwd career-os/plugin build
bun test ./career-os/plugin/src/study.test.ts ./career-os/plugin/src/contract-parity.test.ts ./career-os/plugin/src/server.test.ts ./career-os/plugin/scripts/connector-config.test.ts
bun test ./career-os/plugin ./career-os/scripts/study-topic-recommender
bun run --cwd career-os/plugin typecheck
claude plugin validate career-os/plugin
```

기대값: 모두 종료 코드 0.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/plugin/src/backend.ts` | 수정 |
| `career-os/plugin/src/study.ts` | 신규 |
| `career-os/plugin/src/study.test.ts` | 신규 |
| `career-os/plugin/src/tools.ts` | 수정 |
| `career-os/plugin/src/contract-parity.test.ts` | 수정 |
| `career-os/plugin/src/server.test.ts` | 수정 |
| `career-os/plugin/scripts/connector-config.test.ts` | 수정 |
| `career-os/plugin/connector.json` | 수정 |
| `career-os/docs/data-schema.md` | 수정 |
| `career-os/plugin/dist/career-mcp.js` | 수정 |
