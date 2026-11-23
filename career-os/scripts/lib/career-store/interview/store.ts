import type { CareerDatabase } from "../database.ts";
import { CareerStoreError } from "../errors.ts";
import { runWithReceipt } from "../receipts.ts";
import { parseRequest } from "../validate.ts";
import { nextTopicProgress, seoulDate } from "./review-schedule.ts";
import {
  attemptBodySchema,
  interviewDrillTypeSchema,
  personalQuestionBodySchema,
  type InterviewQuestion,
  type TopicProgress,
} from "./schema.ts";

export type AttemptResult = { attemptId: string; evaluatedOn: string; progress: TopicProgress };
export type PersonalQuestionUpsertResult = {
  questionId: string;
  drillType: TopicProgress["drillType"];
  topic: string;
  enabled: boolean;
  updatedAt: string;
};

type ProgressRow = {
  drill_type: TopicProgress["drillType"];
  topic: string;
  pass_count: number;
  fail_count: number;
  next_review_date: string | null;
  last_passed_date: string | null;
};

function progress(row: ProgressRow): TopicProgress {
  return {
    drillType: row.drill_type,
    topic: row.topic,
    passCount: Number(row.pass_count),
    failCount: Number(row.fail_count),
    nextReviewDate: row.next_review_date,
    lastPassedDate: row.last_passed_date,
  };
}

const PROGRESS_COLUMNS =
  "drill_type, topic, pass_count, fail_count, next_review_date, last_passed_date";

/**
 * 면접 연습의 저장 모듈이다. 커리어 Backend 의 HTTP 경로 하나가 메서드 하나이고
 * 입력과 출력이 그 요청·응답 본문과 같다(ADR-146). 복습 간격 규칙은 `review-schedule.ts` 가 갖는다.
 */
export class InterviewStore {
  constructor(
    private readonly db: CareerDatabase,
    private readonly now: () => Date = () => new Date(),
  ) {}

  /** `GET /progress?drillType=` */
  async listProgress(drillType: unknown): Promise<{ items: TopicProgress[] }> {
    const type = parseRequest(interviewDrillTypeSchema, drillType);
    const rows = this.db.all<ProgressRow>(
      `SELECT ${PROGRESS_COLUMNS} FROM interview_topic_progress WHERE drill_type = ? ORDER BY topic`,
      [type],
    );
    return { items: rows.map(progress) };
  }

  /**
   * `POST /attempts`. 멱등 키는 `attemptId` 다. 같은 기록을 다시 보내면 처음 응답을 돌려주고
   * 복습 상태를 한 번 더 바꾸지 않는다.
   */
  async createAttempt(body: unknown): Promise<AttemptResult> {
    const input = parseRequest(attemptBodySchema, body);
    return runWithReceipt(this.db, input.attemptId, input, 201, async () => {
      const evaluatedOn = seoulDate(this.now());
      const nowIso = this.now().toISOString();
      this.db.run(
        `INSERT OR IGNORE INTO interview_topic_progress
           (drill_type, topic, pass_count, fail_count, next_review_date, last_passed_date, updated_at)
         VALUES (?, ?, 0, 0, NULL, NULL, ?)`,
        [input.drillType, input.topic, nowIso],
      );
      const current = this.db.get<ProgressRow>(
        `SELECT ${PROGRESS_COLUMNS} FROM interview_topic_progress WHERE drill_type = ? AND topic = ?`,
        [input.drillType, input.topic],
      );
      if (!current) throw new CareerStoreError(500, "INTERNAL_ERROR", "복습 상태를 저장하지 못했습니다.");
      const next = nextTopicProgress(progress(current), input.score, evaluatedOn);
      this.db.run(
        `UPDATE interview_topic_progress
         SET pass_count = ?, fail_count = ?, next_review_date = ?, last_passed_date = ?, updated_at = ?
         WHERE drill_type = ? AND topic = ?`,
        [next.passCount, next.failCount, next.nextReviewDate, next.lastPassedDate, nowIso, input.drillType, input.topic],
      );
      this.db.run(
        `INSERT INTO interview_attempts
           (attempt_id, drill_type, topic, question_id, question, score, feedback, evaluated_on,
            target_company, target_role, target_value_axis, root_question_id, parent_question,
            follow_up_depth, follow_up_axis, stop_reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.attemptId,
          input.drillType,
          input.topic,
          input.questionId,
          input.question,
          input.score,
          input.feedback,
          evaluatedOn,
          input.targetCompany,
          input.targetRole,
          input.targetValueAxis,
          input.rootQuestionId,
          input.parentQuestion,
          input.followUpDepth,
          input.followUpAxis,
          input.stopReason,
          nowIso,
        ],
      );
      return {
        attemptId: input.attemptId,
        evaluatedOn,
        progress: { drillType: input.drillType, topic: input.topic, ...next },
      };
    });
  }

  /** `GET /personal-questions?drillType=`. 켜진 질문만 준다. */
  async listEnabledPersonalQuestions(drillType: unknown): Promise<{ items: InterviewQuestion[] }> {
    const type = parseRequest(interviewDrillTypeSchema, drillType);
    const rows = this.db.all<{ payload: string }>(
      `SELECT payload FROM interview_personal_questions
       WHERE drill_type = ? AND enabled = 1 ORDER BY question_id`,
      [type],
    );
    return { items: rows.map((row) => JSON.parse(row.payload) as InterviewQuestion) };
  }

  /**
   * `PUT /personal-questions/{questionId}`. 덮어쓰는 저장이라 응답 기록을 두지 않는다.
   * 본문으로 멱등 키를 만들면 끈 질문을 같은 본문으로 다시 켜는 요청이 첫 응답의 재생으로 끝난다.
   */
  async upsertPersonalQuestion(
    questionId: string,
    body: unknown,
  ): Promise<PersonalQuestionUpsertResult> {
    const input = parseRequest(personalQuestionBodySchema, body);
    if (questionId !== input.question.id) {
      throw new CareerStoreError(400, "BAD_REQUEST", "questionId와 question.id가 같아야 합니다.");
    }
    return this.db.transaction(() => {
      const nowIso = this.now().toISOString();
      this.db.run(
        `INSERT INTO interview_personal_questions
           (question_id, drill_type, topic, enabled, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (question_id) DO UPDATE SET
           drill_type = excluded.drill_type, topic = excluded.topic, enabled = excluded.enabled,
           payload = excluded.payload, updated_at = excluded.updated_at`,
        [questionId, input.drillType, input.question.topic, input.enabled, JSON.stringify(input.question), nowIso, nowIso],
      );
      return {
        questionId,
        drillType: input.drillType,
        topic: input.question.topic,
        enabled: input.enabled,
        updatedAt: nowIso,
      };
    });
  }
}
