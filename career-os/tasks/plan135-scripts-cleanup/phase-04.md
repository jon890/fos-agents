# Phase 04. 포지션과 공부 추천 client 를 공용 HTTP 계층으로 옮긴다

**Execution profile**: standard

## 목표

포지션 client 와 공부 추천 client 가 각자 가진 HTTP 요청 코드를 `career-os/scripts/lib/career-backend-http.ts` 의 `careerBackendRequest` 로 옮긴다.
인증 헤더, 재시도, timeout, 오류 응답 해석이 한 곳에 있게 한다.

**범위 외**: 각 client 의 경로와 응답 계약, 멱등 키를 만드는 방법은 바꾸지 않는다. 면접 연습 client 는 이미 공용 계층을 쓴다.

## 컨텍스트

- `career-os/scripts/lib/career-backend-http.ts` 는 면접 연습 작업이 만들었다. `careerBackendRequest(options, method, path, body, idempotencyKey, schema)` 와 `CareerBackendHttpError(status, code, message)` 가 있다
- 포지션 client `career-os/scripts/position-recommender/career-backend/client.ts` 의 `CareerBackendClient.request` 와 `CareerBackendClientError` 가 같은 일을 한다. 이 코드를 옮겨 적은 것이 공용 계층이다
- 공부 추천 client `career-os/scripts/study-topic-recommender/study-library/client.ts` 는 다르게 구현돼 있다

| 항목 | 포지션 client | 공부 추천 client |
| --- | --- | --- |
| timeout | 15초 | 10초 |
| redirect | 기본값 | `redirect: "error"` |
| 5xx 응답의 깨진 JSON | 재시도 | 재시도하지 않음 |
| 오류 타입 | `CareerBackendClientError` | 공통 부모 `StudyLibraryClientError` 아래 `StudyLibraryApiError`, `StudyLibraryNetworkError` 와 응답 오류 3종. `requestId`, `retryAfter` 를 담는다. `study-library/ingestion.ts` 가 공통 부모로 출처별 실패를 가른다 |
| `Accept` 헤더 | 없음 | `application/json` |

- 오류 타입을 client 밖에서 쓰는 곳은 다섯 곳이다. `position-recommender/feedback/exclusions.ts` 가 `CareerBackendClientError.status` 로 원인을 나누고, `study-topic-recommender/manage_reading_sources.ts` 가 `StudyLibraryApiError.status === 409` 를 보고, `study-library/candidates.ts` 가 `new StudyLibraryApiError({ status: 409, code: "VERSION_CONFLICT" })` 를 던진다. `study-library/ingestion.ts` 는 `StudyLibraryClientError` 로 출처별 실패를 구분하고, `morning_reading_cli.ts` 의 `reportMorningReadingError` 는 `code`, `requestId`, `retryAfter` 를 JSON 으로 출력한다
- 공용 계층에는 아직 `career-backend-http.test.ts` 가 없다. 공부 추천 client 는 `maxRetries` 를 0 또는 1로 지정할 수 있고, `StudyLibraryFetch` 는 `(URL, RequestInit)` 시그니처를 쓴다. 기존 테스트는 5xx 재시도 전 응답 본문 취소와 오류 메시지에 token, 요청 본문, 서버 message 를 싣지 않는 것도 검사한다

**근거 문서**: `docs/code-architecture.md` 의 「커리어 Backend」 절

## 의도 메모

- 멱등 키 생성은 옮기지 않는다. 공부 추천 client 의 정규화 JSON 은 key 를 `sort()` 로, 서비스의 `request-hash.ts` 는 `localeCompare` 로 정렬한다. 합치면 이미 저장된 멱등 키와 달라져 재시도가 새 요청으로 처리될 수 있다
- 합친 동작은 이렇게 정한다. redirect 는 모두 거절한다. timeout 은 client 가 지금 값을 넘긴다. 5xx 응답의 깨진 JSON 은 모두 재시도한다. 쓰기 요청은 멱등 키가 있어 재시도해도 한 번만 반영된다. `Accept: application/json` 을 모두 보낸다
- 오류 타입은 `CareerBackendHttpError` 하나로 둔다. client 별 오류 클래스는 지운다. 출력 JSON 의 모양(`reportMorningReadingError`)은 바꾸지 않는다
- 기본 재시도 횟수는 기존 공용 계층처럼 2회다. 공부 추천 client 가 지정한 `maxRetries` 는 공용 옵션으로 넘겨 0회와 1회도 유지한다
- 공용 `fetcher` 시그니처를 `(input: URL, init: RequestInit) => Promise<Response>` 로 좁힌다. 공용 계층은 지금처럼 URL 과 RequestInit 을 넘기며, 포지션과 면접 연습의 기존 fetcher 도 이 타입을 받을 수 있다
- 5xx 를 다시 요청하기 전에는 응답 본문을 취소한다. 오류 메시지에는 token, 요청 본문, 서버의 message 를 담지 않고 고정 문구를 쓴다. 응답의 `code`, `requestId` 와 429 의 유효한 정수 `Retry-After` 초는 오류 객체에 남긴다

