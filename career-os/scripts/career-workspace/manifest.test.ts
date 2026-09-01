import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CareerWorkspaceDraftManifestSchema, workspaceRelativePathSchema } from "./contracts.ts";
import { buildWorkspaceDraft, compareCodeUnits, WorkspaceManifestError } from "./manifest.ts";

const producer = { skill: "test", mode: "interactive" } as const;
let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "career-workspace-"));
  await mkdir(path.join(tempRoot, "applications", "toss"), { recursive: true });
  await mkdir(path.join(tempRoot, "library"), { recursive: true });
  await mkdir(path.join(tempRoot, "state"), { recursive: true });
});

afterEach(async () => {
  mock.restore();
  await rm(tempRoot, { recursive: true, force: true });
});

describe("workspace manifest", () => {
  test("관리 root의 정상 파일로 draft manifest를 만든다", async () => {
    await writeFile(path.join(tempRoot, "applications", "toss", "resume.pdf"), "pdf");
    await writeFile(path.join(tempRoot, "library", "memo.md"), "memo");
    await writeFile(path.join(tempRoot, "state", "drill-progress.json"), "{}");

    const draft = await buildWorkspaceDraft(tempRoot, producer, { parentRevision: "rev-1" });

    expect(() => CareerWorkspaceDraftManifestSchema.parse(draft.manifest)).not.toThrow();
    expect(draft.manifest.parentRevision).toBe("rev-1");
    expect(draft.manifest.files.map((file) => file.path)).toEqual([
      "applications/toss/resume.pdf",
      "library/memo.md",
      "state/drill-progress.json",
    ]);
  });

  test("파일 순서가 달라도 contentDigest가 같다", async () => {
    await writeFile(path.join(tempRoot, "state", "b.json"), "b");
    await writeFile(path.join(tempRoot, "applications", "a.md"), "a");

    const first = await buildWorkspaceDraft(tempRoot, producer);
    const second = await buildWorkspaceDraft(tempRoot, producer);

    expect(first.manifest.files.map((file) => file.path)).toEqual(["applications/a.md", "state/b.json"]);
    expect(second.manifest.contentDigest).toBe(first.manifest.contentDigest);
  });

  test("경로 정렬은 locale에 의존하지 않고 UTF-16 code unit 순서를 따른다", async () => {
    await writeFile(path.join(tempRoot, "applications", "z.md"), "z");
    await writeFile(path.join(tempRoot, "applications", "가.md"), "ko");
    await writeFile(path.join(tempRoot, "applications", "a.md"), "a");

    const draft = await buildWorkspaceDraft(tempRoot, producer);

    expect(draft.manifest.files.map((file) => file.path)).toEqual([
      "applications/a.md",
      "applications/z.md",
      "applications/가.md",
    ]);
    expect(compareCodeUnits("applications/z.md", "applications/가.md")).toBeLessThan(0);
  });

  test("symlink는 draft 생성 전에 거부한다", async () => {
    await symlink(path.join(tempRoot, "state"), path.join(tempRoot, "applications", "link"));

    await expect(buildWorkspaceDraft(tempRoot, producer)).rejects.toMatchObject({
      name: "WorkspaceManifestError",
      rejected: [{ path: "applications/link", code: "rejected-symlink" }],
    });
  });

  test("managed root 자체가 file이면 manifest 파일로 포함하지 않고 거부한다", async () => {
    await rm(path.join(tempRoot, "applications"), { recursive: true, force: true });
    await writeFile(path.join(tempRoot, "applications"), "not-directory");

    await expect(buildWorkspaceDraft(tempRoot, producer)).rejects.toMatchObject({
      name: "WorkspaceManifestError",
      rejected: [{ path: "applications", code: "rejected-non-regular" }],
    });
    expect(() => workspaceRelativePathSchema.parse("applications")).toThrow();
  });

  test("비밀·캐시·시스템 메타데이터는 제외 사유로 남긴다", async () => {
    await mkdir(path.join(tempRoot, "applications", ".omc"), { recursive: true });
    await mkdir(path.join(tempRoot, "library", "cache"), { recursive: true });
    await writeFile(path.join(tempRoot, "applications", ".env"), "SECRET=value");
    await writeFile(path.join(tempRoot, "applications", ".omc", "runtime.json"), "{}");
    await writeFile(path.join(tempRoot, "library", ".DS_Store"), "metadata");
    await writeFile(path.join(tempRoot, "library", "cache", "candidate.json"), "{}");
    await writeFile(path.join(tempRoot, "state", "run.log"), "log");
    await writeFile(path.join(tempRoot, "state", "draft.tmp"), "tmp");
    await writeFile(path.join(tempRoot, "state", "keep.json"), "{}");

    const draft = await buildWorkspaceDraft(tempRoot, producer);

    expect(draft.manifest.files.map((file) => file.path)).toEqual(["state/keep.json"]);
    expect(draft.excluded.map((item) => [item.path, item.code])).toEqual([
      ["applications/.env", "excluded-env"],
      ["applications/.omc", "excluded-omc"],
      ["library/.DS_Store", "excluded-system-metadata"],
      ["library/cache", "excluded-cache"],
      ["state/draft.tmp", "excluded-temp"],
      ["state/run.log", "excluded-log"],
    ]);
  });

  test("읽는 중 크기나 수정 시각이 바뀌면 draft를 만들지 않는다", async () => {
    const target = path.join(tempRoot, "state", "changing.json");
    await writeFile(target, "before");
    const originalReadFile = readFile;
    mock.module("node:fs/promises", () => ({
      readFile: async (...args: Parameters<typeof originalReadFile>) => {
        const body = await originalReadFile(...args);
        if (args[0] === target) {
          await writeFile(target, "after-change");
        }
        return body;
      },
    }));
    const { buildWorkspaceDraft: buildWithChangingRead } = await import(`./manifest.ts?changing=${Date.now()}`);

    await expect(buildWithChangingRead(tempRoot, producer)).rejects.toMatchObject({
      name: "WorkspaceManifestError",
      rejected: [{ path: "state/changing.json", code: "rejected-changing-source" }],
    });
  });

  test("workspace relative path schema는 빈 segment, 현재 디렉터리 segment, control 문자를 거부한다", () => {
    expect(() => workspaceRelativePathSchema.parse("applications/resume.md")).not.toThrow();
    expect(() => workspaceRelativePathSchema.parse("library/question-bank/personal.jsonl")).not.toThrow();
    expect(() => workspaceRelativePathSchema.parse("private/question-bank/personal.jsonl")).toThrow();
    expect(() => workspaceRelativePathSchema.parse("applications//resume.md")).toThrow();
    expect(() => workspaceRelativePathSchema.parse("applications/./resume.md")).toThrow();
    expect(() => workspaceRelativePathSchema.parse("applications/resume.md\0")).toThrow();
    expect(() => workspaceRelativePathSchema.parse("applications/resume.md\n")).toThrow();
  });
});
