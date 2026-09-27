# Phase 02. 면접 연습 저장소 경계와 select, record, personal 명령을 만든다

**Execution profile**: standard

## 목표

`scripts/interview-drill/drill-engine.ts` 가 주제별 복습 상태, 연습 기록과 개인 질문을 저장소 interface 로만 읽고 쓰게 한다.
구현은 Backend 와 파일 둘이고 `CAREER_STORE` 로 하나를 고른다.
에이전트가 즉석 스크립트 없이 명령 하나로 질문을 고르고 결과를 기록할 수 있게 한다.

**범위 외**: Backend 코드는 Phase 01, 후보자 맥락과 `doctor` 명령과 스킬 문서는 Phase 03 이다.
운영 배포, hermes 의 `CAREER_STORE` 설정, 기존 개인 질문 5건 반영과 비공개 작업본의 jsonl 삭제는 이 plan 밖의 운영 작업이다.

## 컨텍스트

- Phase 01 이 `career-os/services/career-backend/src/interview/schema.ts` 에 zod 계약을, `review-schedule.ts` 에 복습일 규칙 `nextTopicProgress`, `seoulDate` 를 두었다. 둘 다 순수 모듈이고 `scripts/` 가 직접 import 한다. 포지션 client 가 `services/career-backend/src/positions/schema.ts` 를 import 하는 것과 같은 방식이다
- 포지션 client `career-os/scripts/position-recommender/career-backend/client.ts` 의 `CareerBackendClient.request` 가 인증 헤더, `Idempotency-Key`, 5xx 와 네트워크 오류의 3회 재시도, 응답 zod 검사, `CareerBackendClientError(status, code, message)` 를 담당한다
- 연결값은 `career-os/scripts/lib/career-backend-config.ts` 의 `resolveCareerBackendConnection(environment)` 가 검증해 `{ baseUrl, token }` 을 돌려준다
- 지금 `drill-engine.ts` 는 `state/drill-progress.json` 을 읽고 쓰는 `loadDrillProgress`, `updateDrillProgress`, `state/drill-log-YYYY-MM-DD.jsonl` 에 쓰는 `recordDrillLog`, `library/question-bank/{tech|behavioral}-personal.jsonl` 을 읽는 `mergePersonalQuestions` 를 가진다. 기록 명령은 없고, 직접 실행하면 질문 목록만 사람이 읽는 글로 찍는다
- `selectQuestions(drillType, drillProgress, maxCount, applicationDirectory, targetBar)` 의 선별 규칙은 바꾸지 않는다. `DrillProgress` 는 주제를 키로 하는 `Record<string, DrillProgressEntry>` 다
- `today()` 가 UTC 날짜를 쓴다. 저장소의 평가일은 Asia/Seoul 이므로 복습 대상 비교도 Asia/Seoul 날짜로 맞춘다
- `career-os/scripts/lib/cli-contract.test.ts` 의 「import는 실행하거나 출력하지 않는다」 가 `drill-engine.ts` 를 import 만 했을 때 출력이 없어야 한다고 단언한다

**근거 문서**: `docs/data-schema.md` 의 「면접 연습 저장소」 「면접 연습 파일」 절,
`docs/flow.md` 의 「답변 연습」 절과 「면접 연습 HTTP 계약」 절,
`docs/code-architecture.md` 의 「interview-practice」 절,
`docs/adr/ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md`

## 의도 메모

- 저장소는 `CAREER_STORE` 로만 고른다. `CAREER_BACKEND_URL` 유무로 추측하지 않는다. ADR-129 가 기각했다
- `backend` 를 고른 실행이 Backend 에 닿지 못하면 종료 코드 1 이다. 파일 구현으로 바꾸거나 복습 상태 없이 질문을 고르는 대체 동작을 만들지 않는다
- 두 구현은 같은 계약 테스트를 통과해야 한다. 한 테스트 묶음을 구현 둘에 돌린다
- 파일 구현도 복습일을 스스로 계산하지 않고 `review-schedule.ts` 를 import 한다. 규칙이 두 벌이 되면 두 구현의 결과가 어긋난다
- `attemptId` 는 에이전트가 만들어 넘긴다. 같은 연습을 다시 기록할 때 같은 값을 써야 한 번만 반영되기 때문이다. CLI 가 몰래 만들면 재시도가 두 번 반영된다. `--attempt-id` 가 없으면 사용법 오류다
- HTTP 요청 코드를 세 번째로 복사하지 않는다. 포지션 client 의 `request` 와 같은 동작을 `career-os/scripts/lib/career-backend-http.ts` 로 새로 두고 면접 client 만 이것을 쓴다. 포지션과 공부 client 를 옮기는 일은 이 plan 의 범위가 아니다
- 출력은 에이전트가 읽으므로 JSON 이다

