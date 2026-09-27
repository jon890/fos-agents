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

- 오류 타입을 client 밖에서 쓰는 곳은 넷이다. `position-recommender/feedback/exclusions.ts` 가 `CareerBackendClientError.status` 로 원인을 나누고, `study-topic-recommender/manage_reading_sources.ts` 가 `StudyLibraryApiError.status === 409` 를 보고, `study-library/candidates.ts` 가 `new StudyLibraryApiError({ status: 409, code: "VERSION_CONFLICT" })` 를 던지고, `morning_reading_cli.ts` 의 `reportMorningReadingError` 가 `code`, `requestId`, `retryAfter` 를 JSON 으로 출력한다

**근거 문서**: `docs/code-architecture.md` 의 「커리어 Backend」 절

## 의도 메모

- 멱등 키 생성은 옮기지 않는다. 공부 추천 client 의 정규화 JSON 은 key 를 `sort()` 로, 서비스의 `request-hash.ts` 는 `localeCompare` 로 정렬한다. 합치면 이미 저장된 멱등 키와 달라져 재시도가 새 요청으로 처리될 수 있다
- 합친 동작은 이렇게 정한다. redirect 는 모두 거절한다. timeout 은 client 가 지금 값을 넘긴다. 5xx 응답의 깨진 JSON 은 모두 재시도한다. 쓰기 요청은 멱등 키가 있어 재시도해도 한 번만 반영된다. `Accept: application/json` 을 모두 보낸다
- 오류 타입은 `CareerBackendHttpError` 하나로 둔다. client 별 오류 클래스는 지운다. 출력 JSON 의 모양(`reportMorningReadingError`)은 바꾸지 않는다

## Blocked 조건

- `career-os/scripts/lib/career-backend-http.ts` 가 main 에 없으면 `PHASE_BLOCKED: 면접 연습 작업 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/lib/career-backend-http.ts` 수정

- `CareerBackendHttpError` 에 선택 칸 `requestId?: string`, `retryAfter?: number` 를 더한다. 오류 응답 본문의 `error.requestId` 와 `Retry-After` 헤더(초)를 읽어 채운다
- `redirect: "error"` 와 `Accept: application/json` 을 더한다
- 공용 계층의 테스트(면접 연습 작업이 만든 것)가 그대로 통과해야 한다

### 2. `career-os/scripts/position-recommender/career-backend/client.ts` 수정

`request` 를 지우고 각 메서드가 `careerBackendRequest` 를 부른다. timeout 기본값 15초를 넘긴다. `CareerBackendClientError` 를 지우고 `CareerBackendHttpError` 를 다시 export 하지 않는다. 쓰는 곳이 직접 import 한다.

### 3. `career-os/scripts/study-topic-recommender/study-library/client.ts` 수정

요청과 오류 해석 코드를 지우고 `careerBackendRequest` 를 부른다. timeout 10초를 넘긴다. `StudyLibraryClientError` 와 그 하위 오류 클래스를 모두 지우고, `ingestion.ts` 의 출처별 실패 판정은 `CareerBackendHttpError` 로 바꾼다. 멱등 키를 만드는 `canonicalJson`, `hashKey` 는 그대로 둔다.
생성자의 origin, token 직접 지정 분기가 32자 token 검사를 다시 구현하고 있으면 `resolveCareerBackendConnection` 을 쓰도록 바꾼다.

### 4. 오류 타입을 쓰는 네 곳 수정

`exclusions.ts`, `manage_reading_sources.ts`, `candidates.ts`, `morning_reading_cli.ts` 가 `CareerBackendHttpError` 를 쓰게 바꾼다. `reportMorningReadingError` 의 출력 JSON 은 `{ error: { code, requestId, retryAfter? } }` 그대로다.

### 5. 이 phase 를 검증하는 테스트

- 두 client 의 기존 테스트를 새 오류 타입으로 옮긴다. 경로와 헤더, 재시도 횟수 단언은 그대로 통과해야 한다
- `career-backend-http` 테스트에 오류 응답의 `requestId` 와 `Retry-After` 를 읽는 경우와 redirect 응답을 거절하는 경우를 더한다

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
| `career-os/scripts/position-recommender/career-backend/client.ts`, `client.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/client.ts` 와 그 테스트 | 수정 |
| `career-os/scripts/position-recommender/feedback/exclusions.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/manage_reading_sources.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/candidates.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
