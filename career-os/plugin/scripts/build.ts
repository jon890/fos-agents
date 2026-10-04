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
    naming: "career-mcp.js",
  });
  if (!result.success) throw new Error("CAREER_BUILD_FAILED");
  // Zod embeds generated function source with whitespace-only lines.
  // Normalize those blank lines in the committed bundle for diff checks.
  for (const output of result.outputs) {
    await Bun.write(output.path, (await output.text()).replace(/^[\t ]+$/gm, ""));
  }
}

/**
 * 로컬 실행기 번들이다. 면접과 공부 실행기를 하나로 묶어, plugin 만 설치한 곳에서
 * 저장소와 `bun install` 없이 실행하게 한다(ADR-138).
 */
export async function buildLocalBundle(outdir: string) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const repositoryRoot = resolve(root, "../..");
  const result = await Bun.build({
    entrypoints: [resolve(root, "../scripts/plugin-local/main.ts")],
    target: "bun",
    format: "esm",
    minify: true,
    outdir,
    naming: "career-local.js",
    plugins: [
      {
        // services/career-backend 에 node_modules 가 설치돼 있으면 그 아래 zod 가
        // 따로 해석돼 번들이 달라진다. 저장소 루트의 zod 하나로 고정한다.
        name: "pin-zod-to-repository-root",
        setup(build) {
          build.onResolve({ filter: /^zod(\/.*)?$/ }, (args) => ({
            path: Bun.resolveSync(args.path, repositoryRoot),
          }));
        },
      },
    ],
  });
  if (!result.success) throw new Error("CAREER_LOCAL_BUILD_FAILED");
  for (const output of result.outputs) {
    await Bun.write(output.path, (await output.text()).replace(/^[\t ]+$/gm, ""));
  }
}

if (import.meta.main) {
  // 출력 위치를 인자로 받는다. 테스트는 임시 디렉터리를 넘겨 별도 프로세스에서 빌드한다.
  const outdir = resolve(process.argv[2] ?? resolve(import.meta.dir, "../dist"));
  await buildBundle(outdir);
  await buildLocalBundle(outdir);
}
