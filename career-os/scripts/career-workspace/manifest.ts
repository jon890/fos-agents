import { createHash } from "node:crypto";
import { lstat, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  CAREER_WORKSPACE_MANAGED_ROOTS,
  CAREER_WORKSPACE_NAME,
  CAREER_WORKSPACE_SCHEMA_VERSION,
  CareerWorkspaceDraftManifestSchema,
  type CareerWorkspaceDraftManifest,
  type CareerWorkspaceFileEntry,
  type CareerWorkspaceProducer,
  type ExcludedWorkspacePath,
  type RejectedWorkspacePath,
  type WorkspaceDraftResult,
} from "./contracts.ts";

export class WorkspaceManifestError extends Error {
  constructor(
    message: string,
    readonly rejected: RejectedWorkspacePath[],
    readonly excluded: ExcludedWorkspacePath[],
  ) {
    super(message);
    this.name = "WorkspaceManifestError";
  }
}

export interface BuildWorkspaceDraftOptions {
  parentRevision?: string | null;
}

interface CollectedWorkspaceFiles {
  files: CareerWorkspaceFileEntry[];
  excluded: ExcludedWorkspacePath[];
  rejected: RejectedWorkspacePath[];
}

export async function buildWorkspaceDraft(
  root: string,
  producer: CareerWorkspaceProducer,
  options: BuildWorkspaceDraftOptions = {},
): Promise<WorkspaceDraftResult> {
  const collected = await collectWorkspaceFiles(root);
  if (collected.rejected.length > 0) {
    throw new WorkspaceManifestError("workspace contains rejected paths", collected.rejected, collected.excluded);
  }

  const files = sortWorkspaceFiles(collected.files);
  const manifest: CareerWorkspaceDraftManifest = {
    schemaVersion: CAREER_WORKSPACE_SCHEMA_VERSION,
    workspace: CAREER_WORKSPACE_NAME,
    parentRevision: options.parentRevision ?? null,
    producer,
    contentDigest: digestWorkspaceFiles(files),
    files,
  };

  return {
    manifest: CareerWorkspaceDraftManifestSchema.parse(manifest),
    excluded: collected.excluded.toSorted((left, right) => compareCodeUnits(left.path, right.path)),
  };
}

export function sortWorkspaceFiles(files: readonly CareerWorkspaceFileEntry[]): CareerWorkspaceFileEntry[] {
  return files.toSorted((left, right) => compareCodeUnits(left.path, right.path));
}

export function compareCodeUnits(left: string, right: string): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
}

export function digestWorkspaceFiles(files: readonly CareerWorkspaceFileEntry[]): string {
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file.path);
    digest.update("\0");
    digest.update(String(file.size));
    digest.update("\0");
    digest.update(file.sha256);
    digest.update("\n");
  }
  return digest.digest("hex");
}

export async function collectWorkspaceFiles(root: string): Promise<CollectedWorkspaceFiles> {
  const absoluteRoot = path.resolve(root);
  const result: CollectedWorkspaceFiles = { files: [], excluded: [], rejected: [] };

  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    await collectPath(absoluteRoot, managedRoot, result);
  }

  return result;
}

async function collectPath(
  absoluteRoot: string,
  relativePath: string,
  result: CollectedWorkspaceFiles,
): Promise<void> {
  const decision = classifyRelativePath(relativePath);
  if (decision.type === "excluded") {
    result.excluded.push({ path: relativePath, code: decision.code });
    return;
  }
  if (decision.type === "rejected") {
    result.rejected.push({ path: relativePath, code: decision.code });
    return;
  }

  const absolutePath = path.join(absoluteRoot, relativePath);
  let entryStat;
  try {
    entryStat = await lstat(absolutePath);
  } catch (error) {
    if (isNotFound(error)) {
      return;
    }
    throw error;
  }

  if (entryStat.isSymbolicLink()) {
    result.rejected.push({ path: relativePath, code: "rejected-symlink" });
    return;
  }

  if (entryStat.isDirectory()) {
    const children = (await readdir(absolutePath)).toSorted(compareCodeUnits);
    for (const child of children) {
      await collectPath(absoluteRoot, posixJoin(relativePath, child), result);
    }
    return;
  }

  if (!entryStat.isFile()) {
    result.rejected.push({ path: relativePath, code: "rejected-non-regular" });
    return;
  }

  const before = await stat(absolutePath);
  const body = await readFile(absolutePath);
  const after = await stat(absolutePath);

  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    result.rejected.push({ path: relativePath, code: "rejected-changing-source" });
    return;
  }

  result.files.push({
    path: relativePath,
    size: body.byteLength,
    sha256: createHash("sha256").update(body).digest("hex"),
  });
}

type PathDecision =
  | { type: "included" }
  | { type: "excluded"; code: ExcludedWorkspacePath["code"] }
  | { type: "rejected"; code: RejectedWorkspacePath["code"] };

function classifyRelativePath(relativePath: string): PathDecision {
  const parts = relativePath.split("/");
  if (
    relativePath.startsWith("/")
    || relativePath.includes("\\")
    || relativePath.includes("\0")
    || parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    return { type: "rejected", code: "rejected-path" };
  }

  const root = parts[0];
  if (!CAREER_WORKSPACE_MANAGED_ROOTS.includes(root as (typeof CAREER_WORKSPACE_MANAGED_ROOTS)[number])) {
    return { type: "excluded", code: "excluded-unmanaged-root" };
  }

  const basename = parts.at(-1) ?? "";
  if (parts.includes(".career-sync")) {
    return { type: "excluded", code: "excluded-career-sync" };
  }
  if (basename === ".env" || basename.startsWith(".env.")) {
    return { type: "excluded", code: "excluded-env" };
  }
  if (parts.includes(".omc")) {
    return { type: "excluded", code: "excluded-omc" };
  }
  if (parts.includes("cache") || parts.includes(".cache")) {
    return { type: "excluded", code: "excluded-cache" };
  }
  if (parts.includes("tmp") || parts.includes("temp") || basename.endsWith(".tmp") || basename.endsWith(".swp")) {
    return { type: "excluded", code: "excluded-temp" };
  }
  if (parts.includes("logs") || basename.endsWith(".log")) {
    return { type: "excluded", code: "excluded-log" };
  }
  if (basename.startsWith(".") && ![".gitkeep"].includes(basename)) {
    return { type: "excluded", code: "excluded-hidden" };
  }

  return { type: "included" };
}

function posixJoin(parent: string, child: string): string {
  return `${parent}/${child}`;
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
