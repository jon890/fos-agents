import { Injectable } from "@nestjs/common";

import { Prisma } from "../generated/prisma/client.js";
import { ApiError } from "../common/api-error.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CandidateContextRepository } from "./repository/candidate-context.repository.js";
import type {
  CandidateContextDocument,
  CandidateContextDocumentKey,
  CandidateContextDocumentPut,
  CandidateContextDocumentPutResponse,
  CandidateContextDocumentSummary,
} from "./schema.js";

function isDuplicateDocumentKey(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return true;
    if (error.code === "P2010" && error.meta?.code === "1062") return true;
  }
  return error instanceof Error && /Duplicate entry|Unique constraint failed/.test(error.message);
}

@Injectable()
export class CandidateContextService {
  constructor(private readonly repository: CandidateContextRepository) {}

  async listDocuments(): Promise<{ documents: CandidateContextDocumentSummary[] }> {
    return { documents: await this.repository.listDocuments(this.repository.reader()) };
  }

  async getDocument(documentKey: CandidateContextDocumentKey): Promise<{ document: CandidateContextDocument }> {
    const document = await this.repository.getDocument(documentKey, this.repository.reader());
    if (!document) throw new ApiError(404, "NOT_FOUND", "후보자 맥락 문서를 찾을 수 없습니다.");
    return { document };
  }

  /** 다른 module 이 자기 transaction 안에서 문서를 읽을 때 쓴다. 없으면 예외 대신 `undefined` 다. */
  readDocument(
    documentKey: CandidateContextDocumentKey,
    client: PrismaService | Prisma.TransactionClient,
  ): Promise<CandidateContextDocument | undefined> {
    return this.repository.getDocument(documentKey, client);
  }

  async putDocument(
    documentKey: CandidateContextDocumentKey,
    value: CandidateContextDocumentPut,
  ): Promise<CandidateContextDocumentPutResponse> {
    try {
      return await this.repository.transaction(async (tx) => {
        const existing = await this.repository.lockDocument(documentKey, tx);
        if (existing && existing.version !== value.expectedVersion) {
          throw new ApiError(409, "VERSION_CONFLICT", "문서 버전이 현재 값과 다릅니다.");
        }
        if (!existing && value.expectedVersion !== 0) {
          throw new ApiError(409, "VERSION_CONFLICT", "새 문서는 expectedVersion이 0이어야 합니다.");
        }
        if (existing) await this.repository.updateDocument(documentKey, value, tx);
        else await this.repository.insertDocument(documentKey, value, tx);
        const saved = await this.repository.lockDocument(documentKey, tx);
        if (!saved) throw new ApiError(500, "INTERNAL_ERROR", "문서를 저장하지 못했습니다.");
        await this.repository.insertRevision(saved, tx);
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
