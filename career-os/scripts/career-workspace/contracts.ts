import { z } from "zod";

export const CAREER_WORKSPACE_SCHEMA_VERSION = 1;
export const CAREER_WORKSPACE_NAME = "career-os";
export const CAREER_WORKSPACE_MANAGED_ROOTS = ["applications", "library", "state"] as const;

export const producerModeSchema = z.enum(["interactive", "automation"]);

const nonEmptyString = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const revisionSchema = nonEmptyString.regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/);

export const workspaceRelativePathSchema = z.string().min(1).superRefine((path, context) => {
  const parts = path.split("/");
  if (
    path.startsWith("/")
    || path.includes("\\")
    || /[\0-\x1F\x7F]/.test(path)
    || parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    context.addIssue({
      code: "custom",
      message: "workspace path must be a safe relative POSIX path",
    });
  }

  if (!CAREER_WORKSPACE_MANAGED_ROOTS.some((root) => path.startsWith(`${root}/`))) {
    context.addIssue({
      code: "custom",
      message: `workspace path must start with ${CAREER_WORKSPACE_MANAGED_ROOTS.join(", ")}`,
    });
  }
});

export const careerWorkspaceProducerSchema = z.object({
  skill: nonEmptyString,
  mode: producerModeSchema,
}).strict();

export const careerWorkspaceFileEntrySchema = z.object({
  path: workspaceRelativePathSchema,
  size: z.number().int().nonnegative(),
  sha256: sha256Schema,
}).strict();

export const CareerWorkspaceDraftManifestSchema = z.object({
  schemaVersion: z.literal(CAREER_WORKSPACE_SCHEMA_VERSION),
  workspace: z.literal(CAREER_WORKSPACE_NAME),
  parentRevision: revisionSchema.nullable(),
  producer: careerWorkspaceProducerSchema,
  contentDigest: sha256Schema,
  files: z.array(careerWorkspaceFileEntrySchema),
}).strict();

export const CareerWorkspaceReleaseManifestSchema = CareerWorkspaceDraftManifestSchema.extend({
  revision: revisionSchema,
  createdAt: z.iso.datetime(),
}).strict();

export const excludedWorkspacePathSchema = z.object({
  path: nonEmptyString,
  code: z.enum([
    "excluded-env",
    "excluded-omc",
    "excluded-log",
    "excluded-cache",
    "excluded-temp",
    "excluded-career-sync",
    "excluded-system-metadata",
    "excluded-hidden",
    "excluded-unmanaged-root",
  ]),
}).strict();

export const rejectedWorkspacePathSchema = z.object({
  path: nonEmptyString,
  code: z.enum([
    "rejected-symlink",
    "rejected-non-regular",
    "rejected-path",
    "rejected-changing-source",
  ]),
}).strict();

export const workspaceDraftResultSchema = z.object({
  manifest: CareerWorkspaceDraftManifestSchema,
  excluded: z.array(excludedWorkspacePathSchema),
}).strict();

export const remoteStatusResultSchema = z.object({
  schemaVersion: z.literal(CAREER_WORKSPACE_SCHEMA_VERSION),
  action: z.literal("status"),
  ok: z.literal(true),
  workspace: z.literal(CAREER_WORKSPACE_NAME),
  current: z.object({
    revision: revisionSchema,
    contentDigest: sha256Schema,
    createdAt: z.iso.datetime(),
    fileCount: z.number().int().nonnegative(),
  }).strict().nullable(),
}).strict();

export const remotePublishResultSchema = z.object({
  schemaVersion: z.literal(CAREER_WORKSPACE_SCHEMA_VERSION),
  action: z.literal("publish"),
  ok: z.literal(true),
  revision: revisionSchema,
  contentDigest: sha256Schema,
  createdAt: z.iso.datetime(),
  fileCount: z.number().int().nonnegative(),
  noChange: z.boolean(),
}).strict();

export const careerStorageMigrationResultSchema = z.object({
  schemaVersion: z.literal(CAREER_WORKSPACE_SCHEMA_VERSION),
  action: z.literal("migrate"),
  ok: z.literal(true),
  revision: revisionSchema,
  contentDigest: sha256Schema,
  fileCount: z.number().int().nonnegative(),
  sourceArchiveSha256: sha256Schema,
  destinationArchiveSha256: sha256Schema,
  noChange: z.boolean(),
  pointerWritten: z.boolean(),
}).strict();

export const remoteErrorResultSchema = z.object({
  schemaVersion: z.literal(CAREER_WORKSPACE_SCHEMA_VERSION),
  action: z.enum(["status", "export", "publish", "prepare", "check", "diff", "migrate"]),
  ok: z.literal(false),
  code: z.enum([
    "WORKSPACE_DIRTY",
    "REMOTE_UNINITIALIZED",
    "REVISION_CONFLICT",
    "INVALID_MANIFEST",
    "TRANSFER_FAILED",
    "TRANSPORT_UNAVAILABLE",
    "RESTORE_REQUIRED",
  ]),
}).strict();

export type CareerWorkspaceProducer = z.infer<typeof careerWorkspaceProducerSchema>;
export type CareerWorkspaceFileEntry = z.infer<typeof careerWorkspaceFileEntrySchema>;
export type CareerWorkspaceDraftManifest = z.infer<typeof CareerWorkspaceDraftManifestSchema>;
export type CareerWorkspaceReleaseManifest = z.infer<typeof CareerWorkspaceReleaseManifestSchema>;
export type ExcludedWorkspacePath = z.infer<typeof excludedWorkspacePathSchema>;
export type RejectedWorkspacePath = z.infer<typeof rejectedWorkspacePathSchema>;
export type WorkspaceDraftResult = z.infer<typeof workspaceDraftResultSchema>;
export type RemoteStatusResult = z.infer<typeof remoteStatusResultSchema>;
export type RemotePublishResult = z.infer<typeof remotePublishResultSchema>;
export type CareerStorageMigrationResult = z.infer<typeof careerStorageMigrationResultSchema>;
export type RemoteErrorResult = z.infer<typeof remoteErrorResultSchema>;
