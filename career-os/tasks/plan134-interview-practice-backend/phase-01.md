# Phase 01. 면접 연습 table 과 `/api/interview/v1` 경로를 만든다

**Execution profile**: deep

## 목표

`fos_career` 에 면접 연습 table 셋을 만들고 `/api/interview/v1` 의 경로 넷을 연다.

이 phase 가 끝나면 `GET progress`, `POST attempts`, `GET personal-questions`,
`PUT personal-questions/:questionId` 가 동작하고, 연습 기록 한 번이 주제 복습 상태를 같은 transaction 에서 갱신한다.

**범위 외**: `scripts/` 의 저장소 구현과 CLI 는 Phase 02, 후보자 맥락과 스킬 문서는 Phase 03 이다. 운영 배포와 migration 적용은 이 plan 밖이다.

## 컨텍스트

커리어 Backend 는 `career-os/services/career-backend/` 의 NestJS 와 Prisma 서비스다.
공부 추천 모듈 `src/study/` 의 배치를 그대로 따른다.

| 무엇 | 따를 곳 |
| --- | --- |
| 모듈 등록 | `src/app.module.ts` 의 `imports` 에 `InterviewModule` 을 더한다 |
| controller | `src/study/study.controller.ts` 의 `@Controller("api/study/v1")` |
| zod 계약과 검증 pipe | `src/study/schema.ts`, `src/common/zod-validation.pipe.ts` |
| 저장 계층과 행 잠금 | `src/study/repository/study.repository.ts`. `isolationLevel: "ReadCommitted"` transaction 안에서 `SELECT ... FOR UPDATE` 로 잠근다 |
| 오류 | `src/common/api-error.ts` 의 `ApiError(status, code, message)`. 새 code 를 만들지 않고 `BAD_REQUEST` 를 쓴다 |
| migration | `prisma/migrations/<timestamp>_<이름>/migration.sql`. 가장 최근이 `20260928000000_study_schema` 다 |
| 테스트 격리 | `test/support/e2e-harness.ts` 의 `DATA_TABLES`. 자식 table 부터 적는다 |
| e2e 테스트 모양 | `test/study-sources.e2e.test.ts` 의 `startE2eHarness`, `harness.send`, `harness.clearAll` |

인증과 멱등은 전역이다. `src/bootstrap.ts` 가 모든 경로에 Bearer 인증을 걸고,
`src/app.module.ts` 의 `IdempotencyInterceptor` 가 본문이 있는 모든 요청에 `Idempotency-Key` 헤더를 요구하고 같은 key 의 재시도에 저장한 응답을 돌려준다.
새 경로는 따로 설정하지 않아도 둘 다 적용된다.

**근거 문서**: `docs/data-schema.md` 의 「면접 연습 table」 절,
`docs/flow.md` 의 「면접 연습 HTTP 계약」 절과 「커리어 Backend」 절,
`docs/adr/ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md`

## 의도 메모

- 복습 단위는 주제다. 질문별 복습으로 바꾸지 않는다. 선별 규칙을 바꾸는 일은 이 plan 의 범위가 아니다.
- 복습일 계산을 서버에 두는 이유는 기록 추가와 주제 갱신을 한 transaction 으로 묶어 동시 기록이 어긋나지 않게 하기 위해서다. client 가 계산한 값을 받지 않는다.
- 평가일은 서버가 Asia/Seoul 기준으로 정한다. 프로세스 시간대는 UTC 로 고정돼 있으므로(`src/main.ts`, `src/utc.ts`) `Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" })` 처럼 시간대를 명시해 날짜를 만든다. 테스트가 시각을 고정할 수 있게 시각 공급 함수를 주입받는다.
- `interview.service.ts` 에 `@Injectable()` 인 `InterviewClock` 클래스를 두고 `now(): Date` 가 `new Date()` 를 돌려주게 한다. `InterviewModule` 의 providers 에 등록하고 service 생성자로 주입한다. e2e 는 `harness.app.get(InterviewClock).now = () => new Date("2026-09-27T15:30:00Z")` 로 요청 시각을 고정한다. 별도 config token 은 만들지 않는다.
- 개인 질문의 `answerSignals`, `followUps` 를 자식 table 로 나누지 않는다. ADR-129 가 기각했다.
- `src/config/config.module.ts` 의 `RECOMMENDATION_CONFIG` 는 다른 작업이 이름을 바꾸는 중이다. 이 모듈에서 import 하지 않는다. 설정값이 필요 없게 설계한다.
- 행을 지우는 경로는 만들지 않는다. 개인 질문은 `enabled` 로 끈다.

