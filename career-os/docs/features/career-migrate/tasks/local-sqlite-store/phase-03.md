# Phase 03. 공부 추천 저장소를 SQLite 로 옮긴다

**Execution profile**: standard

## 목표

Backend 의 study 서비스와 저장소 규칙(소스와 버전, 커서, 자료, 후보 판정, 추천 실행, 게시 기록)을 `career-store` 로 옮긴다.

**범위 외**: 실행기 호출부(phase 04), MCP 의 공부 도구(다음 계획).

## 컨텍스트

- 옮길 원본: `career-os/services/career-backend/src/study/` 의 `study.service.ts`, `repository/study.repository.ts`, `study.controller.ts`, `schema.ts`.
- 하루 한 번 저장은 `reportId`(`morning-<서울 날짜>`)가 기본 키라서 지켜진다. 같은 `reportId` 의 두 번째 저장은 `409 VERSION_CONFLICT` 다. 이 규칙을 그대로 둔다.
- 기준 버전과 관심사 본문은 `context/learning-interests.md` 에서 읽는다. 문서가 없으면 지금처럼 `409 CANDIDATE_CONTEXT_MISSING` 으로 후보 조회와 추천 저장을 멈춘다.
- 후보 응답의 `learningInterests` 는 `{ version, body }` 였다. 문서 번호가 없어지므로 `version` 은 기준 버전 문자열로 바꾼다. 이 값을 읽는 곳은 phase 04 에서 함께 고친다.

**요구사항**: REQ4(설계 DECISION2, 3)

**근거 문서**: `career-os/docs/flow.md` 의 공부 추천 절, `career-os/docs/adr/ADR-127-공부-추천은-고르지-않은-후보의-판정을-재사용한다.md`

## 의도 메모

- `NOW(3)` 은 호출 시각의 ISO 문자열 인자로, `DATE_ADD(today, INTERVAL 30 DAY)` 는 `date(?, '+30 days')` 로 옮긴다.
- 후보 쪽 페이지 커서(`publishedAt`, `contentKey`)의 정렬은 `published_at IS NULL ASC, published_at DESC, content_key ASC` 그대로다.
- 새 소스를 동시에 만드는 경합은 파일 잠금 아래에서 생기지 않으므로 중복 키 오류를 바꾸는 갈래는 옮기지 않는다.

## 작업 항목

### 1. `career-os/scripts/lib/career-store/study/schema.ts`

Backend 의 `schema.ts` 를 복사하고 `learningInterests.version` 을 문자열로 바꾼다.

### 2. `career-os/scripts/lib/career-store/study/repository.ts`, `service.ts`

같은 메서드 이름과 반환값으로 옮긴다.

### 3. `career-os/scripts/lib/career-store/study/store.ts`

HTTP 경로 하나에 함수 하나인 `StudyStore`. 본문 검증과 쓰기 경로의 `runWithReceipt` 를 한다. 메서드 이름은 `career-os/scripts/study-topic-recommender/study-library/client.ts` 의 `StudyLibraryClient` 와 같게 한다.

### 4. 테스트 `career-os/scripts/lib/career-store/study/store.test.ts`

Backend 의 `test/study-sources.e2e.test.ts`, `study-candidates.e2e.test.ts`, `study-recommendations.e2e.test.ts` 가 보는 규칙을 옮긴다.

- 소스 저장은 `expectedVersion` 이 맞을 때만 되고 버전이 1 오른다.
- 수집 저장은 커서 버전이 맞을 때만 되고, 다음 조회가 저장한 커서를 돌려준다(이어 읽기).
- 추천한 자료와 유효한 제외 판정이 붙은 자료는 후보에서 빠진다. 기준 버전이 바뀌면 제외 판정이 적용되지 않는다.
- 같은 `reportId` 는 한 번만 저장된다. 직전 추천의 주제는 다시 고를 수 없다.
- 게시 기록은 추천 실행이 있을 때만 저장되고, 추천 실행 목록에서 보인다.

## 검증

```bash
bun test ./career-os/scripts/lib/career-store
bunx tsc --noEmit -p .
```

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-store/study/schema.ts` | 신규 (Backend 에서 복사 후 수정) |
| `career-os/scripts/lib/career-store/study/repository.ts` | 신규 |
| `career-os/scripts/lib/career-store/study/service.ts` | 신규 |
| `career-os/scripts/lib/career-store/study/store.ts` | 신규 |
| `career-os/scripts/lib/career-store/study/store.test.ts` | 신규 |
