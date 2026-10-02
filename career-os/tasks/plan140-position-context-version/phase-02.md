# Phase 02. 스크립트가 분석 정책의 기준 버전을 읽고 쓰지 않는다

**Execution profile**: standard

## 목표

`career-os/scripts/` 에서 분석 정책의 `candidateContextVersion` 을 읽거나 쓰는 코드를 모두 없앤다.
Backend 가 기준 버전을 문서에서 계산하므로(phase 01) 정책을 맞추는 명령과 수집 전 대조가 할 일이 없어졌다.

이 phase 가 끝나면 스크립트는 정책의 그 칸에 의존하지 않는다. 그래야 phase 03 이 Backend 스키마에서 칸을 지울 때 스크립트가 깨지지 않는다.

**범위 외**

- Backend 의 `src/positions/schema.ts`, 저장 칸, migration 은 phase 03 이 바꾼다. 이 phase 에서 `career-os/services/` 를 고치지 않는다.
- `career-os/scripts/study-topic-recommender/` 의 `candidateContextVersion` 은 공부 추천의 `learning-interests` 기준 버전이다. 대상이 아니다.
- `career-os/docs/` 는 이미 이 phase 가 끝난 상태로 적혀 있다. 고치지 않는다.

## 컨텍스트

**스크립트는 Backend 의 스키마 파일을 직접 import 한다.** `scripts/position-recommender/career-backend/client.ts` 가 `../../../services/career-backend/src/positions/schema.ts` 의 `analysisPolicySchema` 로 정책 응답을 검사한다.
이 phase 시점에 그 스키마는 아직 `candidateContextVersion` 을 필수로 요구한다.
그래서 이 phase 에서 정책 객체를 만드는 테스트 fixture 는 그 칸을 담아야 한다. 칸을 fixture 에서 빼는 일은 phase 03 이 한다.

지금 정책의 기준 버전을 쓰는 곳이다.

| 파일 | 하는 일 |
| --- | --- |
| `scripts/candidate-context/position-policy.ts` | `syncPositionPolicy` 가 정책을 읽어 `candidateContextVersion` 만 바꿔 보낸다. `prepareCandidateContext` 가 정책의 값과 문서 version 을 대조하고 다르면 던진다 |
| `scripts/candidate-context/manage_candidate_context.ts` | `sync-position-policy` 명령. `put --key position-preferences` 뒤에 `syncPositionPolicy` 를 부른다 |
| `scripts/position-recommender/position_run.ts` | `collect` 가 `prepareCandidateContext` 를 부르고 실패하면 수집하지 않는다 |
| `scripts/position-recommender/configure_position_analysis_policy.ts` | 멱등 키를 `` `analysis-policy:${policy.candidateContextVersion}` `` 으로 만들고 결과에 `candidateContextVersion` 을 낸다 |
| `.claude/skills/position-recommender/SKILL.md` | `collect` 가 기준 버전이 다르다며 멈추면 `sync-position-policy` 를 안내하라고 적혀 있다 |

`scripts/position-recommender/career-backend/client.ts` 의 `getAnalysisPolicy` 와 `configureAnalysisPolicy` 는 남긴다. endpoint 가 그대로 있고 `configure_position_analysis_policy.ts` 가 쓴다.

**근거 문서**: `career-os/docs/flow.md` 의 「후보자 맥락 문서」 절과 「position-recommender」 절의 1단계,
`career-os/docs/data-schema.md` 의 「포지션 분석 정책」 절,
`career-os/docs/code-architecture.md` 의 「후보자 맥락 문서」 절,
`career-os/docs/adr/ADR-134-공고-분석의-기준-버전은-position-preferences-문서-버전에서-계산한다.md`

## 의도 메모

