# Phase 01. 질문 선별을 파일과 저장소에서 떼어 낸 순수 함수로 옮긴다

**Execution profile**: standard

## 목표

`scripts/interview-drill/drill-engine.ts` 의 질문 선별 규칙을 `scripts/interview-drill/question-selection.ts` 의 순수 함수로 옮긴다.
노트북 CLI 와 fos-career 커넥터가 같은 함수로 같은 질문을 고르게 하려는 것이다.

**범위 외**: plugin 코드와 MCP 도구는 Phase 02 다. 선별 규칙 자체(우선순위, 난도 창, 섞는 비율)는 바꾸지 않는다.

## 컨텍스트

지금 `drill-engine.ts` 의 `selectQuestions(drillType, progress, maxCount, directory, target, personal)` 는 안에서 `loadQuestionBank` 로 파일을 읽고 `today()` 로 날짜를 만든다.
그래서 번들에 넣으면 파일 시스템 코드가 함께 들어간다. 커넥터 번들에는 파일을 읽는 코드가 없어야 한다(`career-os/plugin/src/contract-parity.test.ts` 의 「번들에 파일을 읽는 코드가 없다」).

`scripts/agent-usage/chart.ts` 가 같은 모양의 선례다. import 가 없는 순수 함수이고 노트북 CLI 와 커넥터가 함께 쓴다.

`follow-up-policy.ts` 는 `INTERVIEW_BARS`, `inferredInterviewBar`, `InterviewBar` 를 내고, `drill-engine.ts` 에서 `ScoreResult` 타입만 `import type` 으로 가져온다. 번들러가 타입 import 를 지우므로 `question-selection.ts` 가 `follow-up-policy.ts` 를 import 해도 된다.

**근거 문서**: `career-os/docs/code-architecture.md` 의 「interview-practice」 절과 「fos-career 커넥터」 절,
`career-os/docs/adr/ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md`

## 의도 메모

- `question-selection.ts` 는 `node:fs`, `node:path`, `zod`, `services/` 아래 파일을 import 하지 않는다. `follow-up-policy.ts` 만 import 한다. 어기면 Phase 02 의 번들에 `zod` 가 두 벌 들어가거나 파일 읽기 코드가 들어간다.
- 질문 타입은 `services/career-backend/src/interview/schema.ts` 의 `InterviewQuestion` 을 `import type` 으로만 가져오지 않는다. 그 파일이 `zod` 를 값으로 import 하므로 타입만 쓰더라도 경로 의존을 피하려고 `question-selection.ts` 안에 같은 모양의 `SelectableQuestion` 타입을 둔다. `drill-engine.ts` 의 `DrillQuestion` 은 이 타입에 구조적으로 맞는다.
- 날짜는 인자로 받는다. 순수 함수가 시계를 읽지 않아야 커넥터와 CLI 가 같은 날짜로 같은 결과를 낸다.

## 작업 항목

### 1. `career-os/scripts/interview-drill/question-selection.ts` 신규

`drill-engine.ts` 에서 아래를 옮긴다. 동작은 바꾸지 않는다.

- 타입: `SelectableQuestion`(`id`, `topic`, `category`, `difficulty: "basic" | "intermediate" | "advanced"`, `question`, `intent`, `answerSignals: string[]`, 선택 칸 `bar`, `followUps`, `positionFitHint`, `tags`, `sequenceHint`, `sourceScope?: "public" | "personal" | "application"`), `DrillProgressEntry`, `DrillProgress`
- 함수: `previousDate`, `interviewBar`, `barPriorityBoost`, `inWindow`, `selectWithStretch`, `sequenceOrder`, `difficultyOrder`
- `toDrillProgress(items)`: `items` 는 `{ topic, passCount, failCount, nextReviewDate, lastPassedDate }` 배열. 지금 `drill-engine.ts` 의 것과 같은 변환
- 공개 함수 `selectFromBank<Q extends SelectableQuestion>(bank: Q[], progress: DrillProgress, options: { today: string; maxCount?: number; target?: InterviewBar; mixApplication?: boolean }): Q[]`
  - 지금 `selectQuestions` 의 본문에서 `loadQuestionBank(...)` 대신 `bank` 를, `today()` 대신 `options.today` 를 쓴다
  - `if (directory && maxCount > 1)` 조건은 `options.mixApplication && maxCount > 1` 로 바꾼다
  - `maxCount` 기본값은 5 다
- 공개 함수 `dueForReview(progress: DrillProgress, topic: string, today: string): boolean`. 지금 `runDrillCli` 의 `select` 분기가 계산하는 식(`next_review_date != null && next_review_date <= today`)을 옮긴다

### 2. `career-os/scripts/interview-drill/drill-engine.ts` 수정

- 옮긴 함수와 타입을 지우고 `question-selection.ts` 에서 import 한다. `DrillProgressEntry`, `DrillProgress`, `toDrillProgress` 는 같은 이름으로 다시 export 해 기존 import 를 깨지 않는다
- `selectQuestions(drillType, progress, maxCount = 5, directory?, target?, personal = [])` 의 시그니처는 그대로 두고 본문을 `selectFromBank(loadQuestionBank(drillType, directory, personal), progress, { today: today(), maxCount, target, mixApplication: Boolean(directory) })` 로 바꾼다
- `select` 분기의 `dueForReview` 계산은 `dueForReview(progress, question.topic, currentDay)` 를 쓴다

### 3. `career-os/scripts/interview-drill/question-selection.test.ts` 신규

지어낸 질문 묶음으로 확인한다. 파일을 읽지 않는다.

- 정상: 복습 상태가 빈 질문 셋 가운데 `maxCount: 2` 로 둘을 고르고, 결과가 `sequenceHint` 와 난도 순서를 따른다
- 정상: `last_passed` 가 `today` 의 전날인 주제는 빠진다. `today` 를 `"2026-10-04"` 로 고정한다
- 정상: `mixApplication: true` 이고 `sourceScope: "application"` 질문이 있으면 그 질문이 `Math.ceil(maxCount * 0.6)` 개까지 결과에 포함된다. 결과 순서는 마지막의 `sequenceOrder` 정렬이 정한다
- 실패 쪽: `target: "large-scale"` 이면 `bar: "production"` 질문이 난도 창 밖이라 빠진다
- `dueForReview` 가 `next_review_date` 가 없을 때 `false`, 오늘 이전이면 `true` 를 낸다
- `question-selection.ts` 의 본문에 `node:fs`, `node:path`, `"zod"` 문자열이 없다(`readFileSync` 로 소스를 읽어 확인)

## 검증

```bash
# cwd: 저장소 루트
bun install --frozen-lockfile
bun test ./career-os/scripts/interview-drill/question-selection.test.ts
bun test ./career-os/scripts/interview-drill
bunx tsc --noEmit
```

기대값: 모두 종료 코드 0. 기존 `drill-engine.test.ts`, `drill-engine.cli.test.ts` 가 바뀌지 않은 채 통과한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/interview-drill/question-selection.ts` | 신규 |
| `career-os/scripts/interview-drill/question-selection.test.ts` | 신규 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
