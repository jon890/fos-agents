# Phase 01. 분석 정책과 공고별 이력

**Execution profile**: deep

## 목표

회사 티어와 분석 상태로 하루 분석 대상을 제한하고 공고별 분석 버전을 다음 실행에서 재사용하는 코드 경계를 만든다.

**범위 외**: 추천 JSON 변경, HTML 표시와 `position-recommender` 스킬 실행 순서 변경은 다음 phase가 담당한다.

## 컨텍스트

개인 제외 규칙은 `scripts/position-recommender/feedback/exclusions.ts`가 수집 전에 적용한다.
새 우선순위 정책은 제외 규칙을 대체하지 않으며, 제외된 회사와 공고는 분석 큐에 들어오면 안 된다.
비공개 상태는 `scripts/career-workspace/`의 기존 release로 동기화한다.

**근거 문서**: `docs/data-schema.md`의 「포지션 분석 정책」과 「공고별 분석 이력」, `docs/flow.md`의 「포지션 추천」, `docs/adr/ADR-117-포지션-분석은-우선순위-큐와-버전-이력으로-재사용한다.md`

## 의도 메모

- 새 데이터베이스나 패키지를 추가하지 않고 Bun, TypeScript와 Zod를 사용한다.
- 회사 티어는 분석 순서를 정하며 개인 제외 정책을 대신하지 않는다.
- 본문 hash에서 매일 달라지는 수집 시각과 남은 날짜를 제외한다.
- 공고가 수집에서 사라졌다는 이유만으로 분석 이력을 삭제하지 않는다.
- `partial` 또는 `failed` 소스의 누락 공고는 닫힌 공고로 판정하지 않는다.

## 작업 항목

### 1. 비공개 분석 정책 계약 추가

`config/position-analysis.ts`에 `state/private-config/position-analysis.json` 상대 경로만 둔다.
`scripts/position-recommender/candidate-analysis/schema.ts`에 정책, 저장 이력, 임시 분석 큐와 모델 갱신 Zod 스키마를 추가한다.

정책은 `dailyAnalysisLimit: 20`, `prioritySlots: 16`, `agingSlots: 4`, `staleAfterDays: 30`, `defaultCompanyTier: 3`을 초기 운영값으로 사용한다.
일일 상한은 1부터 20까지만 허용한다.
`candidateContextVersion`은 빈 문자열을 거부하고 회사명은 정확히 일치시킨다.
슬롯 합계가 일일 상한과 다르거나 회사명이 중복되면 종료 코드 1로 실패해야 한다.

### 2. 공고 hash와 분석 상태 분류 구현

`candidate-analysis/content-hash.ts`에서 회사명, 공고명, 직무 분류, 요약, 주요 업무, 요구 경력, 우대 사항, 정렬한 기술과 태그로 안정적인 SHA-256을 만든다.
같은 공고에서 수집 시각, 마감일까지 남은 날짜와 활성 근거만 바뀌면 hash가 같아야 한다.

`candidate-analysis/classify.ts`에서 `fresh`, `new`, `changed`, `stale`을 구분한다.
본문 hash, `candidateContextVersion`, `analysisContractVersion`과 유효기간이 모두 맞는 가장 최근 분석만 `fresh`로 사용한다.

### 3. 우선순위 큐와 상태 저장 구현

`candidate-analysis/queue.ts`에서 우선 슬롯과 보장 슬롯을 만든다.
우선 슬롯은 회사 티어, `new`, `changed`, `stale`, 마감 긴급도, 대기 시작 시각과 공고 ID 순서로 정한다.
보장 슬롯은 티어와 무관하게 대기 시작 시각이 오래된 순서로 정한다.
중복 후보를 제거하고 한쪽이 비면 다른 쪽이 상한까지 채운다.

`candidate-analysis/store.ts`는 `state/position-analysis/<source>/<파일 hash>.json`을 임시 파일에 쓴 뒤 rename한다.
분석과 추천 이력은 식별자로 중복을 막고 같은 갱신을 반복하면 파일 내용과 수정 시각을 바꾸지 않는다.
현재 후보풀에 있는 모든 공고의 `firstSeenAt`, `lastSeenAt`, `pendingSince`와 최신 스냅샷을 갱신하되 과거 분석을 보존한다.

### 4. 준비와 반영 CLI 추가

`prepare_position_analysis.ts`는 후보풀, 정책과 저장 이력을 읽어 `<RUN_DIR>/analysis-queue.json`을 만든다.
모델이 읽을 원문은 큐에 선택된 최대 20건만 포함하고, 전체 후보는 ID, 회사, 공고명, 티어, 상태와 마감 정보만 담는다.
`live-postings/contracts.ts`와 후보풀 생성에는 개인 제외 건수를 다른 역할·생명주기 제외 건수와 분리한 집계를 추가한다.

`commit_position_analysis.ts`는 모델 갱신이 같은 `collectionRunId`와 큐의 `candidateId`를 가리키는지 검사한 뒤 분석을 합친다.
누락 분석은 실패시키되 빈 큐에는 빈 갱신을 허용한다.
역할 적합도 40점, 역할 범위와 성장 여지 25점, 회사 기회 20점과 제약이 적은 정도 15점의 합이 `fitScore`가 되는지 검사한다.
새 CLI는 `scripts/lib/cli.ts`의 `runCli` 계약과 종료 코드 0, 1, 2를 따른다.

### 5. 분석 정책과 이력 회귀 테스트

정책 누락과 오류, 회사 티어 기본값, 16개 우선 슬롯과 4개 보장 슬롯, 슬롯 넘김, 결정적 동점 순서와 중복 제거를 테스트한다.
`new`, `changed`, `stale`, `fresh` 분류, volatile 필드의 hash 제외, idempotent 반영, 과거 분석 보존과 부분 실패 소스의 상태 보존도 각각 테스트한다.
테스트 임시 파일은 `/tmp` 아래 실행별 디렉터리를 사용하고 성공과 실패 모두에서 정리한다.

## 검증

저장소 루트에서 다음 명령을 실행한다.

```bash
# cwd: 저장소 루트
bun test career-os/scripts/position-recommender/candidate-analysis/*.test.ts career-os/scripts/position-recommender/*position_analysis*.test.ts
bunx tsc --noEmit
bun run format:position-recommender:check
git diff --check
```

같은 후보풀과 갱신을 두 번 반영했을 때 두 번째 실행은 상태 파일 내용과 수정 시각을 바꾸지 않아야 한다.

## Critical Files

| 파일 | 변경 |
| --- | --- |
| `config/position-analysis.ts` | 신규 |
| `scripts/position-recommender/candidate-analysis/*.ts` | 신규 |
| `scripts/position-recommender/prepare_position_analysis.ts` | 신규 |
| `scripts/position-recommender/commit_position_analysis.ts` | 신규 |
| `scripts/position-recommender/live-postings/contracts.ts` | 수정 |
| `scripts/position-recommender/live-postings/candidate_pool.ts` | 수정 |
| `scripts/position-recommender/collect_live_postings.ts` | 수정 |
| `scripts/position-recommender/candidate-analysis/*.test.ts` | 신규 |
| `scripts/position-recommender/*position_analysis*.test.ts` | 신규 |