## Blocked 조건

- 테스트용 MySQL 에 접속할 수 없으면 `PHASE_BLOCKED: 테스트 DB 없음` 을 출력하고 종료한다. 테스트를 건너뛰어 통과로 만들지 않는다.

## 작업 항목

### 1. `services/career-backend/prisma/migrations/20260929000000_interview_schema/migration.sql` 신규

`docs/data-schema.md` 의 「면접 연습 table」 절 그대로 table 셋을 만든다.
기존 migration 처럼 `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` 를 붙인다.

- `interview_topic_progress`: `PRIMARY KEY (drill_type, topic)`. `pass_count`, `fail_count` 는 `INT UNSIGNED NOT NULL DEFAULT 0`
- `interview_attempts`: `PRIMARY KEY (attempt_id)`, `CONSTRAINT fk_interview_attempts_progress FOREIGN KEY (drill_type, topic) REFERENCES interview_topic_progress(drill_type, topic) ON DELETE RESTRICT ON UPDATE RESTRICT`, `INDEX idx_interview_attempts_topic (drill_type, topic, created_at)`, `CONSTRAINT chk_interview_attempts_depth CHECK (follow_up_depth IS NULL OR follow_up_depth BETWEEN 1 AND 4)`
- `interview_personal_questions`: `PRIMARY KEY (question_id)`, `INDEX idx_interview_personal_questions_type (drill_type, enabled)`

`CHECK` 제약은 `schema.prisma` 가 표현하지 못하므로 SQL 에만 둔다. `README.md` 의 「migration 을 만들고 고치는 규칙」 을 따른다.

### 2. `services/career-backend/prisma/schema.prisma` 수정

세 model 을 더한다. 이름은 table 이름과 같게 둔다(`study_sources` 와 같은 관례).
`interview_topic_progress` 와 `interview_attempts` 사이의 relation 을 적는다.

### 3. `services/career-backend/src/interview/review-schedule.ts` 신규

```ts
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;
export type InterviewScore = "pass" | "shallow" | "fail" | "unknown";
export type TopicProgressState = {
  passCount: number;
  failCount: number;
  nextReviewDate: string | null;   // YYYY-MM-DD
  lastPassedDate: string | null;   // YYYY-MM-DD
};
export function nextTopicProgress(current: TopicProgressState, score: InterviewScore, evaluatedOn: string): TopicProgressState;
export function seoulDate(now: Date): string;
```

- `pass`: `passCount + 1`, `lastPassedDate = evaluatedOn`, `nextReviewDate = evaluatedOn + REVIEW_INTERVALS_DAYS[min(passCount - 1, 5)]` (새 `passCount` 기준)
- 그 밖: `failCount + 1`, `nextReviewDate = evaluatedOn + 1일`
- 날짜 더하기는 UTC 자정 기준 `Date` 로 계산해 시간대 영향을 받지 않게 한다
- `career-os/scripts/` 의 파일 저장소 구현도 이 파일을 import 한다. NestJS, Prisma, 설정 모듈을 import 하지 않는 순수 함수로 둔다

### 4. `services/career-backend/src/interview/schema.ts` 신규

zod 계약과 응답 타입을 둔다. `scripts/` 가 이 파일을 import 하므로 NestJS 나 Prisma 를 import 하지 않는다. zod 만 쓴다.

