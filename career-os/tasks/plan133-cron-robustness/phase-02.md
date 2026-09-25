# Phase 02. 포지션 결과 파일의 틀을 CLI 가 만든다

**Execution profile**: standard

## 목표

모델이 결과 파일의 최상위 칸과 실행 ID 를 추측하지 않게 한다. CLI 가 결과를 쓸 경로를 알릴 때 그 경로에 틀을 먼저 만들어 둔다.

**범위 외**: 공부 추천의 선택 파일은 대상이 아니다. 그 계약에는 실행 ID 같은 식별 칸이 없고 `rejections` 도 선택이다.

## 컨텍스트

2026-09-25 홈서버 cron 에서 모델이 세 번 다시 썼다.

- `company-tier-updates.json` 에 `companyTierRunId` 를 빠뜨렸다
- `analysis-updates.json` 에 `analysisRunId` 를 빠뜨렸다
- 분석 결과에서 큐에 있던 공고 한 건을 빠뜨렸다 (`큐와 제출 목록이 다릅니다`)

지금 `career-os/scripts/position-recommender/position_run.ts` 는 `회사 판정 결과 작성: <경로>` 와 `공고 분석 결과 작성: <경로>` 처럼 경로만 알린다. 그런 줄은 세 곳에 있다.

- `collect` 의 회사 판정 분기(210행 부근)와 공고 분석 분기(216행 부근)
- `commit-company-tiers` 가 분석 큐를 만든 뒤(230행 부근)
- `commit-analyses` 가 `partial` 일 때(245행 부근)

파일 계약이다. 둘 다 `.strict()` 라 모르는 칸을 받지 않는다.

| 파일 | 스키마 | 최상위 칸 |
| --- | --- | --- |
| `company-tier-updates.json` | `career-os/scripts/position-recommender/company-tier-analysis/schema.ts` 의 `companyTierUpdatesInputSchema` | `schemaVersion: 1`, `collectionRunId`, `companyTierRunId`, `results`, `failures` |
| `analysis-updates.json` | `career-os/scripts/position-recommender/commit_position_analysis.ts` 의 `analysisUpdatesInputSchema` | `schemaVersion: 2`, `collectionRunId`, `analysisRunId`, `results`, `failures` |

실행 ID 는 같은 디렉터리의 큐 파일(`company-tier-queue.json`, `analysis-queue.json`)에 있다. 파일 이름은 `career-os/scripts/position-recommender/run-dir.ts` 의 `RUN_DIR_FILE_NAMES` 가 정한다.

**근거 문서**: `docs/flow.md` 의 포지션 추천 흐름 절, `.claude/skills/position-recommender/SKILL.md` 의 「실행」 절

## 의도 메모

- **틀은 최상위 칸만 채우고 `results` 와 `failures` 는 빈 배열로 둔다.** 판정 칸에 자리표시자를 넣는 안은 기각했다. 모델이 자리표시자를 그대로 두면 그럴듯한 값처럼 보이는 파일이 검증을 통과할 위험이 있다(ADR-124)
- **경로를 알릴 때마다 틀을 새로 쓴다.** 앞 단계의 파일은 이미 반영됐으므로 덮어써도 잃는 것이 없다. `partial` 때는 남은 항목만 다시 쓰라는 것이 지금 계약이다
- 틀을 쓴 줄 바로 뒤에 채울 항목 수를 알린다. 예: `채울 항목: 회사 3곳. results 나 failures 에 한 번씩 넣는다.` 항목 ID 목록은 큐 파일에 있으므로 stdout 에 늘어놓지 않는다
- 틀을 만드는 함수는 스키마로 한 번 검증한 뒤 쓴다. 빈 `results` 는 스키마가 허용한다

## 작업 항목

### 1. 틀 생성 함수

`career-os/scripts/position-recommender/run-dir.ts` 나 새 파일 `career-os/scripts/position-recommender/update-templates.ts` 에 두 함수를 둔다.

- `writeCompanyTierUpdatesTemplate(paths)`: `company-tier-queue.json` 에서 `collectionRunId` 와 `companyTierRunId` 를 읽어 틀을 쓰고, 큐의 회사 수를 돌려준다
- `writeAnalysisUpdatesTemplate(paths)`: `analysis-queue.json` 에서 `collectionRunId` 와 `analysisRunId` 를 읽어 틀을 쓰고, 큐의 공고 수를 돌려준다

큐 파일의 칸 이름은 `companyTierQueueFileSchema` 와 `queueAnalysisRunId` 가 읽는 방식을 따른다.

### 2. `position_run.ts`

결과 작성 경로를 알리는 네 곳에서 틀을 먼저 쓰고, 경로 줄 뒤에 채울 항목 수 줄을 낸다.

### 3. `career-os/.claude/skills/position-recommender/SKILL.md`

「실행」 절의 결과 작성 설명을 바꾼다.

- CLI 가 만든 틀의 `results` 와 `failures` 에만 쓴다. 최상위 칸은 바꾸지 않는다
- 큐의 항목마다 `results` 나 `failures` 에 한 번씩 넣는다
- 「입력 파일의 실행 ID 는 회사 판정 큐와 같아야 한다」 문장은 지운다. 틀이 대신한다

### 4. `career-os/scripts/position-recommender/position_run.test.ts`

- `collect` 가 회사 판정 분기로 가면 `company-tier-updates.json` 틀이 생기고, 최상위 칸이 큐와 같다
- `commit-analyses` 가 `partial` 이면 `analysis-updates.json` 이 새 틀로 바뀐다
- 틀을 그대로 넘기면 `commit-analyses` 가 `큐와 제출 목록이 다릅니다` 로 실패한다. 빈 틀이 통과하지 않는다는 확인이다
- stdout 에 채울 항목 수 줄이 나온다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/position-recommender
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bun test ./career-os/.claude/skills/
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
```

기대값: 모두 실패 0.

## 마무리

검증이 통과하면 `career-os/tasks/plan133-cron-robustness/index.json` 의 이 phase 를 완료로 표시하고 `current_phase` 를 다음 번호로 올린다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/update-templates.ts` | 신규 |
| `career-os/scripts/position-recommender/position_run.ts` | 수정 |
| `career-os/scripts/position-recommender/position_run.test.ts` | 수정 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
