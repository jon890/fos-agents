import { readContextDocument } from "../context.ts";
import type { CareerDatabase } from "../database.ts";
import { runWithReceipt } from "../receipts.ts";
import { parseRequest } from "../validate.ts";
import { StudyRepository } from "./repository.ts";
import {
  cursorModeSchema,
  sourceKeySchema,
  studyCandidatesQuerySchema,
  studyIngestionSchema,
  studyPublicationSchema,
  studyRecommendationRunSchema,
  studyRecommendationRunsQuerySchema,
  studySourcePutSchema,
  type StudyCandidatePage,
  type StudyCursorResult,
  type StudyIngestionResult,
  type StudyPublicationResult,
  type StudyRecommendationRunPage,
  type StudyRecommendationRunResult,
  type StudySource,
  type StudySourceUpsertResponse,
} from "./schema.ts";
import { StudyService } from "./service.ts";

/**
 * 공부 추천의 저장 모듈이다. 커리어 Backend 의 HTTP 경로 하나가 메서드 하나이고
 * 입력과 출력이 그 요청·응답 본문과 같다(ADR-146).
 */
export class StudyStore {
  private readonly service: StudyService;

  constructor(private readonly db: CareerDatabase) {
    this.service = new StudyService(new StudyRepository(db), () =>
      readContextDocument(db.root, "learning-interests"),
    );
  }

  /** `GET /sources` */
  listSources(): Promise<{ sources: StudySource[] }> {
    return this.service.listSources();
  }

  /** `PUT /sources/{sourceKey}` */
  upsertSource(
    sourceKey: string,
    body: unknown,
    idempotencyKey: string,
  ): Promise<StudySourceUpsertResponse> {
    return runWithReceipt(this.db, idempotencyKey, body, 200, async () =>
      this.service.upsertSource(
        parseRequest(sourceKeySchema, sourceKey),
        parseRequest(studySourcePutSchema, body),
      ),
    );
  }

  /** `GET /sources/{sourceKey}/cursor?mode=` */
  async getCursor(sourceKey: string, mode: string): Promise<StudyCursorResult> {
    return this.service.getCursor(
      parseRequest(sourceKeySchema, sourceKey),
      parseRequest(cursorModeSchema, mode),
    );
  }

  /** `POST /ingestions` */
  createIngestion(body: unknown, idempotencyKey: string): Promise<StudyIngestionResult> {
    return runWithReceipt(this.db, idempotencyKey, body, 201, async () =>
      this.service.createIngestion(parseRequest(studyIngestionSchema, body)),
    );
  }

  /** `GET /candidates` */
  async getCandidates(query: unknown): Promise<StudyCandidatePage> {
    return this.service.getCandidates(parseRequest(studyCandidatesQuerySchema, query ?? {}));
  }

  /** `POST /recommendation-runs` */
  createRecommendationRun(
    body: unknown,
    idempotencyKey: string,
  ): Promise<StudyRecommendationRunResult> {
    return runWithReceipt(this.db, idempotencyKey, body, 201, async () =>
      this.service.createRecommendationRun(parseRequest(studyRecommendationRunSchema, body)),
    );
  }

  /** `GET /recommendation-runs`. 실행마다 사용자가 올린 게시 기록도 함께 준다. */
  async listRecommendationRuns(query: unknown = {}): Promise<StudyRecommendationRunPage> {
    return this.service.listRecommendationRuns(
      parseRequest(studyRecommendationRunsQuerySchema, query ?? {}),
    );
  }

  /** `GET /recommendation-runs/{reportId}/status` */
  async getRecommendationRunStatus(reportId: string): Promise<{ reportId: string; exists: boolean }> {
    return this.service.getRecommendationRunStatus(
      parseRequest(sourceKeySchema.max(40), reportId),
    );
  }

  /** `POST /publications` */
  createPublication(body: unknown, idempotencyKey: string): Promise<StudyPublicationResult> {
    return runWithReceipt(this.db, idempotencyKey, body, 201, async () =>
      this.service.createPublication(parseRequest(studyPublicationSchema, body)),
    );
  }
}