## Blocked 조건

- `career-os/scripts/lib/career-backend-http.ts` 가 main 에 없으면 `PHASE_BLOCKED: 면접 연습 작업 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/lib/career-backend-http.ts` 수정

- `CareerBackendHttpError` 에 선택 칸 `requestId?: string`, `retryAfter?: number` 를 더한다. 오류 응답 본문의 `error.requestId` 와 429 응답의 `Retry-After` 헤더(초)를 읽어 채운다
- `CareerBackendHttpOptions` 에 `maxRetries?: number` 를 더하고, `fetcher` 입력을 URL 과 필수 RequestInit 으로 맞춘다. 기본은 2회 재시도다
- `redirect: "error"` 와 `Accept: application/json` 을 더한다. 재시도할 5xx 응답 본문은 먼저 취소하고, 오류 메시지에는 서버 본문을 넣지 않는다
- 아직 없는 `career-os/scripts/lib/career-backend-http.test.ts` 를 새로 만든다

### 2. `career-os/scripts/position-recommender/career-backend/client.ts` 수정

`request` 를 지우고 각 메서드가 `careerBackendRequest` 를 부른다. timeout 기본값 15초를 넘긴다. `CareerBackendClientError` 를 지우고 `CareerBackendHttpError` 를 다시 export 하지 않는다. 쓰는 곳이 직접 import 한다.

### 3. `career-os/scripts/study-topic-recommender/study-library/client.ts` 수정

요청과 오류 해석 코드를 지우고 `careerBackendRequest` 를 부른다. timeout 10초와 지정한 `maxRetries` 를 넘긴다. `StudyLibraryClientError` 와 그 하위 오류 클래스를 모두 지우고, `ingestion.ts` 의 출처별 실패 판정은 `CareerBackendHttpError` 로 바꾼다. `study-library/contracts.ts` 의 사용하지 않는 `studyLibraryApiErrorSchema` 와 동명 타입도 지운다. 멱등 키를 만드는 `canonicalJson`, `hashKey` 는 그대로 둔다.
생성자의 origin, token 직접 지정 분기가 32자 token 검사를 다시 구현하고 있으면 `resolveCareerBackendConnection` 을 쓰도록 바꾼다.

### 4. 오류 타입을 쓰는 다섯 곳 수정

`exclusions.ts`, `manage_reading_sources.ts`, `candidates.ts`, `ingestion.ts`, `morning_reading_cli.ts` 가 `CareerBackendHttpError` 를 쓰게 바꾼다. `reportMorningReadingError` 의 출력 JSON 은 `{ error: { code, requestId, retryAfter? } }` 그대로다.

### 5. 이 phase 를 검증하는 테스트

- 두 client 의 기존 테스트와 `exclusions.test.ts`, `candidates.test.ts`, `ingestion.test.ts` 의 옛 오류 fixture 를 새 오류 타입으로 옮긴다. 경로와 헤더, 재시도 횟수, 본문 읽기 timeout 단언은 그대로 통과해야 한다
- 새 `career-backend-http.test.ts` 에 5xx 재시도 전 본문 취소, token·요청 본문·서버 message 비노출, 오류 응답의 `requestId`, 429 의 유효한 정수 `Retry-After` 와 잘못된 값 무시, redirect 거절을 검증한다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "CareerBackendClientError|StudyLibraryClientError|StudyLibraryApiError|StudyLibraryNetworkError|StudyLibraryBodyReadError|StudyLibraryMalformedJsonError|StudyLibraryResponseValidationError" -- career-os/scripts
```

모두 종료 코드 0 이어야 한다.

검증이 통과하면 `career-os/tasks/plan135-scripts-cleanup/index.json` 의 `current_phase` 를 4 로 두고, 마지막 phase 이므로 `status` 를 `completed` 로 바꾼다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-backend-http.ts` | 수정 |
| `career-os/scripts/lib/career-backend-http.test.ts` | 신규 |
| `career-os/scripts/position-recommender/career-backend/client.ts`, `client.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` 와 그 테스트 | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/ingestion.ts` 와 그 테스트 | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.test.ts` | 수정 |
| `career-os/scripts/position-recommender/feedback/exclusions.ts` | 수정 |
| `career-os/scripts/position-recommender/feedback/exclusions.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/manage_reading_sources.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
