import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function buildBundle(outdir: string) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const result = await Bun.build({
    entrypoints: [resolve(root, "src/server.ts")],
    target: "bun",
    format: "esm",
    minify: true,
    outdir,
    naming: "accountbook-mcp.js",
  });
  if (!result.success) throw new Error("ACCOUNTBOOK_BUILD_FAILED");
  // Zod embeds generated function source with whitespace-only lines.
  // Normalize those blank lines in the committed bundle for diff checks.
  for (const output of result.outputs) {
    await Bun.write(output.path, (await output.text()).replace(/^[\t ]+$/gm, ""));
  }
}

if (import.meta.main) await buildBundle(resolve(import.meta.dir, "../dist"));
