import { z } from "zod";
import { buildWorkspaceDraft, digestWorkspaceFiles, sortWorkspaceFiles, WorkspaceManifestError } from "./manifest.ts";
import {
  careerWorkspaceFileEntrySchema,
  type CareerWorkspaceProducer,
} from "./contracts.ts";

export const SYNC_STATE_PATH = "career-os/.career-sync/sync-state.json";
export const PREPARE_JOURNAL_PATH = "career-os/.career-sync/prepare-journal.json";

export const careerWorkspaceSyncStateSchema = z.object({
  schemaVersion: z.literal(1),
  workspace: z.literal("career-os"),
  revision: z.string().trim().min(1),
  contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
  files: z.array(careerWorkspaceFileEntrySchema),
}).strict();

export const prepareJournalSchema = z.object({
  schemaVersion: z.literal(1),
  workspace: z.literal("career-os"),
  transactionId: z.string().trim().min(1),
  revision: z.string().trim().min(1).nullable(),
  status: z.enum(["started", "staged", "backed_up", "applied", "restoring", "restored", "completed"]),
  roots: z.object({
    applications: journalRootStateSchema(),
    private: journalRootStateSchema(),
    state: journalRootStateSchema(),
  }).strict(),
}).strict();

export const inspectLocalWorkspaceStatusSchema = z.enum(["clean", "dirty", "uninitialized", "invalid"]);

export interface InspectLocalWorkspaceResult {
  status: z.infer<typeof inspectLocalWorkspaceStatusSchema>;
  currentDigest: string | null;
  expectedDigest: string | null;
  reason: string;
}

export async function inspectLocalWorkspace(
  root: string,
  syncState: unknown,
  producer: CareerWorkspaceProducer = { skill: "career-workspace", mode: "interactive" },
): Promise<InspectLocalWorkspaceResult> {
  if (syncState === null || syncState === undefined) {
    const current = await safeBuildWorkspaceDraft(root, producer);
    if (!current.ok) {
      return invalidResult(current.reason);
    }
    return {
      status: "uninitialized",
      currentDigest: current.result.manifest.contentDigest,
      expectedDigest: null,
      reason: "sync state is missing",
    };
  }

  const parsed = careerWorkspaceSyncStateSchema.safeParse(syncState);
  if (!parsed.success) {
    return {
      status: "invalid",
      currentDigest: null,
      expectedDigest: null,
      reason: "sync state schema is invalid",
    };
  }

  const expectedDigest = parsed.data.contentDigest;
  const recalculatedExpectedDigest = digestWorkspaceFiles(sortWorkspaceFiles(parsed.data.files));
  if (expectedDigest !== recalculatedExpectedDigest) {
    return invalidResult("sync state contentDigest does not match files");
  }

  const current = await safeBuildWorkspaceDraft(root, producer, { parentRevision: parsed.data.revision });
  if (!current.ok) {
    return invalidResult(current.reason, expectedDigest);
  }

  const currentDigest = current.result.manifest.contentDigest;

  return {
    status: currentDigest === expectedDigest ? "clean" : "dirty",
    currentDigest,
    expectedDigest,
    reason: currentDigest === expectedDigest ? "local workspace matches sync state" : "local workspace differs from sync state",
  };
}

export type CareerWorkspaceSyncState = z.infer<typeof careerWorkspaceSyncStateSchema>;
export type PrepareJournal = z.infer<typeof prepareJournalSchema>;

async function safeBuildWorkspaceDraft(
  root: string,
  producer: CareerWorkspaceProducer,
  options: Parameters<typeof buildWorkspaceDraft>[2] = {},
): Promise<
  | { ok: true; result: Awaited<ReturnType<typeof buildWorkspaceDraft>> }
  | { ok: false; reason: string }
> {
  try {
    return { ok: true, result: await buildWorkspaceDraft(root, producer, options) };
  } catch (error) {
    if (error instanceof WorkspaceManifestError) {
      return { ok: false, reason: "local workspace contains rejected paths" };
    }
    throw error;
  }
}

function invalidResult(reason: string, expectedDigest: string | null = null): InspectLocalWorkspaceResult {
  return {
    status: "invalid",
    currentDigest: null,
    expectedDigest,
    reason,
  };
}

function journalRootStateSchema() {
  return z.object({
    hadOriginal: z.boolean(),
    backupDone: z.boolean(),
    applyDone: z.boolean(),
  }).strict();
}