- `position-policy.ts` 는 정책을 다루지 않게 되므로 이름을 `position-context.ts` 로 바꾼다. `docs/code-architecture.md` 가 이미 그 이름으로 적혀 있다.
- `prepareCandidateContext` 는 남긴다. 모델이 읽을 `candidate-context.json` 을 쓰는 일과 문서가 없을 때 수집 전에 멈추는 일은 그대로 필요하다.
- `candidate-context.json` 의 `candidateContextVersion` 칸은 남긴다. 수집 명령이 읽은 문서 version 으로 만든 값이고, 모델이 읽은 본문이 어느 version 인지 알린다. Backend 는 이 값을 받지 않는다. 계산식 `position-preferences:v{version}` 의 소유자는 Backend 이고 스크립트의 `positionContextVersion` 은 표시용 사본이다. 주석에 그렇게 적는다.
- 수집 명령이 문서를 읽은 뒤 Backend 가 수집을 저장하기 전에 누가 문서를 새로 저장하면, 파일의 version 과 실행 행의 기준 버전이 하나 어긋날 수 있다. 전에도 정책을 읽은 시점과 저장 시점 사이에 같은 틈이 있었다. 이 plan 에서 닫지 않는다.
- `configure_position_analysis_policy.ts` 의 멱등 키를 정책 전체의 hash 로 바꾼다. 기준 버전으로 만든 키는 그 칸이 없어지면 만들 수 없다. 또 같은 키에 다른 본문을 보내면 `409` 가 나므로 정책의 다른 칸만 바꿀 때 지금 키로는 저장할 수 없었다. 새 키는 `analysis-policy:<sha256>` 모양이고 옛 키 `analysis-policy:position-preferences:v{n}` 와 겹치지 않는다. 이미 없어지는 `analysis-policy-sync:` 접두사와도 다르다.
- 기각: 수집 전에 정책이 있는지 미리 읽어 안내한다. 정책이 없으면 수집 저장 요청이 `409 POLICY_NOT_CONFIGURED` 로 끝나고 그 오류가 그대로 출력된다. 미리 읽으면 정책 응답 스키마에 다시 묶인다.

## 작업 항목

### 1. `scripts/candidate-context/position-policy.ts` 를 `position-context.ts` 로 옮기고 정책 코드를 지운다

`git mv` 로 옮긴다. 테스트 파일 `position-policy.test.ts` 도 `position-context.test.ts` 로 옮긴다.

남기는 것은 둘이다.

- `export const positionContextVersion = (version: number) => ...` 은 그대로 둔다. 주석의 근거를 ADR-134 로 고치고 「Backend 가 계산의 소유자이고 이것은 표시용이다」 를 적는다.
- `prepareCandidateContext` 의 시그니처를 아래로 바꾼다.

```ts
export async function prepareCandidateContext(
  paths: { candidateContext: string },
  clients: { context: DocumentReader },
): Promise<{ candidateContextVersion: string }>
```

  저장소 안 경로 거절, 두 문서 조회, 없는 문서 안내, `candidate-context.json` 쓰기(`mode: 0o600`)는 그대로다. 정책을 읽어 대조하는 부분만 지운다.

지우는 것: `syncPositionPolicy`, `SYNC_POSITION_POLICY_COMMAND`, `CONFIGURE_POLICY_COMMAND`, `explainPolicyError`, `readPolicy`, `PolicyReader`, `PolicyClient`, 그리고 쓰이지 않게 된 import(`randomUUID`, `CareerBackendClient`, `hashKey`).

### 2. `scripts/candidate-context/manage_candidate_context.ts` 에서 정책 맞추기를 지운다

- `sync-position-policy` 명령 분기를 지운다. 허용 명령 목록은 `["list", "get", "put"]` 이다. 그 밖의 명령은 지금처럼 사용법 오류다.
- `put` 은 저장 요약(`documentKey`, `version`, `updatedAt`)만 돌려준다. `key !== "position-preferences"` 분기와 그 뒤의 `syncPositionPolicy` 호출, 실패 안내를 지운다.
- `usage` 문자열에서 `sync-position-policy` 와 「분석 정책의 기준 버전도 맞춘다」 줄을 지운다.
- 쓰이지 않게 된 import(`createCareerBackendClient`, `./position-policy.ts`)를 지운다.

