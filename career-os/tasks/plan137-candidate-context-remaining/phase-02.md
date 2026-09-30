# Phase 02. position-preferences 저장과 분석 기준 버전을 맞추고 수집 전에 비교한다

**Execution profile**: deep

## 목표

`manage_candidate_context.ts put --key position-preferences` 가 저장에 성공하면 같은 명령이 분석 정책의 `candidateContextVersion` 을 `position-preferences:v{version}` 으로 바꾼다.
포지션 `collect` 는 시작할 때 두 값이 다르거나 문서가 없으면 멈추고, 같으면 실행 디렉터리에 `candidate-context.json` 을 둔다.
이직 우선순위를 고친 뒤 기준 버전 올리기를 잊어 예전 분석이 재사용되는 일을 막는다.

**범위 외**: 스킬 문서 갱신은 phase 04 다.

## 컨텍스트

- phase 01 이 `CareerBackendClient.getAnalysisPolicy()` 를 더했다. 기존 `configureAnalysisPolicy(body, idempotencyKey)` 가 정책 전체를 바꾼다
- plan136 이 `career-os/scripts/candidate-context/` 의 `client.ts`, `contracts.ts`, `manage_candidate_context.ts` 를 만들었다. 이 phase 는 그 파일을 고친다. 정의를 먼저 읽는다
- 포지션 실행은 `career-os/scripts/position-recommender/position_run.ts` 의 `PositionRunOperations` 와 `defaultOperations` 가 나눈다. `collect` 분기가 `operations.collect(paths)` 를 부른다
- 실행 디렉터리 파일 이름은 `career-os/scripts/position-recommender/run-dir.ts` 의 `RUN_DIR_FILE_NAMES` 와 `runDirectoryPaths` 가 소유한다

**근거 문서**: `career-os/docs/flow.md` 「후보자 맥락 문서」 절과 「position-recommender」 절 1단계, `career-os/docs/data-schema.md` 「포지션 분석 정책」 절, ADR-132

## 의도 메모

- 정책 갱신이 실패해도 문서 저장을 되돌리지 않는다. 문서가 원본이다. 종료 코드 1 과 다시 맞추는 명령을 알린다
- 비교가 틀리면 수집하지 않는다. 기본값으로 이어 가거나 경고만 내지 않는다. 틀린 기준의 분석이 저장된다
- 정책 갱신의 멱등 키는 `analysis-policy:position-preferences:v{version}` 이다. 같은 version 으로 다시 실행하면 저장된 응답을 받는다
- `candidate-context.json` 은 시스템 임시 실행 디렉터리에만 둔다. 개인 맥락이다

## Blocked 조건

- `career-os/scripts/candidate-context/manage_candidate_context.ts` 가 없으면 `PHASE_BLOCKED: plan136 머지 전` 을 출력하고 종료한다

## 작업 항목

### 1. `career-os/scripts/candidate-context/position-policy.ts` 신규

```ts
export const positionContextVersion = (version: number) => `position-preferences:v${version}`;
export async function syncPositionPolicy(input: {
  positions: Pick<CareerBackendClient, "getAnalysisPolicy" | "configureAnalysisPolicy">;
  version: number;
}): Promise<{ candidateContextVersion: string; changed: boolean }>;
```

정책을 읽어 `candidateContextVersion` 만 바꿔 보낸다. 이미 같으면 보내지 않고 `changed: false` 다.

### 2. `career-os/scripts/candidate-context/manage_candidate_context.ts` 수정

- `put --key position-preferences` 가 성공하면 `syncPositionPolicy` 를 부른다. 실패하면 문서 저장 결과를 출력한 뒤 `sync-position-policy` 를 다시 실행하라고 알리고 종료 코드 1 이다
- `sync-position-policy` 명령을 더한다. 문서를 `get` 해 그 version 으로 `syncPositionPolicy` 를 부른다. 도움말에 더한다

### 3. `career-os/scripts/position-recommender/` 수정

- `run-dir.ts`: `RUN_DIR_FILE_NAMES.candidateContext = "candidate-context.json"` 과 `runDirectoryPaths` 의 `candidateContext` 경로를 더한다
- `position_run.ts`: `PositionRunOperations` 에 `prepareCandidateContext(paths): Promise<{ candidateContextVersion: string }>` 를 더하고 `collect` 분기에서 `operations.collect` 보다 먼저 부른다. 실패하면 이유를 출력하고 종료 코드 1 이며 수집하지 않는다
- `defaultOperations.prepareCandidateContext`: `position-preferences` 와 `application-state` 문서, 분석 정책을 읽는다. 문서가 없으면 키를, 버전이 다르면 두 값과 `manage_candidate_context.ts sync-position-policy` 를 알린다. 같으면 `{ candidateContextVersion, documents: { "position-preferences": { version, body }, "application-state": { version, body } } }` 를 `candidate-context.json` 에 쓴다

### 4. 이 phase 를 검증하는 테스트

- `career-os/scripts/candidate-context/position-policy.test.ts` 신규. 버전이 다르면 나머지 칸을 그대로 두고 `candidateContextVersion` 만 바꿔 보낸다. 같으면 보내지 않는다
- `career-os/scripts/candidate-context/manage_candidate_context.test.ts` 수정. `put --key position-preferences` 뒤 정책 갱신이 실패하면 종료 코드 1 과 `sync-position-policy` 안내가 나온다. 다른 키의 `put` 은 정책을 건드리지 않는다
- `career-os/scripts/position-recommender/position_run.test.ts` 수정. 가짜 operations 로 `prepareCandidateContext` 가 실패하면 `collect` 가 불리지 않고 종료 코드 1 이다. 성공하면 `collect` 가 불린다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/candidate-context/position-policy.test.ts career-os/scripts/candidate-context/manage_candidate_context.test.ts career-os/scripts/position-recommender/position_run.test.ts
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts/candidate-context career-os/scripts/position-recommender
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
```

모두 종료 코드 0 이어야 한다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/candidate-context/position-policy.ts` | 신규 |
| `career-os/scripts/candidate-context/position-policy.test.ts` | 신규 |
| `career-os/scripts/candidate-context/manage_candidate_context.ts` | 수정 |
| `career-os/scripts/candidate-context/manage_candidate_context.test.ts` | 수정 |
| `career-os/scripts/position-recommender/run-dir.ts` | 수정 |
| `career-os/scripts/position-recommender/position_run.ts` | 수정 |
| `career-os/scripts/position-recommender/position_run.test.ts` | 수정 |
