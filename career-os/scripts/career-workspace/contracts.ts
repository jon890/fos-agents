import { z } from "zod";

export const CAREER_WORKSPACE_SCHEMA_VERSION = 1;
export const CAREER_WORKSPACE_NAME = "career-os";
export const CAREER_WORKSPACE_MANAGED_ROOTS = ["applications", "private", "state"] as const;

export const producerModeSchema = z.enum(["interactive", "automation"]);

const nonEmptyString = z.string().trim().min(1);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const workspaceRelativePathSchema = nonEmptyString.superRefine((path, context) => {
  const parts = path.split("/");
  if (
    path.startsWith("/")
    || path.includes("\\")
    || path.includes("\0")
    || parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    context.addIssue({
      code: "custom",
      message: "workspace path must be a safe relative POSIX path",
    });
  }

  if (!CAREER_WORKSPACE_MANAGED_ROOTS.some((root) => path === root || path.startsWith(`${root}/`))) {
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
  parentRevision: nonEmptyString.nullable(),
  producer: careerWorkspaceProducerSchema,
  contentDigest: sha256Schema,
  files: z.array(careerWorkspaceFileEntrySchema),
}).strict();

export const CareerWorkspaceReleaseManifestSchema = CareerWorkspaceDraftManifestSchema.extend({
  revision: nonEmptyString,
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

export type CareerWorkspaceProducer = z.infer<typeof careerWorkspaceProducerSchema>;
export type CareerWorkspaceFileEntry = z.infer<typeof careerWorkspaceFileEntrySchema>;
export type CareerWorkspaceDraftManifest = z.infer<typeof CareerWorkspaceDraftManifestSchema>;
export type CareerWorkspaceReleaseManifest = z.infer<typeof CareerWorkspaceReleaseManifestSchema>;
export type ExcludedWorkspacePath = z.infer<typeof excludedWorkspacePathSchema>;
export type RejectedWorkspacePath = z.infer<typeof rejectedWorkspacePathSchema>;
export type WorkspaceDraftResult = z.infer<typeof workspaceDraftResultSchema>;
