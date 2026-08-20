import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { validatedImportSchema, type ValidatedImport } from "./contracts.ts";

type ApproveOptions = {
  now?: () => Date;
};

export function approveImport(
  raw: unknown,
  confirmedBatchId: string,
  options: ApproveOptions = {},
): ValidatedImport {
  const input = validatedImportSchema.parse(raw);
  if (input.batchId !== confirmedBatchId) throw new Error("BATCH_CONFIRMATION_MISMATCH");
  if (!input.validation.submissionReady) throw new Error("IMPORT_NOT_SUBMITTABLE");

  return {
    ...input,
    reviewStatus: "approved",
    reviewedAt: (options.now?.() ?? new Date()).toISOString(),
  };
}

function parseArgs(args: string[]): { input: string; output: string; confirm: string } {
  let input = "";
  let output = "";
  let confirm = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--input") input = args[++index] ?? "";
    else if (arg === "--output") output = args[++index] ?? "";
    else if (arg === "--confirm") confirm = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!input) throw new Error("MISSING_ARGUMENT:--input");
  if (!output) throw new Error("MISSING_ARGUMENT:--output");
  if (!confirm) throw new Error("MISSING_ARGUMENT:--confirm");
  return { input, output, confirm };
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  const raw = JSON.parse(readFileSync(options.input, "utf8"));
  const approved = approveImport(raw, options.confirm);
  writeFileSync(options.output, `${JSON.stringify(approved, null, 2)}\n`, { mode: 0o600 });
  chmodSync(options.output, 0o600);
  process.stdout.write(`${approved.batchId}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`APPROVAL_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