### 3. `scripts/position-recommender/position_run.ts` 가 정책 client 를 넘기지 않는다

- import 경로를 `../candidate-context/position-context.ts` 로 바꾼다.
- `defaultOperations.prepareCandidateContext` 가 `{ context: createCandidateContextClient() }` 만 넘긴다.
- `PositionRunOperations.prepareCandidateContext` 의 주석과 `collect` 분기의 주석(「기준 버전이 틀린 채 수집하면」)을 「후보자 맥락 문서가 없으면 수집하지 않는다」 는 뜻으로 고친다.
- 출력 줄 `후보자 맥락 기준 버전: ...` 과 `수집 전 확인 실패: ...` 는 그대로 둔다.

### 4. `scripts/position-recommender/configure_position_analysis_policy.ts` 의 멱등 키와 출력을 바꾼다

- 키를 만드는 함수를 내보낸다.

```ts
/** 정책 전체의 hash 다. 칸 하나만 바꿔도 키가 달라져 같은 키에 다른 본문을 보내는 충돌이 없다. */
export function analysisPolicyIdempotencyKey(policy: unknown): string
```

  구현은 `hashKey("analysis-policy", policy)` 다. `hashKey` 는 `../candidate-context/client.ts` 가 내보낸다.
- `configureAnalysisPolicy(policy, analysisPolicyIdempotencyKey(policy))` 로 부른다.
- 결과 객체에서 `candidateContextVersion` 을 뺀다. `passed`, `dailyAnalysisLimit`, `prioritySlots`, `agingSlots` 는 남긴다.
- 이 phase 가 끝나면 이 파일에 `candidateContextVersion` 이 남지 않는다.

### 5. `.claude/skills/position-recommender/SKILL.md` 의 안내 한 줄을 바꾼다

`collect`가 분석 정책의 기준 버전이 다르다며 멈추면 `sync-position-policy` 를 안내하라는 줄을 아래 뜻의 한 줄로 바꾼다.

> `collect`가 후보자 맥락 문서가 없다며 멈추면 출력이 알려 주는 `manage_candidate_context.ts put` 명령으로 문서를 만들도록 안내하고, 저장된 뒤 `collect`를 다시 실행한다.

줄 수를 늘리지 않는다. `scripts/position-recommender/skill_doc.test.ts` 가 이 파일을 110줄 이하로, `bash` 코드 블록을 하나로 단언한다.

### 6. 이 phase 를 검증하는 테스트

`scripts/candidate-context/position-context.test.ts`

- `describe("syncPositionPolicy", ...)` 전체와 `policy`, `fakePositions` helper, `AnalysisPolicy` import 를 지운다.
- `prepareCandidateContext` 의 테스트를 새 시그니처로 고친다.
  - 정상: 두 문서가 있으면 `{ candidateContextVersion: "position-preferences:v4" }` 를 돌려주고 파일에 두 문서와 그 값을 쓴다
  - 실패: 문서가 없으면 빠진 키를 모두 알리고 파일을 쓰지 않는다
  - 실패: 저장소 안 경로는 조회 전에 거절한다
- 「버전이 다르면 sync 명령을 알린다」 와 「정책이 없으면 configure 명령을 안내한다」 는 지운다. 그 동작이 없어졌다.

`scripts/candidate-context/manage_candidate_context.test.ts`

- 지운다: 「help 는 sync-position-policy 명령을 안내한다」, 「put --key position-preferences 는 ... 분석 정책 기준 버전을 맞춘다」, 「put --key position-preferences 뒤 정책 갱신이 실패하면 ...」, 「sync-position-policy 는 문서 version 으로 ...」, 그리고 `policy` helper 와 `fakeBackend` 의 정책 분기.
- 더한다.
  - `help` 출력에 `sync-position-policy` 가 없다
  - `manageCandidateContext(["sync-position-policy"])` 는 사용법 오류로 거절된다
  - `put --key position-preferences` 는 `PUT /api/candidate-context/v1/documents/position-preferences` 한 번만 보내고 결과가 `{ documentKey, version, updatedAt }` 뿐이다. `/api/positions/v1/analysis-policy` 를 부르지 않는다
