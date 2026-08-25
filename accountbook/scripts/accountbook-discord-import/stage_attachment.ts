import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inboxSidecarManifestSchema } from "../accountbook-weekly-import/contracts.ts";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;

export type StageDiscordAttachmentOptions = {
  inputPath: string;
  privateRoot: string;
  receivedAt?: Date;
};

export type StageDiscordAttachmentResult = {
  status: "staged" | "already_staged";
  imageSha256: string;
  imagePath: string;
  manifestPath: string;
};

function nowIso(receivedAt?: Date): string {
  const date = receivedAt ?? new Date();
  if (Number.isNaN(date.getTime())) throw new Error("INVALID_RECEIVED_AT");
  return date.toISOString();
}

function assertPngFile(inputPath: string): void {
  if (extname(inputPath).toLowerCase() !== ".png") throw new Error("DISCORD_ATTACHMENT_NOT_PNG");
  const lstat = lstatSync(inputPath);
  if (!lstat.isFile()) throw new Error("DISCORD_ATTACHMENT_NOT_REGULAR_FILE");
  const size = statSync(inputPath).size;
  if (size > MAX_ATTACHMENT_BYTES) throw new Error("DISCORD_ATTACHMENT_TOO_LARGE");
  const signature = readFileSync(inputPath, { encoding: null }).subarray(0, PNG_SIGNATURE.length);
  if (!signature.equals(PNG_SIGNATURE)) throw new Error("DISCORD_ATTACHMENT_NOT_PNG");
}

function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function ensureNewDir(privateRoot: string): string {
  const root = resolve(privateRoot);
  const inbox = join(root, "inbox");
  const newDir = join(inbox, "new");
  for (const directory of [root, inbox, newDir]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
  }
  return newDir;
}

function sameCompletePair(options: {
  imagePath: string;
  manifestPath: string;
  imageSha256: string;
  imageFile: string;
}): boolean {
  if (!existsSync(options.imagePath) || !existsSync(options.manifestPath)) return false;
  try {
    if (sha256(options.imagePath) !== options.imageSha256) return false;
    const manifest = inboxSidecarManifestSchema.parse(JSON.parse(readFileSync(options.manifestPath, "utf8")));
    return manifest.schemaVersion === 1
      && manifest.source === "hermes-discord"
      && manifest.imageFile === options.imageFile;
  } catch {
    return false;
  }
}

function writeJson0600(path: string, value: unknown, replace = false): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: replace ? "w" : "wx" });
  chmodSync(path, 0o600);
}

function removeIfExists(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function stageDiscordAttachment(options: StageDiscordAttachmentOptions): StageDiscordAttachmentResult {
  const inputPath = resolve(options.inputPath);
  assertPngFile(inputPath);
  const receivedAtIso = nowIso(options.receivedAt);
  const imageSha256 = sha256(inputPath);
  const imageBase = `discord-${imageSha256.slice(0, 16)}`;
  const imageFile = `${imageBase}.png`;
  const manifestFile = `${imageBase}.json`;
  const newDir = ensureNewDir(options.privateRoot);
  const imagePath = join(newDir, imageFile);
  const manifestPath = join(newDir, manifestFile);

  if (existsSync(imagePath) || existsSync(manifestPath)) {
    if (sameCompletePair({ imagePath, manifestPath, imageSha256, imageFile })) {
      return { status: "already_staged", imageSha256, imagePath, manifestPath };
    }
    throw new Error("DISCORD_INBOX_PAIR_CONFLICT");
  }

  const tempSuffix = `${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}`;
  const tempImagePath = join(newDir, `.${imageFile}.${tempSuffix}.tmp`);
  const tempManifestPath = join(newDir, `.${manifestFile}.${tempSuffix}.tmp`);
  const manifest = inboxSidecarManifestSchema.parse({
    schemaVersion: 1,
    source: "hermes-discord",
    imageFile,
    capturedAt: receivedAtIso,
    receivedAt: receivedAtIso,
  });

  try {
    copyFileSync(inputPath, tempImagePath);
    chmodSync(tempImagePath, 0o600);
    renameSync(tempImagePath, imagePath);
    chmodSync(imagePath, 0o600);
    writeJson0600(tempManifestPath, manifest);
    renameSync(tempManifestPath, manifestPath);
    chmodSync(manifestPath, 0o600);
    return { status: "staged", imageSha256, imagePath, manifestPath };
  } catch (error) {
    removeIfExists(tempImagePath);
    removeIfExists(tempManifestPath);
    throw error;
  }
}

function parseArgs(args: string[]): StageDiscordAttachmentOptions {
  let inputPath = "";
  let privateRoot = "";
  let receivedAt: Date | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") inputPath = args[++index] ?? "";
    else if (arg === "--private-root") privateRoot = args[++index] ?? "";
    else if (arg === "--received-at") receivedAt = new Date(args[++index] ?? "");
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!inputPath) throw new Error("MISSING_ARGUMENT:--input");
  if (!privateRoot) throw new Error("MISSING_ARGUMENT:--private-root");
  return { inputPath, privateRoot, receivedAt };
}

export function main(args = process.argv.slice(2)): void {
  const result = stageDiscordAttachment(parseArgs(args));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`DISCORD_ATTACHMENT_STAGE_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
