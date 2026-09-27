import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import { nextTopicProgress, type TopicProgressState } from "../review-schedule.js";
import type { AttemptBody, InterviewQuestion, TopicProgress } from "../schema.js";

type RawRow = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

function number(value: unknown): number {
  return Number(value);
}

function date(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return (value instanceof Date ? value : new Date(String(value))).toISOString().slice(0, 10);
}

function progress(row: RawRow): TopicProgress {
  return {
    drillType: row.drill_type as TopicProgress["drillType"],
    topic: String(row.topic),
    passCount: number(row.pass_count),
    failCount: number(row.fail_count),
    nextReviewDate: date(row.next_review_date),
    lastPassedDate: date(row.last_passed_date),
  };
}

@Injectable()
export class InterviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  reader(): DbClient {
    return this.prisma;
  }

  transaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback, {
      maxWait: 30_000,
      timeout: 30_000,
      isolationLevel: "ReadCommitted",
    });
  }

  async listProgress(drillType: TopicProgress["drillType"], client: DbClient): Promise<TopicProgress[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT drill_type, topic, pass_count, fail_count, next_review_date, last_passed_date
      FROM interview_topic_progress WHERE drill_type = ${drillType} ORDER BY topic
    `;
    return rows.map(progress);
  }

  async recordAttempt(input: AttemptBody, evaluatedOn: string): Promise<TopicProgress> {
    return this.transaction(async (tx) => {
      let rows = await this.lockProgress(input.drillType, input.topic, tx);
      if (rows.length === 0) {
        await tx.$executeRaw`
          INSERT INTO interview_topic_progress
            (drill_type, topic, pass_count, fail_count, next_review_date, last_passed_date, updated_at)
          VALUES (${input.drillType}, ${input.topic}, 0, 0, NULL, NULL, NOW(3))
          ON DUPLICATE KEY UPDATE topic = VALUES(topic)
        `;
        rows = await this.lockProgress(input.drillType, input.topic, tx);
      }
      const current = progress(rows[0]!) as TopicProgressState & TopicProgress;
      const next = nextTopicProgress(current, input.score, evaluatedOn);
      await tx.$executeRaw`
        UPDATE interview_topic_progress
        SET pass_count = ${next.passCount}, fail_count = ${next.failCount},
            next_review_date = ${next.nextReviewDate}, last_passed_date = ${next.lastPassedDate}, updated_at = NOW(3)
        WHERE drill_type = ${input.drillType} AND topic = ${input.topic}
      `;
      await tx.$executeRaw`
        INSERT INTO interview_attempts
          (attempt_id, drill_type, topic, question_id, question, score, feedback, evaluated_on,
           target_company, target_role, target_value_axis, root_question_id, parent_question,
           follow_up_depth, follow_up_axis, stop_reason, created_at)
        VALUES (${input.attemptId}, ${input.drillType}, ${input.topic}, ${input.questionId}, ${input.question},
                ${input.score}, ${input.feedback ?? null}, ${evaluatedOn}, ${input.targetCompany ?? null},
                ${input.targetRole ?? null}, ${input.targetValueAxis ?? null}, ${input.rootQuestionId ?? null},
                ${input.parentQuestion ?? null}, ${input.followUpDepth ?? null}, ${input.followUpAxis ?? null},
                ${input.stopReason ?? null}, NOW(3))
      `;
      return { drillType: input.drillType, topic: input.topic, ...next };
    });
  }

  async listEnabledPersonalQuestions(
    drillType: TopicProgress["drillType"],
    client: DbClient,
  ): Promise<InterviewQuestion[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT payload FROM interview_personal_questions
      WHERE drill_type = ${drillType} AND enabled = TRUE ORDER BY question_id
    `;
    return rows.map((row) => (typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload) as InterviewQuestion);
  }

  async upsertPersonalQuestion(
    questionId: string,
    drillType: TopicProgress["drillType"],
    enabled: boolean,
    payload: InterviewQuestion,
  ): Promise<{ questionId: string; drillType: TopicProgress["drillType"]; topic: string; enabled: boolean; updatedAt: string }> {
    return this.transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO interview_personal_questions
          (question_id, drill_type, topic, enabled, payload, created_at, updated_at)
        VALUES (${questionId}, ${drillType}, ${payload.topic}, ${enabled}, ${JSON.stringify(payload)}, NOW(3), NOW(3))
        ON DUPLICATE KEY UPDATE drill_type = VALUES(drill_type), topic = VALUES(topic), enabled = VALUES(enabled),
                                payload = VALUES(payload), updated_at = NOW(3)
      `;
      const rows = await tx.$queryRaw<RawRow[]>`
        SELECT question_id, drill_type, topic, enabled, updated_at
        FROM interview_personal_questions WHERE question_id = ${questionId}
      `;
      const row = rows[0]!;
      return {
        questionId: String(row.question_id),
        drillType: row.drill_type as TopicProgress["drillType"],
        topic: String(row.topic),
        enabled: Boolean(row.enabled),
        updatedAt: (row.updated_at instanceof Date ? row.updated_at : new Date(String(row.updated_at))).toISOString(),
      };
    });
  }

  private lockProgress(
    drillType: TopicProgress["drillType"],
    topic: string,
    tx: Prisma.TransactionClient,
  ): Promise<RawRow[]> {
    return tx.$queryRaw<RawRow[]>`
      SELECT drill_type, topic, pass_count, fail_count, next_review_date, last_passed_date
      FROM interview_topic_progress
      WHERE drill_type = ${drillType} AND topic = ${topic} FOR UPDATE
    `;
  }
}
