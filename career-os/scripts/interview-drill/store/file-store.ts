import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  attemptBodySchema,
  personalQuestionBodySchema,
  type AttemptBody,
  type PersonalQuestionBody,
  type TopicProgress,
} from "../../../services/career-backend/src/interview/schema.ts";
import {
  nextTopicProgress,
  seoulDate,
} from "../../../services/career-backend/src/interview/review-schedule.ts";
import type { DrillType } from "../drill-engine.ts";
import type {
  AttemptResponse,
  InterviewPracticeStore,
  PersonalQuestionRecord,
  PersonalQuestionUpsertResponse,
} from "./port.ts";

type ProgressFile = { schemaVersion: 1; items: TopicProgress[] };
type PersonalFile = {
  schemaVersion: 1;
  items: Array<PersonalQuestionRecord & { topic: string; updatedAt: string }>;
};
type StoredAttempt = AttemptBody & { evaluatedOn: string; createdAt: string };

function checked<T>(result: { success: boolean; data?: T; error?: { message: string } }): T {
  if (!result.success) throw new Error(result.error?.message ?? "입력 형식이 올바르지 않습니다.");
  return result.data!;
}

export class FileInterviewPracticeStore implements InterviewPracticeStore {
  readonly kind = "file" as const;
  constructor(
    private readonly directory: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private path(name: string): string {
    return join(this.directory, name);
  }
  private readJson<T>(name: string, fallback: T): T {
    const path = this.path(name);
    return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
  }
  private writeJson(name: string, value: unknown): void {
    mkdirSync(this.directory, { recursive: true });
    const path = this.path(name);
    const temporary = `${path}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(temporary, path);
  }
  private progress(): ProgressFile {
    return this.readJson("topic-progress.json", { schemaVersion: 1, items: [] });
  }
  private personal(): PersonalFile {
    return this.readJson("personal-questions.json", { schemaVersion: 1, items: [] });
  }
  private attempts(): StoredAttempt[] {
    const path = this.path("attempts.jsonl");
    if (!existsSync(path)) return [];
    return readFileSync(path, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as StoredAttempt);
  }

  async listProgress(drillType: DrillType): Promise<TopicProgress[]> {
    return this.progress().items.filter((item) => item.drillType === drillType);
  }

  async recordAttempt(input: AttemptBody): Promise<AttemptResponse> {
    const body = checked(attemptBodySchema.safeParse(input));
    const attempts = this.attempts();
    const existingIndex = attempts.findIndex((item) => item.attemptId === body.attemptId);
    const existing = attempts[existingIndex];
    if (existing) {
      let progress: {
        passCount: number;
        failCount: number;
        nextReviewDate: string | null;
        lastPassedDate: string | null;
      } = {
        passCount: 0,
        failCount: 0,
        nextReviewDate: null,
        lastPassedDate: null,
      };
      for (const attempt of attempts.slice(0, existingIndex + 1)) {
        if (attempt.drillType !== existing.drillType || attempt.topic !== existing.topic) continue;
        progress = nextTopicProgress(progress, attempt.score, attempt.evaluatedOn);
      }
      return {
        attemptId: existing.attemptId,
        evaluatedOn: existing.evaluatedOn,
        progress: { drillType: existing.drillType, topic: existing.topic, ...progress },
      };
    }
    const evaluatedOn = seoulDate(this.now());
    const currentFile = this.progress();
    const index = currentFile.items.findIndex(
      (item) => item.drillType === body.drillType && item.topic === body.topic,
    );
    const current =
      index >= 0
        ? currentFile.items[index]
        : {
            drillType: body.drillType,
            topic: body.topic,
            passCount: 0,
            failCount: 0,
            nextReviewDate: null,
            lastPassedDate: null,
          };
    const next = {
      drillType: body.drillType,
      topic: body.topic,
      ...nextTopicProgress(current, body.score, evaluatedOn),
    };
    if (index >= 0) currentFile.items[index] = next;
    else currentFile.items.push(next);
    this.writeJson("topic-progress.json", currentFile);
    mkdirSync(this.directory, { recursive: true });
    const stored: StoredAttempt = { ...body, evaluatedOn, createdAt: this.now().toISOString() };
    writeFileSync(this.path("attempts.jsonl"), `${JSON.stringify(stored)}\n`, {
      encoding: "utf8",
      flag: "a",
    });
    return { attemptId: body.attemptId, evaluatedOn, progress: next };
  }

  async listPersonalQuestions(
    drillType: DrillType,
    options?: { includeDisabled?: boolean },
  ): Promise<PersonalQuestionRecord[]> {
    return this.personal()
      .items.filter(
        (item) => item.drillType === drillType && (options?.includeDisabled || item.enabled),
      )
      .map(({ questionId, drillType: type, enabled, question }) => ({
        questionId,
        drillType: type,
        enabled,
        question,
      }));
  }

  async upsertPersonalQuestion(
    questionId: string,
    input: PersonalQuestionBody,
  ): Promise<PersonalQuestionUpsertResponse> {
    const body = checked(personalQuestionBodySchema.safeParse(input));
    if (body.question.id !== questionId)
      throw new Error("questionId와 question.id가 같아야 합니다.");
    const file = this.personal();
    const updatedAt = this.now().toISOString();
    const record = {
      questionId,
      drillType: body.drillType,
      topic: body.question.topic,
      enabled: body.enabled,
      question: body.question,
      updatedAt,
    };
    const index = file.items.findIndex((item) => item.questionId === questionId);
    if (index >= 0) file.items[index] = record;
    else file.items.push(record);
    this.writeJson("personal-questions.json", file);
    return {
      questionId,
      drillType: body.drillType,
      topic: body.question.topic,
      enabled: body.enabled,
      updatedAt,
    };
  }
}