## 작업 항목

### 1. `career-os/scripts/lib/career-backend-http.ts` 신규

포지션 client 의 `request` 와 오류 타입을 옮겨 적은 공용 함수다.

```ts
export class CareerBackendHttpError extends Error {
  constructor(readonly status: number | null, readonly code: string, message: string);
}
export type CareerBackendHttpOptions = {
  baseUrl: string;
  token: string;
  timeoutMs?: number;   // 기본 15_000
  fetcher?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
};
export async function careerBackendRequest<T>(
  options: CareerBackendHttpOptions,
  method: "GET" | "POST" | "PUT",
  path: string,
  body: unknown,
  idempotencyKey: string | undefined,
  schema: z.ZodType<T>,
): Promise<T>;
```

재시도 규칙, 오류 code(`INVALID_RESPONSE`, `HTTP_ERROR`, `NETWORK_ERROR`)와 메시지는 포지션 client 와 같게 둔다.

### 2. `career-os/scripts/interview-drill/career-backend/client.ts` 신규

```ts
export class InterviewBackendClient {
  constructor(options: CareerBackendHttpOptions);
  listProgress(drillType: DrillType): Promise<TopicProgress[]>;
  recordAttempt(body: AttemptBody): Promise<AttemptResponse>;      // Idempotency-Key = body.attemptId
  listPersonalQuestions(drillType: DrillType): Promise<InterviewQuestion[]>;
  upsertPersonalQuestion(questionId: string, body: PersonalQuestionBody): Promise<PersonalQuestionUpsertResponse>;
}
```

- 경로는 `api/interview/v1/progress?drillType=`, `api/interview/v1/attempts`, `api/interview/v1/personal-questions?drillType=`, `api/interview/v1/personal-questions/{encodeURIComponent(questionId)}` 다
- `upsertPersonalQuestion` 의 `Idempotency-Key` 는 `personal-question:` 뒤에 본문 JSON 의 SHA-256 hex 를 붙인다
- 타입과 응답 스키마는 `services/career-backend/src/interview/schema.ts` 에서 import 한다

### 3. `career-os/scripts/interview-drill/store/port.ts` 신규

```ts
export interface InterviewPracticeStore {
  readonly kind: "backend" | "file";
  listProgress(drillType: DrillType): Promise<TopicProgress[]>;
  recordAttempt(body: AttemptBody): Promise<AttemptResponse>;
  listPersonalQuestions(drillType: DrillType, options?: { includeDisabled?: boolean }): Promise<PersonalQuestionRecord[]>;
  upsertPersonalQuestion(questionId: string, body: PersonalQuestionBody): Promise<PersonalQuestionUpsertResponse>;
}
export type PersonalQuestionRecord = { questionId: string; drillType: DrillType; enabled: boolean; question: InterviewQuestion };
```

`TopicProgress`, `AttemptBody`, `AttemptResponse`, `PersonalQuestionBody`, `PersonalQuestionUpsertResponse`, `InterviewQuestion` 은 Phase 01 의 `schema.ts` 타입이다.

### 4. `career-os/scripts/interview-drill/store/backend-store.ts` 신규

`InterviewBackendClient` 를 감싼다. `listPersonalQuestions` 는 켜진 질문만 받으므로 `includeDisabled: true` 를 받으면 `UsageError`(`scripts/lib/cli.ts`)가 아니라 일반 `Error` 로 「Backend 저장소는 꺼진 개인 질문을 조회하지 않는다」 를 던진다. `personal disable` 은 켜진 질문 목록에서 찾는다.

### 5. `career-os/scripts/interview-drill/store/file-store.ts` 신규

`docs/data-schema.md` 의 「면접 연습 파일」 절 그대로다.

- 생성자는 디렉터리 경로와 시각 공급 함수를 받는다
- 파일이 없으면 빈 상태로 본다. 첫 쓰기에서 디렉터리를 만든다
- `recordAttempt`: 같은 `attemptId` 가 `attempts.jsonl` 에 있으면 그 줄로 응답을 다시 만들어 돌려주고 아무것도 쓰지 않는다. 없으면 `seoulDate(now())` 로 평가일을 정하고, `nextTopicProgress` 로 주제를 갱신해 `topic-progress.json` 을 교체한 뒤 `attempts.jsonl` 에 한 줄을 더한다
- 입력은 Phase 01 의 zod 스키마(`attemptBodySchema`, `personalQuestionBodySchema`)로 먼저 검사한다. Backend 와 같은 입력을 거절해야 한다
- JSON 파일은 같은 디렉터리의 임시 파일에 쓰고 `renameSync` 로 교체한다