- `interviewDrillTypeSchema = z.enum(["tech", "behavioral"])`
- `interviewScoreSchema = z.enum(["pass", "shallow", "fail", "unknown"])`
- `interviewQuestionSchema`: 공개 질문 은행 질문 항목. `id`, `topic`, `category`, `difficulty`(`basic|intermediate|advanced`), `question`, `intent`, `answerSignals`(1개 이상의 문자열) 필수. `bar`(`production|large-scale|global-scale`), `followUps`, `positionFitHint`, `tags`, `sequenceHint`(`opening|early|middle|late|closing`) 선택. 모르는 칸은 거절한다(`.strict()`). 필드 목록은 `career-os/scripts/interview-drill/drill-engine.ts` 의 `DrillQuestion` 에서 `origin`, `evidenceBoundary`, `sourceScope` 를 뺀 것이다
- `progressQuerySchema`: `{ drillType }`
- `attemptBodySchema`: `attemptId`(UUID), `drillType`, `questionId`(100자 이내, 빈 문자열 불가), `topic`(100자 이내, 빈 문자열 불가), `question`(2000자 이내, 빈 문자열 불가), `score`, 선택 `feedback`(500자 이내, 빈 문자열 불가), `targetCompany`, `targetRole`, `targetValueAxis`(각 100자 이내, 빈 문자열 불가), `rootQuestionId`(100자 이내, 빈 문자열 불가), `parentQuestion`(2000자 이내, 빈 문자열 불가), `followUpDepth`(1 이상 4 이하 정수), `followUpAxis`(`clarification|decision|counterexample|operations|evidence-boundary`), `stopReason`(`depth-limit|needs-study|answer-complete|session-ended`). `.strict()`
- `personalQuestionBodySchema`: `{ enabled: boolean, drillType, question: interviewQuestionSchema }`. `.strict()`
- 응답 스키마: `topicProgressSchema`(`drillType`, `topic`, `passCount`, `failCount`, `nextReviewDate`, `lastPassedDate`), `progressResponseSchema`(`{ items }`), `attemptResponseSchema`(`{ attemptId, evaluatedOn, progress }`), `personalQuestionsResponseSchema`(`{ items: question[] }`), `personalQuestionUpsertResponseSchema`(`{ questionId, drillType, topic, enabled, updatedAt }`)

### 5. `services/career-backend/src/interview/repository/interview.repository.ts` 신규

- `listProgress(drillType)`: 주제 순으로 모두 읽는다
- `recordAttempt(input, evaluatedOn)`: `ReadCommitted` transaction 안에서
  1. `INSERT IGNORE` 로 주제 행을 0 값으로 보장한다
  2. `SELECT ... FROM interview_topic_progress WHERE drill_type = ? AND topic = ? FOR UPDATE`
  3. `nextTopicProgress` 로 새 값을 계산해 `UPDATE`
  4. `interview_attempts` 에 `INSERT`
  5. 갱신한 주제 상태를 돌려준다
- `listEnabledPersonalQuestions(drillType)`: `enabled = true` 만, `question_id` 순
- `upsertPersonalQuestion(questionId, drillType, enabled, payload)`: 있으면 `drill_type`, `topic`, `enabled`, `payload`, `updated_at` 을 덮어쓴다

### 6. `services/career-backend/src/interview/interview.service.ts`, `interview.controller.ts`, `interview.module.ts` 신규

`@Controller("api/interview/v1")` 아래 경로 넷이다. 계약은 `docs/flow.md` 의 「면접 연습 HTTP 계약」 표가 정답이다.

- `POST attempts`: `@Headers("idempotency-key")` 가 본문 `attemptId` 와 다르면 `ApiError(400, "BAD_REQUEST", ...)`. 평가일은 주입받은 시각 공급 함수와 `seoulDate` 로 정한다
- `PUT personal-questions/:questionId`: 경로의 `questionId` 와 `question.id` 가 다르면 `400`. `payload` 에는 `question` 을 그대로 저장하고 행의 `topic` 은 `question.topic` 에서 가져온다
- 요청 본문에는 `docs/flow.md` 의 HTTP 계약대로 `enabled`, `drillType`, `question` 을 받는다. `question` 항목에는 `drillType` 을 중복해 넣지 않는다
- 목록 응답은 `Cache-Control: no-store` 등 공통 동작을 따로 구현하지 않는다. 전역 설정이 한다

