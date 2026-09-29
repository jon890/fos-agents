# Phase 03. 후보자 맥락 CLI 를 만들고 공부 추천 client 가 관심사를 받게 한다

**Execution profile**: standard

## 목표

사람이 `scripts/candidate-context/manage_candidate_context.ts` 로 후보자 맥락 문서를 조회하고 저장한다.
공부 추천 client 는 후보 응답의 `learningInterests` 를 검증해 후보풀 옆 메타데이터에 담는다.
사람이 기준 버전을 올리던 `configure_study_recommendation.ts` 를 지운다.

**범위 외**: 스킬 문서 갱신은 phase 04 다. 나머지 세 문서 키를 읽는 스킬 전환은 이 계획의 범위가 아니다.

## 컨텍스트

phase 02 뒤 Backend 의 후보 응답은 `learningInterests: { version, body }` 를 담고, `PUT /api/study/v1/recommendation-control` 은 없다.
후보자 맥락 API 계약은 `career-os/docs/flow.md` 의 「후보자 맥락 문서」 절이다.

따를 기존 코드다.

| 따를 것 | 경로 |
| --- | --- |
| 연결값 검증 | `career-os/scripts/lib/career-backend-config.ts` 의 `resolveCareerBackendConnection` |
| HTTP 요청, 재시도, 오류 해석 | `career-os/scripts/lib/career-backend-http.ts` 의 `careerBackendRequest`, `CareerBackendHttpError` |
| client 모양과 멱등 키 | `career-os/scripts/study-topic-recommender/study-library/client.ts` 의 `StudyLibraryClient`, `hashKey("source", ...)` |
| CLI 모양, 도움말, 오류 출력 | `career-os/scripts/study-topic-recommender/manage_reading_sources.ts` 의 `usage`, `formatManageReadingSourcesError` |
| 옵션 읽기 | `career-os/scripts/lib/cli.ts` 의 `firstOptionValue` |

지울 것과 고칠 것이다.

| 자리 | 변경 |
| --- | --- |
| `career-os/scripts/study-topic-recommender/configure_study_recommendation.ts` 와 그 테스트 | 삭제 |
| `study-library/client.ts` 의 `updateRecommendationControl` 과 `studyLibraryRecommendationControlSchema` import | 삭제 |
| `study-library/contracts.ts` 의 `studyLibraryRecommendationControlSchema` | 삭제 |
| `study-library/contracts.ts` 의 `studyLibraryCandidatePageSchema` | `learningInterests: z.object({ version: z.number().int().positive(), body: nonEmptyString })` 추가 |
| `study-library/candidates.ts` 의 `StudyLibraryCandidateMeta`, `fetchStudyLibraryCandidatePool` | 메타에 `learningInterests` 를 담고, 여러 페이지 중 `learningInterests.version` 이 다르면 `historyVersion` 이 다를 때와 같은 `409 VERSION_CONFLICT` 로 중단 |

**근거 문서**: `career-os/docs/code-architecture.md` 의 「후보자 맥락 문서」 절과 「study-topic-recommender」 절, `career-os/docs/data-schema.md` 의 「실행 중 생성되는 읽을거리 데이터」 절, ADR-131

## 의도 메모

- CLI 를 공부 추천 디렉터리에 두지 않는다. 같은 문서를 다른 스킬도 읽게 된다
- `put` 은 본문을 인자로 받지 않고 `--file` 로만 받는다. 셸 이력에 개인 맥락이 남지 않게 하고, 긴 Markdown 을 인자로 넘기는 인용 문제를 피한다
- `get` 은 본문을 stdout 에 쓰고 `--out` 이 있으면 그 파일에 쓴다. 저장소 안 경로를 `--out` 으로 받으면 거절한다. 개인 맥락을 저장소에 두지 않는다
- 멱등 키는 `candidate-context:` 뒤에 `{documentKey, body, note, expectedVersion}` 의 hash 를 붙인다. 같은 명령을 다시 실행하면 저장한 응답을 받는다

## 작업 항목

### 1. `career-os/scripts/candidate-context/contracts.ts` 신규

문서 키 넷 `learning-interests`, `position-preferences`, `application-state`, `career-status` 의 zod enum 과 응답 계약이다.
Backend 의 `services/career-backend/src/candidate-context/schema.ts` 와 이름과 제약을 같게 둔다. 본문 제약은 비어 있지 않고 UTF-8 64 KiB 이하다.

