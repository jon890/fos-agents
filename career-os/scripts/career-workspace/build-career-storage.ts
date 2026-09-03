import path from "node:path";

export async function buildCareerStorage(args: readonly string[]): Promise<void> {
  if (args.length !== 2 || args[0] !== "--output" || !args[1]) {
    throw new Error("build output is required");
  }
  const output = path.resolve(args[1]);
  const entrypoint = path.join(import.meta.dir, "career-storage-s3.ts");
  const proc = Bun.spawn(["bun", "build", "--compile", entrypoint, "--outfile", output], {
    stdin: "ignore",
    stdout: "inherit",
    stderr: "inherit",
  });
  if (await proc.exited !== 0) {
    throw new Error("career-storage build failed");
  }
}

if (import.meta.main) {
  try {
    await buildCareerStorage(process.argv.slice(2));
  } catch {
    process.stderr.write("career-storage build failed\n");
    process.exit(1);
  }
}
