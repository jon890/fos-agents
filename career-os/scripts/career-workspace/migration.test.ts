import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildMigrationPlan, stageMigrationPlan, type MigrationSource } from "./migration.ts";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("career workspace migration", () => {
  test("동일 파일은 한 번만 포함하고 legacy 전용 파일은 archive 경로에 둔다", async () => {
    const fixture = await createFixture();
    await write(fixture.current, "same.md", "same");
    await write(fixture.legacy, "same.md", "same");
    await write(fixture.legacy, "old/final.pdf", "%PDF-old");

    const plan = await buildMigrationPlan({ workspaceRoot: fixture.root, sources: fixture.sources });

    expect(plan.conflicts).toEqual([]);
    expect(plan.duplicates).toHaveLength(1);
    expect(plan.files.map((file) => file.targetPath)).toEqual([
      "applications/_archive/legacy/old/final.pdf",
      "applications/same.md",
    ]);
  });

  test("같은 상대 경로의 다른 내용은 자동 선택하지 않는다", async () => {
    const fixture = await createFixture();
    await write(fixture.current, "resume.md", "current");
    await write(fixture.legacy, "resume.md", "legacy");

    const plan = await buildMigrationPlan({ workspaceRoot: fixture.root, sources: fixture.sources });

    expect(plan.files).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0].candidates.map((candidate) => candidate.sourceLabel)).toEqual(["current", "legacy"]);
  });

  test("명시적 결정이 있으면 current와 legacy를 모두 보존한다", async () => {
    const fixture = await createFixture();
    await write(fixture.current, "resume.md", "current");
    await write(fixture.legacy, "resume.md", "legacy");

    const plan = await buildMigrationPlan({
      workspaceRoot: fixture.root,
      sources: fixture.sources,
      resolutions: [{ targetPath: "applications/resume.md", action: "keep-current-and-archive-legacy" }],
    });

    expect(plan.conflicts).toEqual([]);
    expect(plan.files.map((file) => file.targetPath)).toEqual([
      "applications/_archive/legacy/resume.md",
      "applications/resume.md",
    ]);
    expect(plan.resolvedConflicts).toHaveLength(1);
  });

  test("비밀 후보는 본문 없이 상대 경로와 사유만 기록한다", async () => {
    const fixture = await createFixture();
    await write(fixture.current, ".env", "TOKEN=do-not-print");
    await write(fixture.current, "notes.md", "local path: /Users/example/private/file\n");
    await write(fixture.current, "final.pdf", "%PDF-safe");

    const plan = await buildMigrationPlan({ workspaceRoot: fixture.root, sources: fixture.sources });

    expect(plan.files.map((file) => file.targetPath)).toEqual(["applications/final.pdf"]);
    expect(plan.blockedFiles).toEqual([
      { sourceLabel: "current", sourcePath: ".env", codes: ["blocked-env"] },
      { sourceLabel: "current", sourcePath: "notes.md", codes: ["blocked-absolute-user-path"] },
    ]);
    expect(JSON.stringify(plan)).not.toContain("do-not-print");
  });

  test("검증된 계획만 새 staging에 파일별 hash를 확인하며 복사한다", async () => {
    const fixture = await createFixture();
    await write(fixture.current, "resume.md", "current");
    const plan = await buildMigrationPlan({ workspaceRoot: fixture.root, sources: fixture.sources });
    const destination = path.join(fixture.root, "staging");

    const result = await stageMigrationPlan({
      workspaceRoot: fixture.root,
      sources: fixture.sources,
      destination,
      plan,
    });

    expect(result).toEqual({ fileCount: 1, digest: plan.digest });
    expect(await Bun.file(path.join(destination, "applications/resume.md")).text()).toBe("current");
    await expect(stageMigrationPlan({
      workspaceRoot: fixture.root,
      sources: fixture.sources,
      destination,
      plan,
    })).rejects.toThrow("must not exist");
  });
});

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "career-migration-"));
  roots.push(root);
  const current = path.join(root, "current");
  const legacy = path.join(root, "legacy");
  await mkdir(current);
  await mkdir(legacy);
  const sources: MigrationSource[] = [
    { label: "current", root: current, targetRoot: "applications", kind: "current" },
    { label: "legacy", root: legacy, targetRoot: "applications", kind: "legacy", archivePrefix: "applications/_archive/legacy" },
  ];
  return { root, current, legacy, sources };
}

async function write(root: string, relativePath: string, body: string): Promise<void> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}
