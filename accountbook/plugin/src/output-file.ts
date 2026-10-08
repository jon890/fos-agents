import { constants } from "node:fs";
import { open, readdir, lstat, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { AccountbookError } from "./client.ts";

const ownFile =
  /^list_(expenses|incomes)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}\.jsonl$/;

// Only validated, projected records reach this writer. Never serialize an API response or error.
export async function writeOutputFile(
  directory: string,
  tool: "list_expenses" | "list_incomes",
  rows: Record<string, unknown>[],
  now: Date,
) {
  const root = resolve(directory);
  let file: string | undefined;
  let created = false;
  try {
    for (const name of await readdir(root)) {
      if (!ownFile.test(name)) continue;
      const candidate = join(root, name);
      try {
        const stat = await lstat(candidate);
        if (stat.isFile() && stat.mtimeMs < now.getTime() - 24 * 60 * 60 * 1000)
          await unlink(candidate);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    file = join(root, `${tool}-${now.toISOString().replace(/[:.]/g, "-")}-${randomUUID()}.jsonl`);
    const handle = await open(
      file,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600,
    );
    created = true;
    try {
      await handle.writeFile(rows.map((row) => JSON.stringify(row) + "\n").join(""), "utf8");
    } finally {
      await handle.close();
    }
    return file;
  } catch {
    if (created && file) await unlink(file).catch(() => {});
    throw new AccountbookError("ACCOUNTBOOK_OUTPUT_UNAVAILABLE");
  }
}