### 2. `career-os/scripts/candidate-context/client.ts` 신규

`CandidateContextClient` 에 `listDocuments()`, `getDocument(key)`, `putDocument(key, { body, note, expectedVersion })` 를 둔다. 기본 경로는 `/api/candidate-context/v1` 이다.
`createCandidateContextClient(options)` 는 `StudyLibraryClient` 생성자처럼 `origin`, `token`, `fetchImpl` 을 받는다.

### 3. `career-os/scripts/candidate-context/manage_candidate_context.ts` 신규

```text
사용법: manage_candidate_context.ts <list | get | put>

로컬 명령:
  help, --help, -h

API 명령:
  list
  get --key <documentKey> [--out <path>]
  put --key <documentKey> --file <markdownPath> --expected-version <n> --note <note>
```

- `get` 이 `404` 를 받으면 `put --expected-version 0` 으로 새 문서를 만들라고 안내하고 종료 코드 1 로 끝난다
- `put` 이 `409` 를 받으면 `get` 으로 다시 조회하고 변경을 검토한 뒤 다시 실행하라고 안내한다
- 오류 출력은 `formatManageReadingSourcesError` 처럼 상태, code, requestId 를 담고 본문은 담지 않는다

### 4. `study-library/` 수정과 `configure_study_recommendation.ts` 삭제

위 「지울 것과 고칠 것」 표대로 한다. `morning_reading_cli.ts` 가 메타에서 읽는 `candidateContextVersion` 은 그대로 쓴다.

### 5. 이 phase 를 검증하는 테스트

- `career-os/scripts/candidate-context/client.test.ts` 신규. 가짜 `fetchImpl` 로 `putDocument` 가 `PUT /api/candidate-context/v1/documents/learning-interests` 에 `Idempotency-Key` 와 본문을 보내는지, 같은 입력이면 같은 키인지 확인한다. `409` 응답이 `CareerBackendHttpError` 로 나오는지 확인한다
- `career-os/scripts/candidate-context/manage_candidate_context.test.ts` 신규. `help` 가 연결값 없이 사용법을 내는지, 없는 키가 요청 전에 거절되는지, `--file` 없는 `put` 과 저장소 안 `--out` 이 거절되는지 확인한다
- `career-os/scripts/study-topic-recommender/study-library/client.test.ts` 수정. `updateRecommendationControl` 경우를 지운다
- `career-os/scripts/study-topic-recommender/study-library/candidates.test.ts` 수정. 메타에 `learningInterests` 가 담기는지, 두 페이지의 `learningInterests.version` 이 다르면 중단하는지 확인한다
- `career-os/scripts/study-topic-recommender/study-library/contracts.ts` 를 import 하는 Backend e2e(`services/career-backend/test/study-candidates.e2e.test.ts`)는 phase 02 뒤 응답에 `learningInterests` 가 있으므로 그대로 통과해야 한다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/candidate-context career-os/scripts/study-topic-recommender
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/candidate-context/client.test.ts career-os/scripts/candidate-context/manage_candidate_context.test.ts career-os/scripts/study-topic-recommender/study-library/client.test.ts career-os/scripts/study-topic-recommender/study-library/candidates.test.ts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -n "updateRecommendationControl\|studyLibraryRecommendationControlSchema" -- career-os/scripts
```

모두 종료 코드 0 이어야 한다.
`skill_doc.test.ts` 는 아직 스킬 문서에 `configure_study_recommendation.ts` 가 있어 통과한다. 문서는 phase 04 가 고친다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/candidate-context/contracts.ts` | 신규 |
| `career-os/scripts/candidate-context/client.ts` | 신규 |
| `career-os/scripts/candidate-context/client.test.ts` | 신규 |
| `career-os/scripts/candidate-context/manage_candidate_context.ts` | 신규 |
| `career-os/scripts/candidate-context/manage_candidate_context.test.ts` | 신규 |
| `career-os/scripts/study-topic-recommender/configure_study_recommendation.ts` | 삭제 |
| `career-os/scripts/study-topic-recommender/configure_study_recommendation.test.ts` | 삭제 |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.test.ts` | 수정 |
