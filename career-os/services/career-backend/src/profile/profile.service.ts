import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../common/api-error.js";
import { ProfileDocumentRepository } from "./repository/profile-document.repository.js";
import type {
  ProfileDocument,
  ProfileDocumentKey,
  ProfileDocumentPut,
  ProfileDocumentPutResponse,
  ProfileDocumentSummary,
} from "./schema.js";

function isDuplicateDocumentKey(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    if (error.code === "P2010" && error.meta?.code === "1062") return true;
  }
  return error instanceof Error && /Duplicate entry|Unique constraint failed/.test(error.message);
}

@Injectable()
export class ProfileService {
  constructor(private readonly documents: ProfileDocumentRepository) {}

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
}