### 6. `career-os/scripts/interview-drill/store/index.ts` 신규

```ts
export function createInterviewPracticeStore(environment?: Record<string, string | undefined>): InterviewPracticeStore;
```

- `CAREER_STORE=backend`: `resolveCareerBackendConnection(environment)` 로 연결값을 얻어 Backend 구현을 만든다
- `CAREER_STORE=file`: `CAREER_STORE_DIR` 이 있으면 그 경로, 없으면 `career-os/state/interview-practice/` 로 파일 구현을 만든다. 경로는 저장소 루트를 기준으로 이 파일 위치에서 계산한다(`drill-engine.ts` 의 `careerOsRoot()` 와 같은 방식)
- 값이 없거나 둘 중 하나가 아니면 「CAREER_STORE 는 backend 나 file 이어야 한다. drill-engine.ts doctor 로 설정을 점검한다.」 로 실패한다

### 7. `career-os/scripts/interview-drill/drill-engine.ts` 수정

- 삭제: `drillProgressPath`, `loadDrillProgress`, `drillLogPath`, `recordDrillLog`, `updateDrillProgress`, `updateDrillProgressState`, `mergePersonalQuestions`, `REVIEW_INTERVALS_DAYS`, `nextReviewDays`, `addDays`, `DrillLogEntry` 와 그 `studyPackDispatched`, 파일 상단 주석의 `state/`, `library/question-bank/` 의존 파일 줄
- `today()` 를 Phase 01 의 `seoulDate(new Date())` 로 바꾼다
- `loadQuestionBank(drillType, applicationDirectory, personalQuestions: DrillQuestion[] = [])` 로 바꾼다. 개인 질문은 인자로 받아 `sourceScope: "personal"` 을 붙여 합친다
- `selectQuestions(drillType, drillProgress, maxCount, applicationDirectory, targetBar, personalQuestions = [])` 로 마지막 인자를 더한다. 선별 규칙은 그대로다
- `toDrillProgress(items: TopicProgress[]): DrillProgress` 를 더한다. `passCount` → `pass_count`, `failCount` → `fail_count`, `nextReviewDate` → `next_review_date`, `lastPassedDate` → `last_passed`
- `export async function runDrillCli(argv: string[], deps: { store: InterviewPracticeStore; readFile: (path: string) => string }): Promise<unknown>` 를 더한다

| 하위 명령 | 인자 | 하는 일 | 돌려주는 값 |
| --- | --- | --- | --- |
| `select <tech\|behavioral>` | `--application-dir`, `--target-bar`, `--count`(기본 5, 1 이상 10 이하) | `listProgress` 와 `listPersonalQuestions` 결과로 `selectQuestions` 를 부른다 | `{ store, drillType, today, questions: [{ ...질문, dueForReview: boolean }] }`. `store` 는 `store.kind`. `dueForReview` 는 그 주제의 `next_review_date` 가 오늘 이전이거나 오늘이면 참 |
| `record` | 필수 `--attempt-id`, `--drill-type`, `--question-id`, `--topic`, `--question`, `--score`. 선택 `--feedback`, `--target-company`, `--target-role`, `--target-value-axis`, `--root-question-id`, `--parent-question`, `--follow-up-depth`, `--follow-up-axis`, `--stop-reason` | 인자를 `AttemptBody` 로 옮겨 zod 로 검사한 뒤 `recordAttempt` 를 부른다 | 저장소 응답 그대로 |
| `personal add` | `--file <path>` | `.jsonl` 이면 한 줄에 질문 하나, `.json` 이면 질문 하나나 질문 배열. 각 질문은 필수 `drillType` 칸을 가지고, 그 칸을 뺀 나머지를 `interviewQuestionSchema` 로 검사한다. 모두 통과하면 한 건씩 `upsertPersonalQuestion(id, { enabled: true, drillType, question })` 를 부른다. 한 건이라도 틀리면 아무것도 저장하지 않고 사용법 오류다 | `{ saved: number, questionIds: string[] }` |
| `personal disable` | `--question-id` | 두 `drillType` 의 개인 질문에서 찾아 `enabled: false` 로 저장한다. 없으면 오류 | `{ disabled: questionId }` |

