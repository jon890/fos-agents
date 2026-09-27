import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";

import { ApiError } from "../common/api-error.js";
import { todaySeoulIsoDate } from "../positions/seoul-date.js";
import { StudyRepository } from "./repository/study.repository.js";
import type {
  StudyCandidatePage,
  StudyCandidatesQuery,
  StudyCursorResult,
  StudyIngestion,
  StudyIngestionResult,
  StudyPublication,
  StudyPublicationResult,
  StudyRecommendationControl,
  StudyRecommendationRun,
  StudyRecommendationRunResult,
  StudySource,
  StudySourcePut,
  StudySourceUpsertResponse,
} from "./schema.js";

function isDuplicateSourceKey(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    if (error.code === "P2010" && error.meta?.code === "1062") return true;
  }
  return error instanceof Error && /Duplicate entry|Unique constraint failed/.test(error.message);
}

@Injectable()
export class StudyService {
  constructor(private readonly repository: StudyRepository) {}

  async listSources(): Promise<{ sources: StudySource[] }> {
    return { sources: await this.repository.listSources(this.repository.reader()) };
  }

  async upsertSource(sourceKey: string, value: StudySourcePut): Promise<StudySourceUpsertResponse> {
    try {
      return await this.repository.transaction(async (tx) => {
        const existing = await this.repository.lockSource(sourceKey, tx);
        if (existing && existing.version !== value.expectedVersion) {
          throw new ApiError(409, "VERSION_CONFLICT", "소스 버전이 현재 값과 다릅니다.");
        }
        if (!existing && value.expectedVersion !== 0) {
          throw new ApiError(409, "VERSION_CONFLICT", "새 소스는 expectedVersion이 0이어야 합니다.");
        }
        if (existing) await this.repository.updateSource(sourceKey, value, tx);
        else await this.repository.insertSource(sourceKey, value, tx);
        const source = await this.repository.lockSource(sourceKey, tx);
        if (!source) throw new ApiError(500, "INTERNAL_ERROR", "소스를 저장하지 못했습니다.");
        return { source, version: source.version };
      });
    } catch (error) {
      // 존재하지 않는 행은 `FOR UPDATE`로 잠글 수 없다. 같은 sourceKey를 동시에
      // 생성한 요청 중 하나가 PK 충돌로 끝나면 낙관적 잠금 충돌로 공개한다.
      if (isDuplicateSourceKey(error)) {
        throw new ApiError(409, "VERSION_CONFLICT", "소스 버전이 현재 값과 다릅니다.");
      }
      throw error;
    }
  }

  async getCursor(sourceKey: string, mode: StudyCursorResult["mode"]): Promise<StudyCursorResult> {
    const source = await this.repository.getSource(sourceKey, this.repository.reader());
    if (!source) throw new ApiError(404, "NOT_FOUND", "소스를 찾을 수 없습니다.");
    const cursor = await this.repository.getCursor(sourceKey, mode, this.repository.reader());
    return { sourceKey, mode, cursor: cursor?.cursor ?? null, version: cursor?.version ?? 0 };
  }

  async createIngestion(value: StudyIngestion): Promise<StudyIngestionResult> {
    return this.repository.transaction(async (tx) => {
      const source = await this.repository.lockSource(value.sourceKey, tx);
      if (!source) throw new ApiError(404, "NOT_FOUND", "소스를 찾을 수 없습니다.");
      if (!source.enabled) throw new ApiError(409, "VERSION_CONFLICT", "꺼진 소스에는 자료를 저장할 수 없습니다.");
      const cursor = await this.repository.lockCursor(value.sourceKey, value.mode, tx);
      const cursorVersion = cursor?.version ?? 0;
      if (cursorVersion !== value.expectedCursorVersion) {
        throw new ApiError(409, "VERSION_CONFLICT", "cursor 버전이 현재 값과 다릅니다.");
      }
      for (const item of value.items) await this.repository.upsertMaterial(item, value.sourceKey, tx);
      const nextVersion = await this.repository.replaceCursor(value.sourceKey, value.mode, value.cursor, tx);
      return { idempotencyKey: value.idempotencyKey, acceptedCount: value.items.length, cursorVersion: nextVersion };
    });
  }

