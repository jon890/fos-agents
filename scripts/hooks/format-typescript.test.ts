import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatTargets, patchTargets, repositoryRoot } from "./format-typescript.ts";

const directories: string[] = [];
const files: string[] = [];
afterEach(() => {
  files.splice(0).forEach((file) => unlinkSync(file));
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }));
});

function hookCommand(): string {
  const hooks = JSON.parse(readFileSync(".codex/hooks.json", "utf8"));
  return hooks.hooks.PostToolUse.find(
    (entry: { matcher?: string }) => entry.matcher === "^apply_patch$",
  ).hooks[0].command;
}

async function invoke(cwd: string, patch: string): Promise<{ exitCode: number; stdout: string }> {
  const child = Bun.spawn(["/bin/sh", "-lc", hookCommand()], {
    cwd,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  child.stdin.write(JSON.stringify({ cwd, tool_input: { patch } }));
  child.stdin.end();
  return { exitCode: await child.exited, stdout: await new Response(child.stdout).text() };
}

test("복수 파일과 이동 대상에서 TypeScript만 고른다", () => {
  expect(
    patchTargets(
      "*** Update File: a.ts\n*** Add File: b.tsx\n*** Delete File: old.ts\n*** Move to: moved.ts",
    ),
  ).toEqual(["a.ts", "b.tsx", "moved.ts"]);
});

test("/tmp cwd와 저장소 밖 경로는 TypeScript여도 제외한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "hook-format-"));
  directories.push(directory);
  const target = join(directory, "keep.ts");
  writeFileSync(target, "const x=1");
  expect(formatTargets("*** Update File: keep.ts", directory)).toEqual([]);
  expect(formatTargets("*** Update File: ../outside.ts", repositoryRoot())).toEqual([]);
});

test("저장소 안 심볼릭 링크가 가리키는 외부 TypeScript는 제외한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "hook-format-"));
  directories.push(directory);
  const external = join(directory, "external.ts");
  const link = join(repositoryRoot(), "scripts/hooks/.format-typescript-external.ts");
  writeFileSync(external, "const external=1");
  symlinkSync(external, link);
  files.push(link);
  expect(
    formatTargets(
      "*** Update File: scripts/hooks/.format-typescript-external.ts",
      repositoryRoot(),
    ),
  ).toEqual([]);
});

test("실제 hook 명령은 루트와 career-os cwd에서 TypeScript만 포맷하고 성공 출력은 비어 있다", async () => {
  const root = repositoryRoot();
  const source = join(root, "scripts/hooks/.format-typescript-fixture.ts");
  const markdown = join(root, "scripts/hooks/.format-typescript-fixture.md");
  files.push(source, markdown);
  writeFileSync(source, "const value={a:1}\n");
  writeFileSync(markdown, "keep   spacing\n");
  expect(
    await invoke(
      root,
      "*** Update File: scripts/hooks/.format-typescript-fixture.ts\n*** Update File: scripts/hooks/.format-typescript-fixture.md",
    ),
  ).toEqual({ exitCode: 0, stdout: "" });
  const once = readFileSync(source, "utf8");
  expect(
    await invoke(
      join(root, "career-os"),
      "*** Update File: ../scripts/hooks/.format-typescript-fixture.ts",
    ),
  ).toEqual({ exitCode: 0, stdout: "" });
  expect(readFileSync(source, "utf8")).toBe(once);
  expect(once).toBe("const value = { a: 1 };\n");
  expect(readFileSync(markdown, "utf8")).toBe("keep   spacing\n");
});
