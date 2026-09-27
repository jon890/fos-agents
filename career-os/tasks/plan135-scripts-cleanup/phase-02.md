# Phase 02. 공부 추천의 파일 모드 흔적을 지운다

**Execution profile**: standard

## 목표

공부 추천의 원본이 Backend 로 옮겨진 뒤에도 남은 파일 모드 코드를 지운다.
호출처가 없는 수집 경로, 옛 이력 스키마, 옛 config 형식으로 감싸 다시 파싱하는 우회를 없앤다.

**범위 외**: 리포트 JSON 의 `sourceOfTruth` 칸과 `build_morning_reading.ts` 별칭은 바꾸지 않는다. 스킬 문서가 별칭을 부르고, 리포트 계약을 바꾸면 검증기와 fixture 가 함께 바뀌는 데 비해 얻는 것이 없다.

## 컨텍스트

| 지울 것 | 위치 | 쓰는 곳 |
| --- | --- | --- |
| `prepareReadingCandidatePool`, `ReadingCollectionInput` | `career-os/scripts/study-topic-recommender/reading_stage.ts` | 테스트를 포함해 없음 |
| `readingHistoryEntrySchema`, `morningStudyHistorySchema` 와 그 타입 | `career-os/scripts/study-topic-recommender/reading_contracts.ts` | 정의한 파일 밖에 없음 |
| `{ _meta: { purpose: "backend", schemaVersion: 6 }, sources }` 로 감싸 `normalizeReadingSources` 에 넘기는 우회 | `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` 의 수집 호출 | 운영 수집 경로 |

`reading_contracts.ts` 의 `readingSourcesConfigSchema` 는 옛 config 파일 형식(`_meta.schemaVersion: 6`)이다.
`reading_sources.ts` 의 `normalizeReadingSources(raw)` 와 검증 함수들이 이것으로 파싱한다.
Backend 가 원본을 가진 뒤(ADR-126)에는 운영 경로가 Backend 응답을 이 형식으로 감싸서 다시 푸는 데만 쓴다.

**근거 문서**: `docs/adr/ADR-126-읽을거리-소스-목록은-backend가-원본을-가진다.md`, `docs/code-architecture.md` 의 「study-topic-recommender」 절

## 의도 메모

- 정규화 규칙(소스 정렬, 활성 소스만 고르기 같은 것)은 남긴다. 바꾸는 것은 입력 모양뿐이다
- 테스트만 부르는 검증 함수(`validateReadingSources` 등)가 옛 config 형식만을 위해 있으면 함께 지운다. 운영 경로가 쓰는 함수는 남긴다
- 삭제 전에 `git grep` 으로 호출처를 다시 확인한다. 이 계획을 쓴 뒤 cron 안정화 작업이 이 디렉터리를 고쳤다

## Blocked 조건

- `career-os/scripts/position-recommender/run-dir.ts` 에 `writeCompanyTierUpdatesTemplate` 가 없으면 `PHASE_BLOCKED: cron 안정화 작업 머지 전` 을 출력하고 종료한다. 그 작업이 `morning_reading_cli.ts` 를 고친다

## 작업 항목

### 1. `reading_stage.ts` 수정

`prepareReadingCandidatePool` 과 `ReadingCollectionInput` 을 지운다. 그 둘만 쓰던 import 도 지운다.

### 2. `reading_contracts.ts` 수정

`readingHistoryEntrySchema`, `morningStudyHistorySchema` 와 그 타입 export 를 지운다.
`readingSourcesConfigSchema` 는 작업 항목 3 뒤에 호출처가 없으면 지운다.

### 3. `reading_sources.ts` 와 `morning_reading_cli.ts` 수정

- `normalizeReadingSources` 가 Backend 소스 배열을 직접 받게 바꾼다. 시그니처는 `normalizeReadingSources(sources: readonly StudyLibrarySource[]): NormalizedReadingSources` 다. `StudyLibrarySource` 는 `study-library/contracts.ts` 의 타입이다
- `morning_reading_cli.ts` 의 `_meta` 로 감싸는 코드를 지우고 배열을 그대로 넘긴다
- 옛 config 형식만을 위한 검증 함수와 그 테스트를 지운다

### 4. 이 phase 를 검증하는 테스트

`career-os/scripts/study-topic-recommender/reading_sources.test.ts` 를 새 시그니처로 옮긴다. 기존 정규화 단언(정렬, 비활성 제외)은 그대로 통과해야 한다.

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "prepareReadingCandidatePool|ReadingCollectionInput|morningStudyHistorySchema|readingHistoryEntrySchema|schemaVersion: 6" -- career-os/scripts
```

모두 종료 코드 0 이어야 한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/study-topic-recommender/reading_stage.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_contracts.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_sources.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/reading_sources.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/morning_reading_cli.ts` | 수정 |
