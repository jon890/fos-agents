import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildWorkspaceDraft } from "./manifest.ts";
import {
  careerWorkspaceSyncStateSchema,
  inspectLocalWorkspace,
  prepareJournalSchema,
} from "./local-state.ts";

const producer = { skill: "test", mode: "interactive" } as const;
let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "career-workspace-state-"));
  await mkdir(path.join(tempRoot, "applications"), { recursive: true });
  await mkdir(path.join(tempRoot, "library"), { recursive: true });
  await mkdir(path.join(tempRoot, "state"), { recursive: true });
  await writeFile(path.join(tempRoot, "state", "drill-progress.json"), "{}");
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

describe("local workspace state", () => {
  test("sync state가 없으면 uninitialized로 판정한다", async () => {
    const result = await inspectLocalWorkspace(tempRoot, null, producer);

    expect(result.status).toBe("uninitialized");
    expect(result.currentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(result.expectedDigest).toBeNull();
  });

  test("마지막 prepare digest와 같으면 clean으로 판정한다", async () => {
    const draft = await buildWorkspaceDraft(tempRoot, producer);
    const syncState = careerWorkspaceSyncStateSchema.parse({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-1",
      contentDigest: draft.manifest.contentDigest,
      files: draft.manifest.files,
    });

    const result = await inspectLocalWorkspace(tempRoot, syncState, producer);

    expect(result.status).toBe("clean");
    expect(result.currentDigest).toBe(draft.manifest.contentDigest);
  });

  test("마지막 prepare digest와 다르면 dirty로 판정한다", async () => {
    const draft = await buildWorkspaceDraft(tempRoot, producer);
    await writeFile(path.join(tempRoot, "applications", "resume.md"), "changed");
    const syncState = careerWorkspaceSyncStateSchema.parse({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-1",
      contentDigest: draft.manifest.contentDigest,
      files: draft.manifest.files,
    });

    const result = await inspectLocalWorkspace(tempRoot, syncState, producer);

    expect(result.status).toBe("dirty");
    expect(result.expectedDigest).toBe(draft.manifest.contentDigest);
    expect(result.currentDigest).not.toBe(draft.manifest.contentDigest);
  });

  test("손상된 sync state는 invalid로 판정한다", async () => {
    const result = await inspectLocalWorkspace(tempRoot, {
      schemaVersion: 1,
      workspace: "career-os",
      revision: "",
      contentDigest: "not-a-digest",
      files: [],
    }, producer);

    expect(result.status).toBe("invalid");
    expect(result.currentDigest).toBeNull();
  });

  test("sync state의 contentDigest가 files 재계산 결과와 다르면 invalid로 판정한다", async () => {
    const draft = await buildWorkspaceDraft(tempRoot, producer);
    const syncState = careerWorkspaceSyncStateSchema.parse({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-1",
      contentDigest: "0".repeat(64),
      files: draft.manifest.files,
    });

    const result = await inspectLocalWorkspace(tempRoot, syncState, producer);

    expect(result.status).toBe("invalid");
    expect(result.reason).toContain("contentDigest");
  });

  test("로컬 작업본에 거부 대상이 있으면 throw하지 않고 invalid로 판정한다", async () => {
    const draft = await buildWorkspaceDraft(tempRoot, producer);
    await symlink(path.join(tempRoot, "state"), path.join(tempRoot, "applications", "link"));
    const syncState = careerWorkspaceSyncStateSchema.parse({
      schemaVersion: 1,
      workspace: "career-os",
      revision: "rev-1",
      contentDigest: draft.manifest.contentDigest,
      files: draft.manifest.files,
    });

    const result = await inspectLocalWorkspace(tempRoot, syncState, producer);

    expect(result.status).toBe("invalid");
    expect(result.expectedDigest).toBe(draft.manifest.contentDigest);
    expect(result.reason).toContain("rejected paths");
  });

  test("초기화 전 로컬 작업본에 거부 대상이 있어도 throw하지 않고 invalid로 판정한다", async () => {
    await symlink(path.join(tempRoot, "state"), path.join(tempRoot, "applications", "link"));

    const result = await inspectLocalWorkspace(tempRoot, null, producer);

    expect(result.status).toBe("invalid");
    expect(result.expectedDigest).toBeNull();
  });

  test("prepare journal 스키마는 root별 상태를 검증한다", () => {
    expect(() => prepareJournalSchema.parse({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-1",
      revision: "rev-1",
      status: "backed_up",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: false },
        library: { hadOriginal: false, backupDone: true, applyDone: false },
        state: { hadOriginal: true, backupDone: true, applyDone: false },
      },
    })).not.toThrow();

    expect(() => prepareJournalSchema.parse({
      schemaVersion: 1,
      workspace: "career-os",
      transactionId: "tx-1",
      revision: "rev-1",
      status: "unknown",
      roots: {
        applications: { hadOriginal: true, backupDone: true, applyDone: false },
        library: { hadOriginal: true, backupDone: true, applyDone: false },
        state: { hadOriginal: true, backupDone: true, applyDone: false },
      },
    })).toThrow();
  });
});
