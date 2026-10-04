import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dist = join(import.meta.dir, "../dist");

/**
 * 빌드를 별도 bun 프로세스에서 실행한다. 같은 `bun test` 프로세스에서 Bun.build 를 부르면
 * 함께 실행하는 테스트 파일의 해석 상태를 공유해, `.js` 로 적은 TypeScript import 를
 * 못 찾는 경우가 있다. 저장소의 `bun run build` 와 같은 조건에서 빌드한다.
 */
async function buildInto(outdir: string) {
  const proc = Bun.spawn(["bun", join(import.meta.dir, "build.ts"), outdir], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited]);
  if (exitCode !== 0) throw new Error(`build exited with ${exitCode}: ${stderr}`);
}

let out = "";

beforeAll(async () => {
  out = mkdtempSync(join(tmpdir(), "career-bundle-"));
  await buildInto(out);
}, 60_000);

afterAll(() => {
  if (out) rmSync(out, { recursive: true, force: true });
});

test("커밋한 실행 파일이 원본 빌드와 일치한다", () => {
  expect(readFileSync(join(out, "career-mcp.js"), "utf8")).toBe(readFileSync(join(dist, "career-mcp.js"), "utf8"));
});

test("커밋한 로컬 실행기 번들이 원본 빌드와 일치한다", () => {
  expect(readFileSync(join(out, "career-local.js"), "utf8")).toBe(readFileSync(join(dist, "career-local.js"), "utf8"));
});
