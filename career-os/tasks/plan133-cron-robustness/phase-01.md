# Phase 01. 수집 배치의 중복 글을 걸러 내고 출처 하나의 실패를 격리한다

**Execution profile**: standard

## 목표

공부 추천 수집에서 출처 하나의 피드가 같은 글을 두 번 줘도 전체 수집이 멈추지 않게 한다.

**범위 외**: 결과 파일 틀은 phase 02, 정리 명령은 phase 03 이 한다.

## 컨텍스트

2026-09-25 13:02 UTC 홈서버 cron 에서 수집 명령이 `같은 ingestion 배치에 중복 contentKey가 있다` 로 끝났다. 모델이 수집을 다시 실행해 복구했다. 같은 날 다시 돌렸을 때는 재현되지 않았다. 피드가 일시적으로 같은 글을 두 번 준 것으로 본다.

코드 위치는 `career-os/scripts/study-topic-recommender/study-library/ingestion.ts` 다.

- `toIngestionItem` (110행 부근)이 URL 을 정규화해 `contentKey` 를 만든다. query 만 다른 URL 두 개도 같은 키가 된다
- 최근 글 수집은 `newItems` 를 만드는 반복(225행 부근)에서 `previousSeen` 만 거르고, 같은 응답 안의 중복은 거르지 않는다
- archive 수집은 `result.items.map(toIngestionItem)` (290행 부근)으로 그대로 옮긴다
- `buildIngestionPayload` 의 `assertNoDuplicateContentKeys` (126행 부근)가 중복이 있으면 예외를 던진다
- `collectAndIngestStudyLibrary` (355행 부근)는 출처마다 도는 반복에서 예외를 잡지 않는다. 그래서 출처 하나의 예외가 명령 전체를 끝낸다
- 출처별 결과 타입 `LibraryCollectStatus` 에는 이미 `status: "failed"` 와 `reason` 이 있다

**근거 문서**: `docs/flow.md` 의 공부 추천 수집 절, `docs/adr/ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md`

## 의도 메모

- **같은 키는 같은 글로 보고 앞의 것만 남긴다.** 정규화 규칙이 같은 글이라고 판정한 것이다. 뒤의 것을 버려도 잃는 정보가 없다
- `assertNoDuplicateContentKeys` 는 지우지 않는다. 걸러 낸 뒤에도 중복이 있으면 코드 결함이므로 계속 예외로 둔다
- **출처 하나의 실패는 그 출처의 `failed` 로 남기고 다음 출처를 계속 수집한다.**
  - 단, `StudyLibraryApiError` 는 격리하지 않고 그대로 던진다. Backend 가 응답하지 않으면 모든 출처가 같은 이유로 실패하고, 스킬은 Backend 장애 때 중단하도록 되어 있다
  - 격리한 실패의 `reason` 에는 오류 문구의 첫 줄만 200자 안으로 남긴다
- 격리된 실패가 있어도 명령의 종료 코드는 지금처럼 0 이다. 출처별 상태는 이미 stdout JSON 의 `statuses` 에 나온다

## 작업 항목

### 1. 최근 글 수집의 중복 제거

`newItems` 를 채우는 반복에서 `savedKeys` 에 이미 있는 키는 건너뛴다. `maxItems` 는 중복을 뺀 개수로 센다.

### 2. archive 수집의 중복 제거

290행 부근의 `items` 에서 `contentKey` 가 같은 항목은 앞의 것만 남긴다. 걸러 낸 뒤 `buildIngestionPayload` 에 넘긴다.

### 3. 출처별 실패 격리

`collectAndIngestStudyLibrary` 의 출처 반복에서 `StudyLibraryApiError` 가 아닌 예외를 잡는다.
그 출처의 상태를 `{ sourceKey, status: "failed", reason, acceptedCount: sourceAccepted, cursorUpdated: sourceUpdates > 0 }` 로 남기고 다음 출처로 간다.

### 4. 문서

`docs/flow.md` 의 공부 추천 수집 절에 두 줄을 더한다. 같은 글은 한 번만 저장한다는 것, 출처 하나가 실패해도 나머지 출처는 계속 수집하고 그 출처는 `failed` 로 남는다는 것이다.

### 5. `career-os/scripts/study-topic-recommender/study-library/ingestion.test.ts`

- 최근 글 모드에서 같은 글이 query 만 다른 URL 로 두 번 오면 한 건만 저장 요청에 담긴다
- archive 모드에서도 같다
- 출처 둘 중 첫 출처의 수집기가 예외를 던지면 첫 출처는 `failed`, 둘째 출처는 `ingested` 다
- `StudyLibraryApiError` 가 나면 반복을 멈추고 예외가 그대로 나온다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/study-topic-recommender
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
```

기대값: 모두 실패 0.

## 마무리

검증이 통과하면 `career-os/tasks/plan133-cron-robustness/index.json` 의 이 phase 를 완료로 표시하고 `current_phase` 를 다음 번호로 올린다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/study-topic-recommender/study-library/ingestion.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/study-library/ingestion.test.ts` | 수정 |
| `career-os/docs/flow.md` | 수정 |
