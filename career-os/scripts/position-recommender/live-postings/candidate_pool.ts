import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  postingCandidatePoolSchema,
  postingSchema,
  type Posting,
  type PostingCandidate,
  type PostingCandidatePool,
} from "./contracts.ts";
import type { CollectionDiagnostics } from "./types.ts";

function candidateId(posting: Posting): string {
  const identity = posting.identityHash ?? posting.url;
  return `${posting.source}:${createHash("sha256").update(identity).digest("hex").slice(0, 16)}`;
}

export function buildPostingCandidatePool(
  rawPostings: unknown[],
  diagnostics: CollectionDiagnostics,
): { pool: PostingCandidatePool; validationErrors: string[] } {
  const validationErrors: string[] = [];
  const candidates: PostingCandidate[] = [];

  rawPostings.forEach((raw, index) => {
    const parsed = postingSchema.safeParse(raw);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
      validationErrors.push(`공고 ${index + 1} 스키마 오류: ${issues}`);
      return;
    }
    candidates.push({ ...parsed.data, id: candidateId(parsed.data) });
  });

  const pool = postingCandidatePoolSchema.parse({
    schemaVersion: 1,
    collectionRunId: diagnostics.collectionRunId,
    collectedAt: diagnostics.collectedAt,
    requestedSource: diagnostics.requestedSource,
    configuredSources: diagnostics.configuredSources,
    policy: {
      selection: "llm",
      activeDirectOnly: true,
      fixedPreferenceKeywordsUsed: false,
      sourcePriorityUsed: false,
    },
    candidates,
    sourceDiagnostics: diagnostics.sourceDiagnostics,
    errors: [...diagnostics.errors, ...validationErrors],
  });
  return { pool, validationErrors };
}

export function loadPostingCandidatePool(path: string): PostingCandidatePool {
  const parsed = postingCandidatePoolSchema.safeParse(JSON.parse(readFileSync(path, "utf8")) as unknown);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`공고 후보풀 검증 실패:\n- ${issues.join("\n- ")}`);
  }
  return parsed.data;
}
