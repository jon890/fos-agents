import { Injectable } from "@nestjs/common";

import { ApiError } from "../common/api-error.js";
import { StudyRepository } from "./repository/study.repository.js";
import type { StudyCursorResult, StudySource, StudySourcePut, StudySourceUpsertResponse } from "./schema.js";

@Injectable()
export class StudyService {
  constructor(private readonly repository: StudyRepository) {}

  async listSources(): Promise<{ sources: StudySource[] }> {
    return { sources: await this.repository.listSources(this.repository.reader()) };
  }

  async upsertSource(sourceKey: string, value: StudySourcePut): Promise<StudySourceUpsertResponse> {
    return this.repository.transaction(async (tx) => {
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
  }

  async getCursor(sourceKey: string, mode: StudyCursorResult["mode"]): Promise<StudyCursorResult> {
    const source = await this.repository.getSource(sourceKey, this.repository.reader());
    if (!source) throw new ApiError(404, "NOT_FOUND", "소스를 찾을 수 없습니다.");
    const cursor = await this.repository.getCursor(sourceKey, mode, this.repository.reader());
    return { sourceKey, mode, cursor: cursor?.cursor ?? null, version: cursor?.version ?? 0 };
  }
}
