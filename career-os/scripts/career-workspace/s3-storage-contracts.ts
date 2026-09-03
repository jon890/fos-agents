import { z } from "zod";
import {
  CAREER_WORKSPACE_NAME,
  CAREER_WORKSPACE_SCHEMA_VERSION,
  revisionSchema,
} from "./contracts.ts";

const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const fileCountSchema = z.number().int().nonnegative();

const releaseSummaryShape = {
  schemaVersion: z.literal(CAREER_WORKSPACE_SCHEMA_VERSION),
  workspace: z.literal(CAREER_WORKSPACE_NAME),
  revision: revisionSchema,
  contentDigest: sha256Schema,
  createdAt: z.iso.datetime(),
  fileCount: fileCountSchema,
};

export const CareerStorageReleaseDescriptorSchema = z.object({
  ...releaseSummaryShape,
  archiveKey: z.string(),
  archiveSha256: sha256Schema,
  manifestKey: z.string(),
  manifestSha256: sha256Schema,
}).strict().superRefine((descriptor, context) => {
  const releasePrefix = `releases/${descriptor.revision}`;
  if (descriptor.archiveKey !== `${releasePrefix}/workspace.tar`) {
    context.addIssue({
      code: "custom",
      path: ["archiveKey"],
      message: "archiveKey must identify the descriptor revision archive",
    });
  }
  if (descriptor.manifestKey !== `${releasePrefix}/workspace-manifest.json`) {
    context.addIssue({
      code: "custom",
      path: ["manifestKey"],
      message: "manifestKey must identify the descriptor revision manifest",
    });
  }
});

export const CareerStoragePointerSchema = z.object({
  ...releaseSummaryShape,
  descriptorKey: z.string(),
  descriptorSha256: sha256Schema,
}).strict().superRefine((pointer, context) => {
  if (pointer.descriptorKey !== `releases/${pointer.revision}/release.json`) {
    context.addIssue({
      code: "custom",
      path: ["descriptorKey"],
      message: "descriptorKey must identify the pointer revision descriptor",
    });
  }
});

export const CareerStorageS3EnvironmentSchema = z.object({
  CAREER_STORAGE_S3_ENDPOINT: z.url({ protocol: /^https?$/ }),
  CAREER_STORAGE_S3_BUCKET: z.literal(CAREER_WORKSPACE_NAME),
  CAREER_STORAGE_S3_ACCESS_KEY: z.string().min(1),
  CAREER_STORAGE_S3_SECRET_KEY: z.string().min(1),
}).strict();

export type CareerStorageReleaseDescriptor = z.infer<typeof CareerStorageReleaseDescriptorSchema>;
export type CareerStoragePointer = z.infer<typeof CareerStoragePointerSchema>;
export type CareerStorageS3Environment = z.infer<typeof CareerStorageS3EnvironmentSchema>;
