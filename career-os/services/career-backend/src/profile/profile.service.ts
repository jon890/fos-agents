import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../common/api-error.js";
import { ProfileDocumentRepository } from "./repository/profile-document.repository.js";
import { UsageSnapshotRepository } from "./repository/usage-snapshot.repository.js";
import type {
  ProfileDocument,
  ProfileDocumentKey,
  ProfileDocumentPut,
  ProfileDocumentPutResponse,
  ProfileDocumentSummary,
  UsageSnapshot,
  UsageSnapshotPut,
  UsageSnapshotPutResponse,
} from "./schema.js";
import { isEndedSeoulMonth } from "./usage-month.js";

function isDuplicateDocumentKey(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    if (error.code === "P2010" && error.meta?.code === "1062") return true;
  }
  return error instanceof Error && /Duplicate entry|Unique constraint failed/.test(error.message);
}

/** 요청을 받은 시각. 테스트가 고정할 수 있게 주입한다. */
@Injectable()
export class ProfileClock {
  now(): Date {
    return new Date();
  }
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly documents: ProfileDocumentRepository,
    private readonly usage: UsageSnapshotRepository,
    private readonly clock: ProfileClock,
  ) {}

  async listDocuments(): Promise<{ documents: ProfileDocumentSummary[] }> {
    return { documents: await this.documents.listDocuments(this.documents.reader()) };
  }

  async getDocument(documentKey: ProfileDocumentKey): Promise<{ document: ProfileDocument }> {
    const document = await this.documents.getDocument(documentKey, this.documents.reader());
    if (!document) throw new ApiError(404, "NOT_FOUND", "프로필 원고를 찾을 수 없습니다.");
    return { document };
  }

  async putDocument(documentKey: ProfileDocumentKey, value: ProfileDocumentPut): Promise<ProfileDocumentPutResponse> {
    try {
      return await this.documents.transaction(async (tx) => {
        const existing = await this.documents.lockDocument(documentKey, tx);
        if (existing && existing.version !== value.expectedVersion) {
          throw new ApiError(409, "VERSION_CONFLICT", "문서 버전이 현재 값과 다릅니다.");
        }
        if (!existing && value.expectedVersion !== 0) {
          throw new ApiError(409, "VERSION_CONFLICT", "새 문서는 expectedVersion이 0이어야 합니다.");
        }
        if (existing) await this.documents.updateDocument(documentKey, value, tx);
        else await this.documents.insertDocument(documentKey, value, tx);
        const saved = await this.documents.lockDocument(documentKey, tx);
        if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "문서를 저장하지 못했습니다.");
        await this.documents.insertRevision(saved, tx);
        return {
          document: { documentKey: saved.documentKey, version: saved.version, updatedAt: saved.updatedAt },
        };
      });
    } catch (error) {
      // 없는 행은 `FOR UPDATE` 로 잠글 수 없다. 같은 새 문서를 동시에 만든 요청 중
      // 늦은 쪽이 PK 충돌로 끝나면 낙관적 잠금 충돌로 공개한다.
      if (isDuplicateDocumentKey(error)) {
        throw new ApiError(409, "VERSION_CONFLICT", "문서 버전이 현재 값과 다릅니다.");
      }
      throw error;
    }
  }

  async listUsageSnapshots(): Promise<{ snapshots: UsageSnapshot[] }> {
    return { snapshots: await this.usage.listSnapshots(this.usage.reader()) };
  }

  /**
   * 끝난 달의 사용량 기록을 저장한다. ADR-133 을 따른다.
   *
   * 세션 기록이 기기에서 지워진 뒤에는 그 달을 다시 셀 수 없어, 이미 기록된 달은 `replace` 없이 바꾸지 않는다.
   * 그 요청은 오류가 아니라 저장돼 있던 기록과 `created: false` 를 받는다. 수집기가 같은 달을 다시 올려도
   * 정상 실행으로 보이게 하려는 것이다.
   */
  async putUsageSnapshot(month: string, value: UsageSnapshotPut): Promise<UsageSnapshotPutResponse> {
    if (!isEndedSeoulMonth(month, this.clock.now())) {
      throw new ApiError(400, "BAD_REQUEST", "끝난 달의 기록만 저장할 수 있습니다.");
    }
    return this.usage.transaction(async (tx) => {
      let created: boolean;
      if (value.replace !== true) {
        created = await this.usage.insertIfAbsent(month, value, tx);
      } else if (!(await this.usage.lockSnapshot(month, tx))) {
        // 격리 수준이 ReadCommitted 라 없는 행에 건 `FOR UPDATE` 는 gap 잠금을 걸지 않는다.
        // 그 사이 다른 요청이 첫 기록을 먼저 넣었으면 다시 잠그고 바꿔, 사람이 요청한 교체가 빠지지 않게 한다.
        created = await this.usage.insertIfAbsent(month, value, tx);
        if (!created) {
          await this.usage.lockSnapshot(month, tx);
          await this.usage.replaceSnapshot(month, value, tx);
        }
      } else {
        await this.usage.replaceSnapshot(month, value, tx);
        created = false;
      }
      const snapshot = await this.usage.getSnapshot(month, tx);
      if (!snapshot) throw new ApiError(500, "INTERNAL_ERROR", "사용량 기록을 저장하지 못했습니다.");
      return { snapshot, created };
    });
  }
}
