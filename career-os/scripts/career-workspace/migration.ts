import { createHash } from "node:crypto";
import { copyFile, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { compareCodeUnits } from "./manifest.ts";

export type MigrationSourceKind = "current" | "legacy";

export interface MigrationSource {
  label: string;
  root: string;
  targetRoot: "applications" | "library" | "state";
  kind: MigrationSourceKind;
  archivePrefix?: string;
}

export interface MigrationResolution {
  targetPath: string;
  action: "keep-current-and-archive-legacy";
}

export interface BuildMigrationPlanInput {
  workspaceRoot: string;
  sources?: MigrationSource[];
  resolutions?: MigrationResolution[];
}

export interface MigrationFile {
  sourceLabel: string;
  sourcePath: string;
  targetPath: string;
  size: number;
  sha256: string;
}

export interface MigrationConflict {
  targetPath: string;
  candidates: Array<Pick<MigrationFile, "sourceLabel" | "sourcePath" | "size" | "sha256">>;
}

export interface BlockedMigrationFile {
  sourceLabel: string;
  sourcePath: string;
  codes: string[];
}

export interface MigrationPlan {
  schemaVersion: 1;
  action: "migrate-plan";
  ok: true;
  digest: string;
  fileCount: number;
  sources: Array<{ label: string; kind: MigrationSourceKind; discoveredFiles: number }>;
  files: MigrationFile[];
  duplicates: Array<{ targetPath: string; sha256: string; sources: string[] }>;
  conflicts: MigrationConflict[];
  resolvedConflicts: Array<{ targetPath: string; archivedTargetPath: string; action: MigrationResolution["action"] }>;
  blockedFiles: BlockedMigrationFile[];
}

export interface StageMigrationInput extends BuildMigrationPlanInput {
  destination: string;
  plan: MigrationPlan;
}

interface Candidate extends MigrationFile {
  kind: MigrationSourceKind;
  archivePrefix?: string;
}

const textSecretPatterns: Array<[string, RegExp]> = [
  ["blocked-private-key", /-----BEGIN (?:OPENSSH|RSA|EC|DSA) PRIVATE KEY-----/],
  ["blocked-webhook", /https:\/\/[^\s"']+\/services\/[^\s"']+/i],
  ["blocked-credential-assignment", /(?:^|[\s"'])(?:api[_-]?key|access[_-]?token|secret|webhook[_-]?url)\s*[:=]\s*[^\s"']+/im],
  ["blocked-absolute-user-path", /(?:\/Users\/[^/\s]+\/|\/home\/[^/\s]+\/)/],
];

export function defaultMigrationSources(workspaceRoot: string): MigrationSource[] {
  return [
    { label: "current-applications", root: path.join(workspaceRoot, "applications"), targetRoot: "applications", kind: "current" },
    { label: "current-library", root: path.join(workspaceRoot, "library"), targetRoot: "library", kind: "current" },
    { label: "current-state", root: path.join(workspaceRoot, "state"), targetRoot: "state", kind: "current" },
    {
      label: "legacy-data-applications",
      root: path.join(workspaceRoot, "data", "applications"),
      targetRoot: "applications",
      kind: "legacy",
      archivePrefix: "applications/_archive/legacy-data-applications",
    },
    {
      label: "legacy-private",
      root: path.join(workspaceRoot, "private"),
      targetRoot: "library",
      kind: "legacy",
      archivePrefix: "library/_archive/legacy-private",
    },
  ];
}

export async function buildMigrationPlan(input: BuildMigrationPlanInput): Promise<MigrationPlan> {
  const sources = input.sources ?? defaultMigrationSources(input.workspaceRoot);
  validateSources(sources);
  const resolutions = new Map((input.resolutions ?? []).map((resolution) => [resolution.targetPath, resolution]));
  const candidates: Candidate[] = [];
  const blockedFiles: BlockedMigrationFile[] = [];
  const sourceStats: MigrationPlan["sources"] = [];

  for (const source of sources) {
    const discovered = await collectSource(source, candidates, blockedFiles);
    sourceStats.push({ label: source.label, kind: source.kind, discoveredFiles: discovered });
  }

  const byTarget = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const existing = byTarget.get(candidate.targetPath) ?? [];
    existing.push(candidate);
    byTarget.set(candidate.targetPath, existing);
  }

  const files: MigrationFile[] = [];
  const duplicates: MigrationPlan["duplicates"] = [];
  const conflicts: MigrationConflict[] = [];
  const resolvedConflicts: MigrationPlan["resolvedConflicts"] = [];

  for (const targetPath of [...byTarget.keys()].toSorted(compareCodeUnits)) {
    const group = byTarget.get(targetPath)!.toSorted(compareCandidates);
    const distinctHashes = new Set(group.map((candidate) => candidate.sha256));
    if (distinctHashes.size === 1) {
      const selected = group.find((candidate) => candidate.kind === "current") ?? group[0];
      files.push(toMigrationFile(selected));
      if (group.length > 1) {
        duplicates.push({
          targetPath,
          sha256: selected.sha256,
          sources: group.map((candidate) => candidate.sourceLabel),
        });
      }
      continue;
    }

    const resolution = resolutions.get(targetPath);
    const current = group.find((candidate) => candidate.kind === "current");
    const legacy = group.filter((candidate) => candidate.kind === "legacy");
    if (resolution?.action === "keep-current-and-archive-legacy" && current && legacy.length > 0) {
      files.push(toMigrationFile(current));
      for (const legacyCandidate of legacy) {
        const archived = archiveLegacyCandidate(legacyCandidate);
        files.push(archived);
        resolvedConflicts.push({
          targetPath,
          archivedTargetPath: archived.targetPath,
          action: resolution.action,
        });
      }
      continue;
    }

    conflicts.push({
      targetPath,
      candidates: group.map(({ sourceLabel, sourcePath, size, sha256 }) => ({ sourceLabel, sourcePath, size, sha256 })),
    });
  }

  for (const candidate of candidates.filter((entry) => entry.kind === "legacy")) {
    const targetGroup = byTarget.get(candidate.targetPath) ?? [];
    if (targetGroup.length !== 1) {
      continue;
    }
    const index = files.findIndex((file) => file.sourceLabel === candidate.sourceLabel && file.sourcePath === candidate.sourcePath);
    if (index >= 0) {
      files[index] = archiveLegacyCandidate(candidate);
    }
  }

  const sortedFiles = files.toSorted((left, right) => compareCodeUnits(left.targetPath, right.targetPath));
  const digest = createHash("sha256");
  for (const file of sortedFiles) {
    digest.update(file.targetPath);
    digest.update("\0");
    digest.update(String(file.size));
    digest.update("\0");
    digest.update(file.sha256);
    digest.update("\n");
  }

  return {
    schemaVersion: 1,
    action: "migrate-plan",
    ok: true,
    digest: digest.digest("hex"),
    fileCount: sortedFiles.length,
    sources: sourceStats,
    files: sortedFiles,
    duplicates: duplicates.toSorted((left, right) => compareCodeUnits(left.targetPath, right.targetPath)),
    conflicts: conflicts.toSorted((left, right) => compareCodeUnits(left.targetPath, right.targetPath)),
    resolvedConflicts: resolvedConflicts.toSorted((left, right) => compareCodeUnits(left.archivedTargetPath, right.archivedTargetPath)),
    blockedFiles: blockedFiles.toSorted((left, right) => compareCodeUnits(left.sourcePath, right.sourcePath)),
  };
}

export async function stageMigrationPlan(input: StageMigrationInput): Promise<{ fileCount: number; digest: string }> {
  if (input.plan.conflicts.length > 0 || input.plan.blockedFiles.length > 0) {
    throw new Error("migration plan still has unresolved files");
  }
  if (await exists(input.destination)) {
    throw new Error("migration destination must not exist");
  }
  const sources = input.sources ?? defaultMigrationSources(input.workspaceRoot);
  const sourceByLabel = new Map(sources.map((source) => [source.label, source]));
  for (const managedRoot of ["applications", "library", "state"] as const) {
    await mkdir(path.join(input.destination, managedRoot), { recursive: true });
  }
  for (const file of input.plan.files) {
    const source = sourceByLabel.get(file.sourceLabel);
    if (!source) throw new Error(`unknown migration source: ${file.sourceLabel}`);
    const sourcePath = path.join(source.root, ...file.sourcePath.split("/"));
    const before = await hashFile(sourcePath);
    if (before.size !== file.size || before.sha256 !== file.sha256) {
      throw new Error(`migration source changed: ${file.sourceLabel}/${file.sourcePath}`);
    }
    const target = path.join(input.destination, ...file.targetPath.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(sourcePath, target);
    const after = await hashFile(target);
    if (after.size !== file.size || after.sha256 !== file.sha256) {
      throw new Error(`migration copy verification failed: ${file.targetPath}`);
    }
  }
  return { fileCount: input.plan.fileCount, digest: input.plan.digest };
}

async function collectSource(
  source: MigrationSource,
  candidates: Candidate[],
  blockedFiles: BlockedMigrationFile[],
): Promise<number> {
  if (!await exists(source.root)) {
    return 0;
  }
  const rootStat = await lstat(source.root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    blockedFiles.push({ sourceLabel: source.label, sourcePath: ".", codes: ["blocked-non-directory-root"] });
    return 1;
  }
  let discovered = 0;
  for (const relativePath of await listFiles(source.root)) {
    discovered += 1;
    const absolute = path.join(source.root, ...relativePath.split("/"));
    const codes = await blockedCodes(relativePath, absolute);
    if (codes.length > 0) {
      blockedFiles.push({ sourceLabel: source.label, sourcePath: relativePath, codes });
      continue;
    }
    const body = await readFile(absolute);
    candidates.push({
      sourceLabel: source.label,
      sourcePath: relativePath,
      targetPath: `${source.targetRoot}/${relativePath}`,
      size: body.byteLength,
      sha256: createHash("sha256").update(body).digest("hex"),
      kind: source.kind,
      archivePrefix: source.archivePrefix,
    });
  }
  return discovered;
}

async function listFiles(root: string, current = ""): Promise<string[]> {
  const absolute = current ? path.join(root, ...current.split("/")) : root;
  const entries = (await readdir(absolute, { withFileTypes: true })).toSorted((left, right) => compareCodeUnits(left.name, right.name));
  const files: string[] = [];
  for (const entry of entries) {
    const relative = current ? `${current}/${entry.name}` : entry.name;
    const entryPath = path.join(absolute, entry.name);
    const entryStat = await lstat(entryPath);
    if (entryStat.isSymbolicLink() || (!entryStat.isDirectory() && !entryStat.isFile())) {
      files.push(relative);
      continue;
    }
    if (entryStat.isDirectory()) {
      files.push(...await listFiles(root, relative));
    } else {
      files.push(relative);
    }
  }
  return files;
}

async function blockedCodes(relativePath: string, absolutePath: string): Promise<string[]> {
  const parts = relativePath.split("/");
  const basename = parts.at(-1) ?? "";
  const codes = new Set<string>();
  if (basename === ".env" || basename.startsWith(".env.")) codes.add("blocked-env");
  if (parts.includes(".omc")) codes.add("blocked-omc");
  if (parts.some((part) => part === "cache" || part === ".cache")) codes.add("blocked-cache");
  if (parts.some((part) => part === "logs") || basename.endsWith(".log")) codes.add("blocked-log");
  if (parts.some((part) => part === "tmp" || part === "temp") || basename.endsWith(".tmp") || basename.endsWith(".swp")) {
    codes.add("blocked-temp");
  }
  if (/^(?:id_(?:rsa|dsa|ecdsa|ed25519)|.+\.pem|.+\.key)$/i.test(basename)) codes.add("blocked-key-file");

  const stat = await lstat(absolutePath);
  if (stat.isSymbolicLink()) codes.add("blocked-symlink");
  if (!stat.isFile()) codes.add("blocked-non-regular");
  if (codes.size > 0 || stat.size > 2 * 1024 * 1024) {
    return [...codes].sort();
  }
  const body = await readFile(absolutePath);
  if (body.includes(0)) {
    return [];
  }
  const text = body.toString("utf8");
  for (const [code, pattern] of textSecretPatterns) {
    if (pattern.test(text)) codes.add(code);
  }
  return [...codes].sort();
}

function archiveLegacyCandidate(candidate: Candidate): MigrationFile {
  if (!candidate.archivePrefix) {
    throw new Error(`legacy source ${candidate.sourceLabel} requires archivePrefix`);
  }
  return {
    ...toMigrationFile(candidate),
    targetPath: `${candidate.archivePrefix}/${candidate.sourcePath}`,
  };
}

function toMigrationFile(candidate: Candidate): MigrationFile {
  const { sourceLabel, sourcePath, targetPath, size, sha256 } = candidate;
  return { sourceLabel, sourcePath, targetPath, size, sha256 };
}

function compareCandidates(left: Candidate, right: Candidate): number {
  if (left.kind !== right.kind) return left.kind === "current" ? -1 : 1;
  return compareCodeUnits(left.sourceLabel, right.sourceLabel) || compareCodeUnits(left.sourcePath, right.sourcePath);
}

function validateSources(sources: MigrationSource[]): void {
  const labels = new Set<string>();
  for (const source of sources) {
    if (!source.label || labels.has(source.label)) throw new Error("migration source labels must be unique");
    labels.add(source.label);
    if (source.kind === "legacy" && !source.archivePrefix) throw new Error("legacy migration source requires archivePrefix");
  }
}

async function exists(target: string): Promise<boolean> {
  try {
    await lstat(target);
    return true;
  } catch {
    return false;
  }
}

async function hashFile(target: string): Promise<{ size: number; sha256: string }> {
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("migration source must be a regular file");
  const body = await readFile(target);
  return { size: body.byteLength, sha256: createHash("sha256").update(body).digest("hex") };
}