### 7. `services/career-backend/src/app.module.ts` 수정

`imports` 에 `InterviewModule` 을 더한다.

### 8. `services/career-backend/test/support/e2e-harness.ts` 수정

`DATA_TABLES` 맨 앞에 `"interview_attempts"`, `"interview_topic_progress"`, `"interview_personal_questions"` 를 더한다. 자식인 `interview_attempts` 가 먼저다.

### 9. 이 phase 를 검증하는 테스트

`services/career-backend/src/interview/review-schedule.test.ts` 신규. 단위 테스트다.

- `pass` 를 연속 7번 받으면 간격이 1, 3, 7, 14, 30, 60, 60일이다
- `shallow`, `fail`, `unknown` 은 `failCount` 를 올리고 다음 날로 둔다
- `seoulDate(new Date("2026-09-27T15:30:00Z"))` 가 `"2026-09-28"` 이다

`services/career-backend/test/interview.e2e.test.ts` 신규.

- 빈 DB 에서 `GET progress?drillType=tech` 가 `{ items: [] }`
- `POST attempts` 로 `pass` 를 기록하면 응답의 `progress` 가 `passCount: 1`, `nextReviewDate` 가 평가일 다음 날이고, `GET progress` 에 같은 값이 보인다
- 같은 `Idempotency-Key` 와 같은 본문으로 다시 보내면 같은 응답이고 `passCount` 가 1 그대로다
- `Idempotency-Key` 와 본문 `attemptId` 가 다르면 `400`
- 같은 주제에 서로 다른 `attemptId` 로 `pass` 두 건을 `Promise.all` 로 동시에 보내면 `passCount` 가 2 다
- `PUT personal-questions/q1` 로 켠 질문이 `GET personal-questions?drillType=behavioral` 에 나오고, `enabled: false` 로 다시 보내면 목록에서 빠진다
- 경로 `questionId` 와 `question.id` 가 다르면 `400`, 질문 항목에 모르는 칸이 있으면 `400`

## 검증

```bash
# cwd: career-os/services/career-backend
npm run typecheck
# 로컬 fos_career_test 에만 신규 migration 을 적용한다. 운영 DB 에는 적용하지 않는다.
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
  npx prisma migrate deploy
DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
CAREER_BACKEND_TEST_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_test" \
SHADOW_DATABASE_URL="mysql://root:plan125@127.0.0.1:13400/fos_career_shadow" \
  npm test
```

모두 종료 코드 0 이어야 한다. 테스트 DB 는 로컬 container `plan125-mysql`(port 13400)이다.
`npm test` 결과에 `interview.e2e.test.ts` 와 `review-schedule.test.ts` 가 실행된 것이 보여야 한다.

```bash
# cwd: 저장소 루트
! git grep -n "RECOMMENDATION_CONFIG" -- career-os/services/career-backend/src/interview
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/services/career-backend/prisma/migrations/20260929000000_interview_schema/migration.sql` | 신규 |
| `career-os/services/career-backend/prisma/schema.prisma` | 수정 |
| `career-os/services/career-backend/src/interview/review-schedule.ts` | 신규 |
| `career-os/services/career-backend/src/interview/schema.ts` | 신규 |
| `career-os/services/career-backend/src/interview/repository/interview.repository.ts` | 신규 |
| `career-os/services/career-backend/src/interview/interview.service.ts` | 신규 |
| `career-os/services/career-backend/src/interview/interview.controller.ts` | 신규 |
| `career-os/services/career-backend/src/interview/interview.module.ts` | 신규 |
| `career-os/services/career-backend/src/app.module.ts` | 수정 |
| `career-os/services/career-backend/test/support/e2e-harness.ts` | 수정 |
| `career-os/services/career-backend/src/interview/review-schedule.test.ts` | 신규 |
| `career-os/services/career-backend/test/interview.e2e.test.ts` | 신규 |