  async getCandidates(query: StudyCandidatesQuery): Promise<StudyCandidatePage> {
    const control = await this.repository.getRecommendationControl(this.repository.reader());
    if (!control) throw new ApiError(500, "INTERNAL_ERROR", "추천 제어 행을 찾을 수 없습니다.");
    const rows = await this.repository.listCandidates({
      ...query,
      today: todaySeoulIsoDate(new Date()),
    }, this.repository.reader());
    const candidates = rows.slice(0, query.limit);
    return {
      candidates: candidates.map((row) => ({
        id: row.contentKey,
        contentKey: row.contentKey,
        canonicalUrl: row.canonicalUrl,
        sourceKey: row.sourceKey,
        sourceName: row.sourceName,
        category: row.category,
        title: row.title,
        url: row.url,
        published: row.published,
        ...(row.excerpt === null ? {} : { excerpt: row.excerpt }),
        kind: row.kind,
        previouslyRecommended: false,
      })),
      recentStudyTopicKeys: await this.repository.recentStudyTopicKeys(this.repository.reader()),
      nextCursor: candidates.length === query.limit && rows.length > query.limit
        ? this.repository.encodePageCursor(candidates.at(-1)!)
        : null,
      historyVersion: control.historyVersion,
      candidateContextVersion: control.candidateContextVersion,
    };
  }

  async createRecommendationRun(value: StudyRecommendationRun): Promise<StudyRecommendationRunResult> {
    return this.repository.transaction(async (tx) => {
      const control = await this.repository.lockRecommendationControl(tx);
      if (!control) throw new ApiError(500, "INTERNAL_ERROR", "추천 제어 행을 찾을 수 없습니다.");
      if (control.candidateContextVersion !== value.candidateContextVersion) {
        throw new ApiError(409, "VERSION_CONFLICT", "후보 기준 버전이 현재 값과 다릅니다.");
      }
      if (await this.repository.recommendationRunExists(value.reportId, tx)) {
        throw new ApiError(409, "VERSION_CONFLICT", "같은 reportId의 추천 실행이 이미 있습니다.");
      }
      const previousTopicKeys = await this.repository.latestRecommendationTopicKeys(tx);
      if (value.topics.some((topic) => previousTopicKeys.includes(topic.topicKey))) {
        throw new ApiError(409, "VERSION_CONFLICT", "직전 추천 실행의 주제를 다시 고를 수 없습니다.");
      }
      const selectedContentKeys = value.topics.flatMap((topic) => topic.items.map((item) => item.contentKey));
      const allContentKeys = [...selectedContentKeys, ...value.rejections.map((rejection) => rejection.contentKey)];
      const existingMaterialKeys = await this.repository.existingMaterialKeys(allContentKeys, tx);
      if (existingMaterialKeys.size !== allContentKeys.length) {
        throw new ApiError(400, "BAD_REQUEST", "추천 또는 제외 자료가 후보 저장소에 없습니다.");
      }
      if (await this.repository.hasRecommendedMaterial(selectedContentKeys, tx)) {
        throw new ApiError(409, "VERSION_CONFLICT", "이미 추천한 자료를 다시 고를 수 없습니다.");
      }
      await this.repository.insertRecommendationRun(value, tx);
      await this.repository.insertRecommendationTopics(value, tx);
      await this.repository.insertRecommendedMaterials(value, tx);
      await this.repository.upsertRejections(value, todaySeoulIsoDate(new Date()), tx);
      const historyVersion = await this.repository.incrementHistoryVersion(tx);
      return { reportId: value.reportId, historyVersion };
    });
  }

  async createPublication(value: StudyPublication): Promise<StudyPublicationResult> {
    return this.repository.transaction(async (tx) => {
      if (!(await this.repository.recommendationRunExists(value.reportId, tx))) {
        throw new ApiError(404, "NOT_FOUND", "추천 실행을 찾을 수 없습니다.");
      }
      return { publicationId: await this.repository.insertPublication(value, tx) };
    });
  }

  async updateRecommendationControl(value: StudyRecommendationControl): Promise<StudyRecommendationControl> {
    return this.repository.transaction(async (tx) => {
      const control = await this.repository.lockRecommendationControl(tx);
      if (!control) throw new ApiError(500, "INTERNAL_ERROR", "추천 제어 행을 찾을 수 없습니다.");
      await this.repository.updateCandidateContextVersion(value.candidateContextVersion, tx);
      return value;
    });
  }

  async getRecommendationRunStatus(reportId: string): Promise<{ reportId: string; exists: boolean }> {
    return { reportId, exists: await this.repository.recommendationRunExists(reportId, this.repository.reader()) };
  }
}
