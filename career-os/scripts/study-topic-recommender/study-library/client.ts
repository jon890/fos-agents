import { createHash } from "node:crypto";
import { openCareerStore } from "../../lib/career-store/database.ts";
import { StudyStore } from "../../lib/career-store/study/store.ts";
import {
  studyLibraryCandidatePageSchema,
  studyLibraryCursorResultSchema,
  studyLibraryIngestionResultSchema,
  studyLibraryPublicationResultSchema,
  studyLibraryRecommendationRunResultSchema,
  studyLibraryRecommendationStatusSchema,
  studyLibrarySourcesResponseSchema,
  studyLibrarySourceUpsertResponseSchema,
  type StudyLibraryCandidatePage,
  type StudyLibraryCursorResult,
  type StudyLibraryIngestionResult,
  type StudyLibraryPublicationResult,
  type StudyLibraryRecommendationRunResult,
  type StudyLibrarySourcePutPayload,
  type StudyLibrarySourcesResponse,
  type StudyLibrarySourceUpsertResponse,
} from "./contracts.js";

type Environment = Record<string, string | undefined>;

export interface StudyLibraryClientOptions {
  /** 저장 모듈을 직접 준다. 없으면 `environment` 의 작업 폴더에서 연다. */
  store?: StudyStore;
  environment?: Environment;
}

export type StudyLibrarySearchParams = Record<string, string | number | boolean | null | undefined>;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

function hashKey(prefix: string, value: unknown): string {
  return `${prefix}:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}

function withoutEmpty(params: StudyLibrarySearchParams): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value != null)) as Record<string, string | number | boolean>;
}

/**
 * 공부 추천 실행기가 쓰는 저장소 client 다. 데이터는 커리어 작업 폴더의 SQLite 파일에 있다(ADR-146).
 * 메서드와 응답 모양은 커리어 Backend 의 HTTP client 였을 때와 같고, 멱등 키도 같은 값으로 만든다.
 */
export class StudyLibraryClient {
  private readonly store: StudyStore;

  constructor(options: StudyLibraryClientOptions = {}) {
    this.store = options.store ?? new StudyStore(openCareerStore(options.environment ?? process.env));
  }

  async getSources(): Promise<StudyLibrarySourcesResponse> {
    return studyLibrarySourcesResponseSchema.parse(await this.store.listSources());
  }

  async putSource(sourceKey: string, body: StudyLibrarySourcePutPayload): Promise<StudyLibrarySourceUpsertResponse> {
    return studyLibrarySourceUpsertResponseSchema.parse(
      await this.store.upsertSource(sourceKey, body, hashKey("source", { sourceKey, payload: body })),
    );
  }

  async getSourceCursor(sourceKey: string, mode: "recent" | "archive"): Promise<StudyLibraryCursorResult> {
    return studyLibraryCursorResultSchema.parse(await this.store.getCursor(sourceKey, mode));
  }

  async createIngestion(body: unknown): Promise<StudyLibraryIngestionResult> {
    return studyLibraryIngestionResultSchema.parse(
      await this.store.createIngestion(body, (body as { idempotencyKey?: string }).idempotencyKey ?? ""),
    );
  }

  async getCandidates(searchParams: StudyLibrarySearchParams = {}): Promise<StudyLibraryCandidatePage> {
    return studyLibraryCandidatePageSchema.parse(await this.store.getCandidates(withoutEmpty(searchParams)));
  }

  async createRecommendationRun(body: unknown): Promise<StudyLibraryRecommendationRunResult> {
    const value = body as { reportId: string; generatedAt: string };
    return studyLibraryRecommendationRunResultSchema.parse(
      await this.store.createRecommendationRun(
        body,
        hashKey("recommendation", { reportId: value.reportId, generatedAt: value.generatedAt }),
      ),
    );
  }

  async createPublication(body: unknown): Promise<StudyLibraryPublicationResult> {
    return studyLibraryPublicationResultSchema.parse(
      await this.store.createPublication(body, (body as { idempotencyKey?: string }).idempotencyKey ?? ""),
    );
  }

  async getRecommendationRunStatus(reportId: string): Promise<{ reportId: string; exists: boolean }> {
    return studyLibraryRecommendationStatusSchema.parse(await this.store.getRecommendationRunStatus(reportId));
  }

  /** 저장한 추천 실행을 최신순으로 읽는다. 실행마다 사용자가 기록한 게시 링크가 함께 온다. */
  async listRecommendationRuns(limit?: number) {
    return this.store.listRecommendationRuns(limit === undefined ? {} : { limit });
  }
}

export function createStudyLibraryClient(options: StudyLibraryClientOptions = {}): StudyLibraryClient {
  return new StudyLibraryClient(options);
}
