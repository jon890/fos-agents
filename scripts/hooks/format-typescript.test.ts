import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatTargets, patchTargets } from "./format-typescript.ts";

const directories: string[] = [];
afterEach(() =>
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true })),
);

test("복수 파일과 이동 대상에서 TypeScript만 고른다", () => {
  expect(
    patchTargets(
      "*** Update File: a.ts\n*** Add File: b.tsx\n*** Delete File: old.ts\n*** Move to: moved.ts",
    ),
  ).toEqual(["a.ts", "b.tsx", "moved.ts"]);
});

test("저장소 밖, 삭제와 비대상 확장자는 제외한다", () => {
  const directory = mkdtempSync(join(tmpdir(), "hook-format-"));
  directories.push(directory);
  writeFileSync(join(directory, "keep.ts"), "const x=1");
  const patch =
    "*** Update File: keep.ts\n*** Update File: note.md\n*** Update File: ../outside.ts\n*** Delete File: gone.ts";
  expect(formatTargets(patch, directory)).toEqual([join(directory, "keep.ts")]);
});

test("실제 hook JSON 입력은 /tmp fixture의 TypeScript만 포맷하고 반복 실행해도 같다", async () => {
  const directory = mkdtempSync(join(tmpdir(), "hook-format-"));
  directories.push(directory);
  const source = join(directory, "sample.ts");
  const markdown = join(directory, "note.md");
  writeFileSync(source, "const value={a:1}\n");
  writeFileSync(markdown, "keep   spacing\n");
  const input = {
    cwd: directory,
    tool_input: { patch: "*** Update File: sample.ts\n*** Update File: note.md" },
  };
  const hooks = JSON.parse(readFileSync(".codex/hooks.json", "utf8"));
  const hook = hooks.hooks.PostToolUse.find(
    (entry: { matcher?: string }) => entry.matcher === "^apply_patch$",
  );
  const command = hook.hooks[0].command as string;
  expect(command).toBe("bun scripts/hooks/format-typescript.ts");
  const invoke = async () => {
    const child = Bun.spawn(command.split(" "), {
      cwd: process.cwd(),
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
    return { exitCode: await child.exited, stdout: await new Response(child.stdout).text() };
  };
  expect(await invoke()).toEqual({ exitCode: 0, stdout: "" });
  const once = readFileSync(source, "utf8");
  expect(await invoke()).toEqual({ exitCode: 0, stdout: "" });
  expect(readFileSync(source, "utf8")).toBe(once);
  expect(once).toBe("const value = { a: 1 };\n");
  expect(readFileSync(markdown, "utf8")).toBe("keep   spacing\n");
});