- 「다른 키의 put 은 분석 정책을 건드리지 않는다」 는 남긴다.

`scripts/position-recommender/position_run.test.ts`

- 「collect는 후보자 맥락 확인이 실패하면 ...」 테스트가 던지는 오류 문장을 `"후보자 맥락 문서가 없다: position-preferences"` 로 바꾸고 단언도 그 문장으로 맞춘다. 기준 버전이 다르다는 오류는 더 생기지 않는다.

`scripts/position-recommender/configure_position_analysis_policy.test.ts` 신규

- 같은 정책 객체는 같은 키를 낸다
- `staleAfterDays` 만 다른 두 정책은 다른 키를 낸다
- 키가 `analysis-policy:` 로 시작하고 뒤가 64자리 hex 다

  fixture 의 정책 객체는 `analysisPolicySchema` 를 통과하는 모양으로 쓴다. 이 phase 에서는 `candidateContextVersion` 을 담는다.

## 검증

```bash
# cwd: 저장소 루트
bun test \
  ./career-os/scripts/candidate-context/position-context.test.ts \
  ./career-os/scripts/candidate-context/manage_candidate_context.test.ts \
  ./career-os/scripts/position-recommender/position_run.test.ts \
  ./career-os/scripts/position-recommender/configure_position_analysis_policy.test.ts \
  ./career-os/scripts/position-recommender/skill_doc.test.ts \
  ./career-os/scripts/lib/skill_doc_paths.test.ts
bun test ./career-os/scripts/candidate-context ./career-os/scripts/position-recommender
bunx tsc --noEmit
```

셋 다 종료 코드 0 이어야 한다.
첫 명령은 이 phase 가 고친 테스트와 스킬 문서를 검사하는 테스트를 이름으로 실행한다. `skill_doc_paths.test.ts` 는 스킬 문서의 경로 참조가 실제로 있는지 본다.
둘째 명령은 두 디렉터리의 나머지 테스트가 함께 깨지지 않았는지 본다.

```bash
# cwd: 저장소 루트
! git grep -n "syncPositionPolicy\|SYNC_POSITION_POLICY_COMMAND\|sync-position-policy\|position-policy" -- \
  career-os/scripts/candidate-context/position-context.ts \
  career-os/scripts/candidate-context/manage_candidate_context.ts \
  career-os/scripts/position-recommender/position_run.ts \
  career-os/scripts/position-recommender/configure_position_analysis_policy.ts \
  career-os/.claude
! git grep -n "candidateContextVersion" -- career-os/scripts/position-recommender/configure_position_analysis_policy.ts career-os/scripts/candidate-context/manage_candidate_context.ts
test ! -e career-os/scripts/candidate-context/position-policy.ts
test ! -e career-os/scripts/candidate-context/position-policy.test.ts
git diff --quiet -- career-os/services
```

모두 종료 코드 0 이어야 한다.
첫 명령의 대상에 테스트 파일을 넣지 않는다. `manage_candidate_context.test.ts` 가 명령이 없어졌다는 것을 단언하려고 명령 이름을 문자열로 담기 때문이다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `career-os/scripts/candidate-context/position-policy.ts` | 삭제 |
| `career-os/scripts/candidate-context/position-policy.test.ts` | 삭제 |
| `career-os/scripts/candidate-context/position-context.ts` | 신규 |
| `career-os/scripts/candidate-context/position-context.test.ts` | 신규 |
| `career-os/scripts/candidate-context/manage_candidate_context.ts` | 수정 |
| `career-os/scripts/candidate-context/manage_candidate_context.test.ts` | 수정 |
| `career-os/scripts/position-recommender/position_run.ts` | 수정 |
| `career-os/scripts/position-recommender/position_run.test.ts` | 수정 |
| `career-os/scripts/position-recommender/configure_position_analysis_policy.ts` | 수정 |
| `career-os/scripts/position-recommender/configure_position_analysis_policy.test.ts` | 신규 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
