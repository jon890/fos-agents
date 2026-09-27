import type {
  AttemptBody,
  PersonalQuestionBody,
  TopicProgress,
} from "../../../services/career-backend/src/interview/schema.ts";
import { InterviewBackendClient } from "../career-backend/client.ts";
import type { DrillType } from "../drill-engine.ts";
import type {
  AttemptResponse,
  InterviewPracticeStore,
  PersonalQuestionRecord,
  PersonalQuestionUpsertResponse,
} from "./port.ts";

export class BackendInterviewPracticeStore implements InterviewPracticeStore {
  readonly kind = "backend" as const;
  constructor(private readonly client: InterviewBackendClient) {}
  listProgress(drillType: DrillType): Promise<TopicProgress[]> {
    return this.client.listProgress(drillType);
  }
  recordAttempt(body: AttemptBody): Promise<AttemptResponse> {
    return this.client.recordAttempt(body);
  }
  async listPersonalQuestions(
    drillType: DrillType,
    options?: { includeDisabled?: boolean },
  ): Promise<PersonalQuestionRecord[]> {
    if (options?.includeDisabled)
      throw new Error("Backend 저장소는 꺼진 개인 질문을 조회하지 않는다");
    return (await this.client.listPersonalQuestions(drillType)).map((question) => ({
      questionId: question.id,
      drillType,
      enabled: true,
      question,
    }));
  }
  upsertPersonalQuestion(
    questionId: string,
    body: PersonalQuestionBody,
  ): Promise<PersonalQuestionUpsertResponse> {
    return this.client.upsertPersonalQuestion(questionId, body);
  }
}
