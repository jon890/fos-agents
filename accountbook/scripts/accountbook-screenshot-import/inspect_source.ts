import { createHash } from "node:crypto";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync, statSync, writeFileSync, chmodSync } from "node:fs";
import { z } from "zod";

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const rfc3339DateTimeSchema = z.string().datetime({ offset: true });

export type SourceImageMetadata = {
  fileName: string;
  sha256: string;
  capturedAt: string;
  width: number;
  height: number;
};

export function inspectPng(path: string, capturedAtOverride?: string): SourceImageMetadata {
  const stat = statSync(path);
  if (!stat.isFile()) throw new Error("SOURCE_NOT_FILE");
  if (stat.size <= 0 || stat.size > MAX_IMAGE_BYTES) throw new Error("SOURCE_SIZE_UNSUPPORTED");

  const data = readFileSync(path);
  if (data.length < 24 || !data.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("SOURCE_FORMAT_UNSUPPORTED:PNG_REQUIRED");
  }
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  if (width <= 0 || height <= 0) throw new Error("INVALID_PNG_DIMENSIONS");
  const capturedAt = capturedAtOverride ?? (stat.birthtimeMs > 0 ? stat.birthtime : stat.mtime).toISOString();
  if (!rfc3339DateTimeSchema.safeParse(capturedAt).success) {
    throw new Error("INVALID_CAPTURED_AT");
  }

  return {
    fileName: basename(path),
    sha256: createHash("sha256").update(data).digest("hex"),
    capturedAt,
    width,
    height,
  };
}

function parseArgs(args: string[]): { input: string; output?: string; capturedAt?: string } {
  let input = "";
  let output: string | undefined;
  let capturedAt: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") input = args[++index] ?? "";
    else if (arg === "--output") output = args[++index];
    else if (arg === "--captured-at") capturedAt = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!input) throw new Error("MISSING_ARGUMENT:--input");
  return { input, output, capturedAt };
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  const serialized = `${JSON.stringify(inspectPng(options.input, options.capturedAt), null, 2)}\n`;
  if (options.output) {
    writeFileSync(options.output, serialized, { mode: 0o600 });
    chmodSync(options.output, 0o600);
  } else {
    process.stdout.write(serialized);
  }
}
const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`SOURCE_INSPECTION_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
