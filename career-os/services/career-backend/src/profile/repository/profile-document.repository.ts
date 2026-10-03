import { Injectable } from "@nestjs/common";

import { Prisma } from "../../generated/prisma/client.js";
import { PrismaService } from "../../prisma/prisma.service.js";
import type {
  ProfileDocument,
  ProfileDocumentKey,
  ProfileDocumentPut,
  ProfileDocumentSummary,
} from "../schema.js";

type RawRow = Record<string, unknown>;
type DbClient = PrismaService | Prisma.TransactionClient;

function isoDate(value: unknown): string {
  return (value instanceof Date ? value : new Date(String(value))).toISOString();
}

function summary(row: RawRow): ProfileDocumentSummary {
  return {
    documentKey: String(row.document_key) as ProfileDocumentKey,
    version: Number(row.version),
    updatedAt: isoDate(row.updated_at),
  };
}

function document(row: RawRow): ProfileDocument {
  return { ...summary(row), body: String(row.body), note: String(row.note) };
}

@Injectable()
export class ProfileDocumentRepository {
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

  async listDocuments(client: DbClient): Promise<ProfileDocumentSummary[]> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT document_key, version, updated_at
      FROM profile_documents ORDER BY document_key
    `;
    return rows.map(summary);
  }

  async getDocument(documentKey: ProfileDocumentKey, client: DbClient): Promise<ProfileDocument | undefined> {
    const rows = await client.$queryRaw<RawRow[]>`
      SELECT document_key, body, version, note, updated_at
      FROM profile_documents WHERE document_key = ${documentKey}
    `;
    return rows[0] ? document(rows[0]) : undefined;
  }

  async lockDocument(documentKey: ProfileDocumentKey, tx: Prisma.TransactionClient): Promise<ProfileDocument | undefined> {
    const rows = await tx.$queryRaw<RawRow[]>`
      SELECT document_key, body, version, note, updated_at
      FROM profile_documents WHERE document_key = ${documentKey} FOR UPDATE
    `;
    return rows[0] ? document(rows[0]) : undefined;
  }

  async insertDocument(documentKey: ProfileDocumentKey, value: ProfileDocumentPut, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO profile_documents (document_key, body, version, note, updated_at)
      VALUES (${documentKey}, ${value.body}, 1, ${value.note}, NOW(3))
    `;
  }

  async updateDocument(documentKey: ProfileDocumentKey, value: ProfileDocumentPut, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      UPDATE profile_documents
      SET body = ${value.body}, note = ${value.note}, version = version + 1, updated_at = NOW(3)
      WHERE document_key = ${documentKey}
    `;
  }

  /** 저장한 문서 행을 그대로 이력 행으로 남긴다. 이력 행은 고치거나 지우지 않는다. */
  async insertRevision(saved: ProfileDocument, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO profile_document_revisions (document_key, version, body, note, created_at)
      VALUES (${saved.documentKey}, ${saved.version}, ${saved.body}, ${saved.note}, NOW(3))
    `;
  }
}
