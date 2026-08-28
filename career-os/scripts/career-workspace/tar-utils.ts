import { cp, lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { CAREER_WORKSPACE_MANAGED_ROOTS, type RemoteErrorResult } from "./contracts.ts";
import { compareCodeUnits } from "./manifest.ts";
import { makeRemoteError, TransportError } from "./transport.ts";

export async function createTarFromDirectory(root: string, entries: readonly string[]): Promise<Uint8Array> {
  const proc = Bun.spawn(["tar", "--format", "ustar", "-cf", "-", ...entries], {
    cwd: root,
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).bytes(), proc.exited]);
  if (exitCode !== 0) {
    throw new Error("tar create failed");
  }
  return stdout;
}

type TarAction = RemoteErrorResult["action"];

export async function extractTarToDirectory(
  archive: Uint8Array,
  destination: string,
  allowed: readonly string[],
  action: TarAction,
): Promise<void> {
  const archiveBytes = toBytes(archive);
  validateTarEntries(archiveBytes, allowed, action);
  await mkdir(destination, { recursive: true });
  const archivePath = path.join(destination, ".archive.tar");
  await writeFile(archivePath, archiveBytes);
  const proc = Bun.spawn(["tar", "-xf", archivePath, "-C", destination], {
    env: { ...process.env, COPYFILE_DISABLE: "1" },
    stdout: "ignore",
    stderr: "pipe",
  });
  if (await proc.exited !== 0) {
    throw new TransportError(makeRemoteError(action, "TRANSFER_FAILED"));
  }
  await rm(archivePath, { force: true });
  await verifyExtractedTree(destination, action);
}

export async function validateTarTopLevel(archive: Uint8Array, allowed: readonly string[], action: TarAction): Promise<void> {
  validateTarEntries(toBytes(archive), allowed, action);
}

export async function copyManagedRoots(from: string, to: string): Promise<void> {
  for (const root of CAREER_WORKSPACE_MANAGED_ROOTS) {
    const source = path.join(from, root);
    const target = path.join(to, root);
    if (await exists(source)) {
      await cp(source, target, { recursive: true, force: true, errorOnExist: false });
    } else {
      await mkdir(target, { recursive: true });
    }
  }
}

export async function listRelativeFiles(root: string, base = root): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.toSorted((left, right) => compareCodeUnits(left.name, right.name))) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listRelativeFiles(absolute, base));
    } else if (entry.isFile()) {
      files.push(path.relative(base, absolute).split(path.sep).join("/"));
    }
  }
  return files;
}

export async function safeRemove(target: string): Promise<void> {
  await rm(target, { recursive: true, force: true });
}

function validateTarEntries(archive: Uint8Array, allowed: readonly string[], action: TarAction): void {
  const allowedSet = new Set(allowed);
  const seenExactTopLevels = new Set<string>();
  let offset = 0;
  let entryCount = 0;
  while (offset + 512 <= archive.byteLength) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      break;
    }
    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const fullName = prefix ? `${prefix}/${name}` : name;
    const size = Number.parseInt(tarString(header, 124, 12).trim() || "0", 8);
    const typeFlag = String.fromCharCode(header[156] || 48);
    if (!Number.isFinite(size) || size < 0) {
      throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
    }
    if (!["0", "5"].includes(typeFlag)) {
      throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
    }
    const entryPath = validateTarPath(fullName, allowedSet, action);
    validateTopLevelType(entryPath, typeFlag, action);
    if (entryPath.normalized === entryPath.topLevel) {
      seenExactTopLevels.add(entryPath.topLevel);
    }
    entryCount += 1;
    const nextOffset = offset + 512 + Math.ceil(size / 512) * 512;
    if (nextOffset > archive.byteLength) {
      throw new TransportError(makeRemoteError(action, "TRANSFER_FAILED"));
    }
    offset = nextOffset;
  }
  if (entryCount === 0) {
    throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
  }
  for (const required of allowed) {
    if (!seenExactTopLevels.has(required)) {
      throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
    }
  }
}

function validateTopLevelType(
  entryPath: { normalized: string; topLevel: string },
  typeFlag: string,
  action: TarAction,
): void {
  const isExactTopLevel = entryPath.normalized === entryPath.topLevel;
  const expectsFile = entryPath.topLevel === "workspace-manifest.json" || entryPath.topLevel === "workspace-draft.json";
  if (expectsFile) {
    if (!isExactTopLevel || typeFlag !== "0") {
      throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
    }
    return;
  }
  if (isExactTopLevel && typeFlag !== "5") {
    throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
  }
}

function validateTarPath(
  rawName: string,
  allowedSet: ReadonlySet<string>,
  action: TarAction,
): { normalized: string; topLevel: string } {
  const normalized = rawName.replace(/^\.\//, "").replace(/\/$/, "");
  const parts = normalized.split("/");
  const hasUnsafeSegment = normalized === ""
    || normalized.startsWith("/")
    || normalized.includes("\\")
    || /[\0-\x1F\x7F]/.test(normalized)
    || parts.some((part) => part === "" || part === "." || part === "..");
  if (hasUnsafeSegment || !allowedSet.has(parts[0])) {
    throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
  }
  return { normalized, topLevel: parts[0] };
}

async function verifyExtractedTree(root: string, action: TarAction): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".archive.tar") {
      continue;
    }
    const absolute = path.join(root, entry.name);
    const fileStat = await lstat(absolute);
    if (fileStat.isSymbolicLink() || (!fileStat.isDirectory() && !fileStat.isFile())) {
      throw new TransportError(makeRemoteError(action, "INVALID_MANIFEST"));
    }
    if (fileStat.isDirectory()) {
      await verifyExtractedTree(absolute, action);
    }
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

function tarString(header: Uint8Array, start: number, length: number): string {
  const slice = header.subarray(start, start + length);
  const end = slice.indexOf(0);
  return new TextDecoder().decode(end >= 0 ? slice.subarray(0, end) : slice);
}

function toBytes(archive: Uint8Array | ArrayBuffer): Uint8Array {
  return archive instanceof Uint8Array ? archive : new Uint8Array(archive);
}