- 하위 명령이 없거나 모르는 값이면 사용법을 stderr 에 쓰고 종료 코드 2 다
- `import.meta.main` 블록은 `runDrillCli(process.argv.slice(2), { store: createInterviewPracticeStore(), readFile })` 결과를 JSON 으로 stdout 에 쓴다. 인자 오류는 종료 코드 2, 그 밖의 오류는 메시지를 stderr 에 쓰고 종료 코드 1 이다. Backend 연결 오류 메시지는 「커리어 Backend에 연결하지 못했습니다. 연습 결과는 기록되지 않았습니다.」 로 시작한다
- import 만 했을 때는 아무것도 출력하지 않는다. 저장소 생성도 `import.meta.main` 안에서만 한다

### 8. 이 phase 를 검증하는 테스트

`career-os/scripts/interview-drill/store/store-contract.test.ts` 신규. 저장소 interface 만 쓰는 테스트 묶음을 `describeStoreContract(name, makeStore)` 로 만든다.

- 이 파일에서는 파일 구현(임시 디렉터리, 고정 시각)에 돌린다
- Backend 구현에 같은 묶음을 돌리는 일은 Phase 01 의 `test/interview.e2e.test.ts` 가 실제 Backend 로 같은 경우를 검사하므로 여기서 하지 않는다. Backend 구현의 경로와 헤더는 아래 `client.test.ts` 가 검사한다
- `pass` 기록 뒤 `listProgress` 의 `passCount` 가 1, `nextReviewDate` 가 평가일 다음 날이다
- 같은 `attemptId` 로 두 번 기록하면 `passCount` 가 1 그대로다
- 켠 개인 질문이 목록에 나오고 끄면 빠진다
- 형식이 틀린 기록은 저장하지 않고 거절한다

`career-os/scripts/interview-drill/store/index.test.ts` 신규.

- `CAREER_STORE` 가 없으면 `doctor` 를 안내하는 메시지로 실패한다
- `CAREER_STORE=file` 이고 `CAREER_STORE_DIR` 을 주면 그 경로의 파일 구현이다

`career-os/scripts/interview-drill/drill-engine.test.ts` 수정.

- 「답변 연습 복습 상태」 describe 를 지운다. 복습일 규칙은 Backend 의 `review-schedule.test.ts` 가 검사한다
- 임시 디렉터리의 파일 구현으로 `runDrillCli(["select", "behavioral"], ...)` 를 부르면 개인 질문이 결과에 들어가고 `sourceScope` 가 `"personal"` 이다
- 과거 날짜로 복습일이 잡힌 주제의 질문은 `dueForReview` 가 참이다
- `--attempt-id` 없는 `record` 는 사용법 오류다
- 한 줄이 형식에 맞지 않는 jsonl 로 `personal add` 를 부르면 아무것도 저장되지 않는다
- 기존 「지원별 질문 선택」 테스트는 새 시그니처로 옮겨 그대로 통과시킨다

`career-os/scripts/interview-drill/career-backend/client.test.ts` 신규.

- 가짜 `fetcher` 로 `recordAttempt` 가 `POST api/interview/v1/attempts` 에 `Idempotency-Key: <attemptId>` 와 Bearer 헤더를 보낸다
- `fetcher` 가 계속 예외를 던지면 `CareerBackendHttpError` 의 code 가 `NETWORK_ERROR` 다

## 검증

```bash
# cwd: 저장소 루트
PATH="$HOME/.bun/bin:$PATH" bun test career-os/scripts
PATH="$HOME/.bun/bin:$PATH" bunx tsc --noEmit
! git grep -nE "drill-progress|drill-log|personal\.jsonl|library/question-bank" -- career-os/scripts/interview-drill
```

모두 종료 코드 0 이어야 한다.
마지막 명령은 면접 연습 코드에 옛 파일 경로가 남지 않았는지 본다.
`scripts/career-workspace/tests/` 는 release 동기화 테스트가 임의 파일 이름으로 `state/drill-progress.json` 을 쓰는 것이라 대상이 아니다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/lib/career-backend-http.ts` | 신규 |
| `career-os/scripts/interview-drill/career-backend/client.ts` | 신규 |
| `career-os/scripts/interview-drill/career-backend/client.test.ts` | 신규 |
| `career-os/scripts/interview-drill/store/port.ts` | 신규 |
| `career-os/scripts/interview-drill/store/backend-store.ts` | 신규 |
| `career-os/scripts/interview-drill/store/file-store.ts` | 신규 |
| `career-os/scripts/interview-drill/store/index.ts` | 신규 |
| `career-os/scripts/interview-drill/store/store-contract.test.ts` | 신규 |
| `career-os/scripts/interview-drill/store/index.test.ts` | 신규 |
| `career-os/scripts/interview-drill/drill-engine.ts` | 수정 |
| `career-os/scripts/interview-drill/drill-engine.test.ts` | 수정 |
