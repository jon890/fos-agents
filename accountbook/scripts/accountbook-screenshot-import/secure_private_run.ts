import { chmodSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const BATCH_ID = /^toss-[a-f0-9]{16}$/;

function secureTree(directory: string): void {
  chmodSync(directory, 0o700);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) secureTree(path);
    else if (entry.isFile()) chmodSync(path, 0o600);
  }
}

export function securePrivateRun(privateRoot: string, batchId: string): string {
  if (!BATCH_ID.test(batchId)) throw new Error("INVALID_BATCH_ID");

  const root = resolve(privateRoot);
  const imports = resolve(root, "imports");
  const runDir = resolve(imports, batchId);
  if (!runDir.startsWith(`${imports}${sep}`)) throw new Error("RUN_PATH_OUTSIDE_PRIVATE_ROOT");

  for (const directory of [root, imports, runDir]) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
  }
  secureTree(root);
  return runDir;
}

function parseArgs(args: string[]): { privateRoot: string; batchId: string } {
  let privateRoot = "";
  let batchId = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--private-root") privateRoot = args[++index] ?? "";
    else if (arg === "--batch-id") batchId = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!privateRoot) throw new Error("MISSING_ARGUMENT:--private-root");
  if (!batchId) throw new Error("MISSING_ARGUMENT:--batch-id");
  return { privateRoot, batchId };
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  const runDir = securePrivateRun(options.privateRoot, options.batchId);
  process.stdout.write(`${runDir}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`PRIVATE_RUN_SECURITY_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
