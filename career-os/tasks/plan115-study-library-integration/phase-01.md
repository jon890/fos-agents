# Phase 01. 학습자료 API 클라이언트와 계약을 만든다

**Execution profile**: standard

## 목표

career-os가 fos-blog 학습자료 API를 서비스 인증으로 호출하고, 응답을 기존 읽을거리 타입으로 검증할 수 있게 한다.

**범위 외**: fos-blog 서버 구현, MySQL 접근, 관리자 UI, 수집 알고리즘 변경, 추천 모델 프롬프트 변경.

## 컨텍스트

기준은 저장소 루트의 AGENTS.md와 career-os/AGENTS.md다.
HTTP endpoint와 저장 제약의 단일 출처는 [fos-blog 학습자료 HTTP 계약](https://github.com/jon890/fos-blog/blob/study-library-planning/docs/api/study-library.md)이다.
구현자는 worker handoff에서 fos-blog 저장소의 `study-library-planning` branch checkout 상태와 문서가 포함된 commit을 확인한 뒤 이 phase를 시작한다.
career-os 문서에는 API 전체 계약을 복제하지 않고 소비 매핑만 둔다.

기존 코드에서 재사용할 타입과 검증은 `career-os/scripts/study-topic-recommender/reading_contracts.ts`, URL 식별은 `career-os/scripts/study-topic-recommender/url_identity.ts`, 소스 설정은 `career-os/config/external-reading-sources.ts`다.
연동모드는 `STUDY_LIBRARY_URL`과 `STUDY_SERVICE_TOKEN`을 사용하고 브라우저 세션을 복제하지 않는다.

**근거 문서**: repo root 기준 `career-os/docs/code-architecture.md`, `career-os/docs/data-schema.md`. career-os cwd 검증 기준 `docs/code-architecture.md`, `docs/data-schema.md`

## 의도 메모

DB 드라이버를 넣으면 저장 경계가 두 저장소로 갈라진다.
career-os는 fetch와 Zod로 HTTP 응답을 검증하고, 서버가 소유하는 트랜잭션과 권한 판단을 우회하지 않는다.
API 오류는 빈 결과로 바꾸지 않는다.

## 작업 항목

### 1. career-os/scripts/study-topic-recommender/study-library/contracts.ts 소비 DTO를 정의한다

fos-blog API 응답 중 career-os가 읽는 객체만 Zod로 검증한다.
서버 계약 문서를 복제하지 말고 아래 매핑에 필요한 필드와 오류 객체를 검증한다.

- `Source`: `sourceKey,title,category,url,feedUrl,adapter,enabled,version`
- `CursorResult`: `sourceKey,mode,cursor,version`
- `IngestionResult`: `idempotencyKey,acceptedCount,cursorVersion`
- `CandidatePage`: `candidates,recentStudyTopicKeys,nextCursor,historyVersion`
- `RecommendationRunResult`: `reportId,historyVersion`
- `PublicationResult`: `publicationId`
- `StudyApiError`: `{error:{code,message,requestId}}`

`Candidate.id`는 `contentKey`로 온다.
기존 후보풀의 `candidateId`로도 같은 값을 사용해야 한다.
`excerpt`는 없을 수 있으므로 기존 optional string과 맞춘다.

### 2. career-os/scripts/study-topic-recommender/study-library/client.ts fetch 클라이언트를 만든다

`STUDY_LIBRARY_URL`은 HTTPS origin만 허용한다.
scheme이 HTTPS가 아니거나 credentials, query, hash가 있거나 path가 `/`가 아니면 실패한다.
`STUDY_SERVICE_TOKEN`이 없으면 시작 전에 실패한다.
모든 요청은 `Authorization: Bearer <token>`과 `Accept: application/json`을 보낸다.
쓰기 요청은 `Content-Type: application/json`을 보낸다.
fetch 옵션은 `redirect: "error"`와 timeout 10초를 적용한다.
네트워크 오류와 5xx 응답은 같은 본문과 같은 멱등 키로 최대 2회 재시도한다.
4xx 응답은 재시도하지 않는다.

성공 응답은 지정한 Zod schema로 검증한다.
실패 응답은 HTTP 상태, `error.code`, `error.requestId`를 보존한 `StudyLibraryApiError`로 변환한다.
로그와 예외 메시지에 토큰, 요청 본문, 원문 HTML, 개인 메모를 넣지 않는다.
`401`, `403`, `409`, `413`, `429`, `503`은 코드가 남아야 한다.

### 3. career-os/scripts/study-topic-recommender/study-library/source-sync.ts 소스 설정을 API 요청으로 변환한다

`externalReadingSources`를 읽고 `GET /sources` 결과의 version과 대조해 sourceKey별 `PUT /sources/{sourceKey}` 요청을 만든다.
새 소스는 `expectedVersion: 0`, 기존 소스는 서버 version을 사용한다.
`url` 또는 `feedUrl`이 없는 필드는 명시적인 `null`로 보낸다.
`enabled=false`인 소스도 삭제하지 않고 등록 상태를 유지한다.
알 수 없는 category, adapter, 중복 key는 기존 설정 검증 실패로 처리한다.

### 4. career-os/scripts/study-topic-recommender/study-library/client.test.ts 클라이언트 계약 테스트를 추가한다

mock fetch로 다음을 검증한다.

- Bearer 헤더가 붙는다.
- 환경값 누락, 비 HTTPS origin, credentials, query, hash, `/`가 아닌 path는 API 호출 전에 실패한다.
- redirect가 error이고 timeout 10초가 적용된다.
- 네트워크 오류와 5xx 응답은 최대 2회 재시도하고, 4xx 응답은 재시도하지 않는다.
- 성공 응답은 schema를 통과해야 반환된다.
- JSON 오류 응답은 code와 requestId를 보존한다.
- 오류 메시지에 토큰과 요청 본문 문자열이 포함되지 않는다.
- source-sync는 누락 URL을 `null`로 보내고 새 소스의 `expectedVersion`을 0으로 둔다.

## 검증

```bash
# cwd: 저장소 루트
bun test career-os/scripts/study-topic-recommender/study-library
bun test career-os/scripts/study-topic-recommender/url_identity.test.ts career-os/scripts/study-topic-recommender/reading_sources.test.ts
bunx tsc -p tsconfig.json
```

- study-library 테스트: 종료 코드 0
- 기존 URL 식별과 소스 설정 테스트: 종료 코드 0
- TypeScript 검사: 종료 코드 0

## Critical Files

| 파일 | 변경 |
| --- | --- |
| career-os/scripts/study-topic-recommender/study-library/contracts.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/client.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/source-sync.ts | 신규 |
| career-os/scripts/study-topic-recommender/study-library/client.test.ts | 신규 |
| career-os/docs/code-architecture.md | 참조 |
| career-os/docs/data-schema.md | 참조 |
