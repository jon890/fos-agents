import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { finalizeInboxItem, recordValidatedDates } from "./finalize_inbox.ts";
import {
  acquireWeeklyRunLock,
  ensureWeeklyPrivateLayout,
  loadWeeklyState,
  releaseWeeklyRunLock,
  scanAndClaimInbox,
  writeWeeklyState,
} from "./scan_inbox.ts";

const tempDirs: string[] = [];

const pngBytes = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1,
  8, 6, 0, 0, 0, 31, 21, 196,
  137,
]);

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function makePrivateRoot(): string {
  const base = mkdtempSync(join(tmpdir(), "accountbook-weekly-import-"));
  tempDirs.push(base);
  return join(base, "private");
}

function sha256(data = pngBytes): string {
  return createHash("sha256").update(data).digest("hex");
}

function writeInboxPair(privateRoot: string, base = "source", data = pngBytes): void {
  const { newDir } = ensureWeeklyPrivateLayout(privateRoot);
  const imageFile = `${base}.png`;
  writeFileSync(join(newDir, imageFile), data, { mode: 0o644 });
  writeFileSync(join(newDir, `${base}.json`), `${JSON.stringify({
    schemaVersion: 1,
    source: "ios-shortcut",
    imageFile,
    capturedAt: "2026-08-20T01:02:03.000Z",
    receivedAt: "2026-08-20T01:03:03.000Z",
  }, null, 2)}\n`, { mode: 0o644 });
}

function runBunScript(args: string[]): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync(["bun", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
}

function expectCliSuccess(result: ReturnType<typeof Bun.spawnSync>): void {
  const stderr = new TextDecoder().decode(result.stderr);
  expect(result.exitCode, stderr).toBe(0);
}

describe("weekly inbox queue", () => {
  test("빈 inbox는 오류가 아닌 빈 queue를 반환한다", () => {
    const privateRoot = makePrivateRoot();

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
  });

  test("PNG와 JSON pair가 완성되지 않으면 claim하지 않는다", () => {
    const privateRoot = makePrivateRoot();
    const { newDir } = ensureWeeklyPrivateLayout(privateRoot);
    writeFileSync(join(newDir, "source.png"), pngBytes);

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(existsSync(join(newDir, "source.png"))).toBe(true);
  });

  test("완성된 pair를 SHA-256 기준으로 한 번만 processing으로 claim한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);

    const items = scanAndClaimInbox({ privateRoot, now: new Date("2026-08-21T00:00:00.000Z") });

    expect(items).toHaveLength(1);
    expect(items[0].imageSha256).toBe(sha256());
    expect(items[0].state.status).toBe("processing");
    expect(items[0].state.attempts).toBe(1);
    expect(existsSync(join(privateRoot, "inbox", "new", "source.png"))).toBe(false);
    expect(existsSync(join(privateRoot, "inbox", "processing", "source.png"))).toBe(true);
    expect(statSync(join(privateRoot, "inbox", "processing", "source.png")).mode & 0o777).toBe(0o600);
    expect(statSync(join(privateRoot, "inbox", "processing", "source.json")).mode & 0o777).toBe(0o600);
  });

  test("이미 처리 이력이 있는 같은 SHA-256 입력은 재실행에서 skip한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });
    finalizeInboxItem({
      privateRoot,
      imageSha256,
      status: "submitted",
      batchId: "toss-aaaaaaaaaaaaaaaa",
      now: new Date("2026-08-21T00:01:00.000Z"),
    });
    writeInboxPair(privateRoot, "copy");

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(existsSync(join(privateRoot, "inbox", "new", "copy.png"))).toBe(true);
  });

  test("validator가 선택한 날짜를 중복 없는 정렬 배열로 기록한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });

    recordValidatedDates({
      privateRoot,
      imageSha256,
      selectedDates: ["2026-08-20", "2026-08-18", "2026-08-20"],
      now: new Date("2026-08-21T00:02:00.000Z"),
    });

    expect(loadWeeklyState(privateRoot).items[imageSha256].selectedDates)
      .toEqual(["2026-08-18", "2026-08-20"]);
  });

  test("같은 run lock 충돌은 WEEKLY_IMPORT_LOCKED로 변환한다", () => {
    const privateRoot = makePrivateRoot();
    const lock = acquireWeeklyRunLock(privateRoot, "run-1", new Date("2026-08-21T00:00:00.000Z"));

    expect(() => acquireWeeklyRunLock(privateRoot, "run-2", new Date("2026-08-21T00:10:00.000Z")))
      .toThrow("WEEKLY_IMPORT_LOCKED");
    expect(statSync(lock.lockPath).mode & 0o777).toBe(0o600);
  });

  test("같은 run ID는 lock 재개를 허용하고 release는 runId를 검증한다", () => {
    const privateRoot = makePrivateRoot();
    const first = acquireWeeklyRunLock(privateRoot, "run-1", new Date("2026-08-21T00:00:00.000Z"));
    const resumed = acquireWeeklyRunLock(privateRoot, "run-1", new Date("2026-08-21T00:10:00.000Z"));

    expect(first.lockPath).toBe(resumed.lockPath);
    const lockJson = JSON.parse(readFileSync(first.lockPath, "utf8"));
    expect(lockJson).toEqual({
      schemaVersion: 1,
      runId: "run-1",
      lockedAt: "2026-08-21T00:00:00.000Z",
    });
    expect(() => releaseWeeklyRunLock(privateRoot, "other-run"))
      .toThrow("WEEKLY_IMPORT_LOCK_OWNER_MISMATCH");
    expect(existsSync(first.lockPath)).toBe(true);
    releaseWeeklyRunLock(privateRoot, "run-1");
    expect(existsSync(first.lockPath)).toBe(false);
  });

  test("24시간 이상 지난 stale lock은 다른 run이 인계한다", () => {
    const privateRoot = makePrivateRoot();
    const first = acquireWeeklyRunLock(privateRoot, "run-1", new Date("2026-08-20T00:00:00.000Z"));

    const takeover = acquireWeeklyRunLock(privateRoot, "run-2", new Date("2026-08-21T00:00:01.000Z"));

    expect(takeover.lockPath).toBe(first.lockPath);
    const lockJson = JSON.parse(readFileSync(takeover.lockPath, "utf8"));
    expect(lockJson.runId).toBe("run-2");
    expect(lockJson.updatedAt).toBeUndefined();
    expect(existsSync(join(privateRoot, "state", "locks", "weekly-import.lock"))).toBe(true);
    expect(readFileSync(takeover.lockPath, "utf8")).toContain("run-2");
    expect(readdirSorted(join(privateRoot, "state", "locks")).some((entry) => entry.startsWith(".weekly-import.lock.stale.")))
      .toBe(false);
  });

  test("stale lock 인계 뒤 새 owner lock을 지우지 않고 quarantine은 삭제한다", () => {
    const privateRoot = makePrivateRoot();
    acquireWeeklyRunLock(privateRoot, "run-1", new Date("2026-08-20T00:00:00.000Z"));

    const takeover = acquireWeeklyRunLock(privateRoot, "run-2", new Date("2026-08-21T00:00:01.000Z"));
    expect(() => acquireWeeklyRunLock(privateRoot, "run-3", new Date("2026-08-21T00:00:02.000Z")))
      .toThrow("WEEKLY_IMPORT_LOCKED");

    const lockJson = JSON.parse(readFileSync(takeover.lockPath, "utf8"));
    expect(lockJson.runId).toBe("run-2");
    const lockEntries = readdirSorted(join(privateRoot, "state", "locks"));
    expect(lockEntries.some((entry) => entry.startsWith(".weekly-import.lock.stale."))).toBe(false);
    expect(lockEntries).toContain("weekly-import.lock");
  });

  test("stale lock quarantine 후 경쟁자가 lock을 잡으면 실패해도 quarantine만 삭제한다", () => {
    const privateRoot = makePrivateRoot();
    const { locksDir } = ensureWeeklyPrivateLayout(privateRoot);
    acquireWeeklyRunLock(privateRoot, "run-1", new Date("2026-08-20T00:00:00.000Z"));

    expect(() => acquireWeeklyRunLock(
      privateRoot,
      "run-2",
      new Date("2026-08-21T00:00:01.000Z"),
      {
        onStaleLockQuarantined: () => {
          writeFileSync(join(locksDir, "weekly-import.lock"), `${JSON.stringify({
            schemaVersion: 1,
            runId: "race-winner",
            lockedAt: "2026-08-21T00:00:01.500Z",
          }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
        },
      },
    )).toThrow("WEEKLY_IMPORT_LOCKED");

    const lockJson = JSON.parse(readFileSync(join(locksDir, "weekly-import.lock"), "utf8"));
    expect(lockJson.runId).toBe("race-winner");
    expect(readdirSorted(locksDir).some((entry) => entry.startsWith(".weekly-import.lock.stale.")))
      .toBe(false);
  });

  test("lock 생성 중 EEXIST 외 파일시스템 오류는 보존한다", () => {
    const privateRoot = makePrivateRoot();
    ensureWeeklyPrivateLayout(privateRoot);
    rmSync(join(privateRoot, "state", "locks"), { recursive: true, force: true });
    writeFileSync(join(privateRoot, "state", "locks"), "not-directory");

    expect(() => acquireWeeklyRunLock(privateRoot, "run-1"))
      .toThrow();
    expect(() => acquireWeeklyRunLock(privateRoot, "run-1"))
      .not.toThrow("WEEKLY_IMPORT_LOCKED");
  });

  test("scan CLI는 lock을 유지하고 mode 0600 queue JSON을 쓴다", () => {
    const privateRoot = makePrivateRoot();
    const queuePath = join(privateRoot, "queue.json");
    writeInboxPair(privateRoot);

    const result = runBunScript([
      "accountbook/scripts/accountbook-weekly-import/scan_inbox.ts",
      "--private-root",
      privateRoot,
      "--run-id",
      "run-1",
      "--output",
      queuePath,
    ]);

    expectCliSuccess(result);
    const queue = JSON.parse(readFileSync(queuePath, "utf8"));
    expect(queue.runId).toBe("run-1");
    expect(queue.items).toHaveLength(1);
    expect(statSync(queuePath).mode & 0o777).toBe(0o600);
    expect(existsSync(join(privateRoot, "state", "locks", "weekly-import.lock"))).toBe(true);
  });

  test("scan CLI는 기존 queue output을 overwrite하지 않고 실패한다", () => {
    const privateRoot = makePrivateRoot();
    const queuePath = join(privateRoot, "queue.json");
    ensureWeeklyPrivateLayout(privateRoot);
    writeFileSync(queuePath, "{}\n", { mode: 0o600 });

    const result = runBunScript([
      "accountbook/scripts/accountbook-weekly-import/scan_inbox.ts",
      "--private-root",
      privateRoot,
      "--run-id",
      "run-1",
      "--output",
      queuePath,
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(existsSync(join(privateRoot, "state", "locks", "weekly-import.lock"))).toBe(false);
  });

  test("processing에 남은 pair는 재시작 때 복구 queue로 반환한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [first] = scanAndClaimInbox({ privateRoot });

    const recovered = scanAndClaimInbox({ privateRoot });

    expect(recovered).toHaveLength(1);
    expect(recovered[0].imageSha256).toBe(first.imageSha256);
    expect(recovered[0].state.status).toBe("processing");
  });

  test("image만 processing으로 이동된 split pair는 다음 scan에서 processing으로 수렴한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const { newDir, processingDir } = ensureWeeklyPrivateLayout(privateRoot);
    renameSync(join(newDir, "source.png"), join(processingDir, "source.png"));

    const [claimed] = scanAndClaimInbox({ privateRoot });

    expect(claimed.imageSha256).toBe(sha256());
    expect(existsSync(join(processingDir, "source.png"))).toBe(true);
    expect(existsSync(join(processingDir, "source.json"))).toBe(true);
    expect(existsSync(join(newDir, "source.json"))).toBe(false);
  });

  test("pair 이동 뒤 state가 누락된 fixture는 processing item으로 복원한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const { newDir, processingDir } = ensureWeeklyPrivateLayout(privateRoot);
    renameSync(join(newDir, "source.png"), join(processingDir, "source.png"));
    renameSync(join(newDir, "source.json"), join(processingDir, "source.json"));

    const [recovered] = scanAndClaimInbox({ privateRoot });

    expect(recovered.imageSha256).toBe(sha256());
    expect(loadWeeklyState(privateRoot).items[sha256()].status).toBe("processing");
  });

  test("복구 중 결정할 수 없는 manifest mismatch pair는 failed로 격리한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const { newDir, failedDir } = ensureWeeklyPrivateLayout(privateRoot);
    writeFileSync(join(newDir, "source.json"), `${JSON.stringify({
      schemaVersion: 1,
      source: "ios-shortcut",
      imageFile: "other.png",
      capturedAt: "2026-08-20T01:02:03.000Z",
      receivedAt: "2026-08-20T01:03:03.000Z",
    }, null, 2)}\n`);

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(existsSync(join(failedDir, "source.png"))).toBe(true);
    expect(loadWeeklyState(privateRoot).items[sha256()]).toMatchObject({
      status: "failed",
      lastErrorCode: "INVALID_INBOX_MANIFEST",
    });
  });

  test("terminal 디렉터리 이동 뒤 state가 processing이면 디렉터리 상태로 보정한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const { newDir, processedDir } = ensureWeeklyPrivateLayout(privateRoot);
    const imageSha256 = sha256();
    renameSync(join(newDir, "source.png"), join(processedDir, "source.png"));
    renameSync(join(newDir, "source.json"), join(processedDir, "source.json"));
    writeWeeklyState(privateRoot, {
      schemaVersion: 1,
      policyVersion: "weekly-safe-v1",
      items: {
        [imageSha256]: {
          status: "processing",
          batchId: null,
          attempts: 1,
          lastErrorCode: null,
          selectedDates: [],
          updatedAt: "2026-08-21T00:00:00.000Z",
        },
      },
    });

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(loadWeeklyState(privateRoot).items[imageSha256].status).toBe("submitted");
  });

  test("terminal state인데 pair가 processing에 남으면 terminal 디렉터리로 이동을 완료한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const { newDir, processingDir, failedDir } = ensureWeeklyPrivateLayout(privateRoot);
    const imageSha256 = sha256();
    renameSync(join(newDir, "source.png"), join(processingDir, "source.png"));
    renameSync(join(newDir, "source.json"), join(processingDir, "source.json"));
    writeWeeklyState(privateRoot, {
      schemaVersion: 1,
      policyVersion: "weekly-safe-v1",
      items: {
        [imageSha256]: {
          status: "failed",
          batchId: null,
          attempts: 1,
          lastErrorCode: "CRASH_AFTER_STATE_WRITE",
          selectedDates: [],
          updatedAt: "2026-08-21T00:00:00.000Z",
        },
      },
    });

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(existsSync(join(failedDir, "source.png"))).toBe(true);
    expect(existsSync(join(processingDir, "source.png"))).toBe(false);
  });

  test("finalize state 기록 직후 중단된 complete processing pair는 terminal로 수렴한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });
    const { processingDir, processedDir } = ensureWeeklyPrivateLayout(privateRoot);
    writeWeeklyState(privateRoot, {
      schemaVersion: 1,
      policyVersion: "weekly-safe-v1",
      items: {
        [imageSha256]: {
          status: "submitted",
          batchId: "toss-dddddddddddddddd",
          attempts: 1,
          lastErrorCode: null,
          selectedDates: [],
          updatedAt: "2026-08-21T00:00:00.000Z",
        },
      },
    });

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(existsSync(join(processedDir, "source.png"))).toBe(true);
    expect(existsSync(join(processedDir, "source.json"))).toBe(true);
    expect(existsSync(join(processingDir, "source.png"))).toBe(false);
    expect(existsSync(join(processingDir, "source.json"))).toBe(false);
  });

  test("finalize가 image 이동 후 manifest 이동 전 중단된 split pair는 다음 scan에서 terminal로 수렴한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });
    const { processingDir, processedDir } = ensureWeeklyPrivateLayout(privateRoot);
    renameSync(join(processingDir, "source.png"), join(processedDir, "source.png"));
    writeWeeklyState(privateRoot, {
      schemaVersion: 1,
      policyVersion: "weekly-safe-v1",
      items: {
        [imageSha256]: {
          status: "submitted",
          batchId: "toss-dddddddddddddddd",
          attempts: 1,
          lastErrorCode: null,
          selectedDates: [],
          updatedAt: "2026-08-21T00:00:00.000Z",
        },
      },
    });

    expect(scanAndClaimInbox({ privateRoot })).toEqual([]);
    expect(existsSync(join(processedDir, "source.png"))).toBe(true);
    expect(existsSync(join(processedDir, "source.json"))).toBe(true);
    expect(existsSync(join(processingDir, "source.json"))).toBe(false);
  });

  test("finalize는 invalid batch ID를 state schema로 먼저 거부하고 pair를 이동하지 않는다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });

    expect(() => finalizeInboxItem({
      privateRoot,
      imageSha256,
      status: "submitted",
      batchId: "invalid-batch",
    })).toThrow();
    expect(existsSync(join(privateRoot, "inbox", "processing", "source.png"))).toBe(true);
    expect(existsSync(join(privateRoot, "inbox", "processed", "source.png"))).toBe(false);
    expect(loadWeeklyState(privateRoot).items[imageSha256].status).toBe("processing");
  });

  test("finalize는 상태와 파일 위치를 terminal 디렉터리에 원자 기록한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });
    recordValidatedDates({ privateRoot, imageSha256, selectedDates: ["2026-08-20"] });

    finalizeInboxItem({
      privateRoot,
      imageSha256,
      status: "needs_review",
      batchId: "toss-bbbbbbbbbbbbbbbb",
      lastErrorCode: "WEEKLY_POLICY_REJECTED",
      now: new Date("2026-08-21T00:03:00.000Z"),
    });

    const statePath = join(privateRoot, "state", "weekly-import.json");
    const state = loadWeeklyState(privateRoot);
    expect(state.items[imageSha256]).toMatchObject({
      status: "needs_review",
      batchId: "toss-bbbbbbbbbbbbbbbb",
      lastErrorCode: "WEEKLY_POLICY_REJECTED",
      selectedDates: ["2026-08-20"],
    });
    expect(statSync(privateRoot).mode & 0o777).toBe(0o700);
    expect(statSync(join(privateRoot, "state")).mode & 0o777).toBe(0o700);
    expect(statSync(statePath).mode & 0o777).toBe(0o600);
    expect(existsSync(join(privateRoot, "inbox", "needs-review", "source.png"))).toBe(true);
    expect(statSync(join(privateRoot, "inbox", "needs-review", "source.png")).mode & 0o777).toBe(0o600);
  });

  test("finalize CLI는 record-dates, finalize, release-lock action을 제공한다", () => {
    const privateRoot = makePrivateRoot();
    writeInboxPair(privateRoot);
    const [{ imageSha256 }] = scanAndClaimInbox({ privateRoot });
    acquireWeeklyRunLock(privateRoot, "run-1");

    expectCliSuccess(runBunScript([
      "accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts",
      "record-dates",
      "--private-root",
      privateRoot,
      "--image-sha256",
      imageSha256,
      "--selected-dates",
      "2026-08-20,2026-08-18",
    ]));
    expectCliSuccess(runBunScript([
      "accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts",
      "finalize",
      "--private-root",
      privateRoot,
      "--image-sha256",
      imageSha256,
      "--status",
      "submitted",
      "--batch-id",
      "toss-cccccccccccccccc",
    ]));
    expectCliSuccess(runBunScript([
      "accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts",
      "release-lock",
      "--private-root",
      privateRoot,
      "--run-id",
      "run-1",
    ]));

    expect(loadWeeklyState(privateRoot).items[imageSha256]).toMatchObject({
      status: "submitted",
      selectedDates: ["2026-08-18", "2026-08-20"],
    });
    expect(existsSync(join(privateRoot, "state", "locks", "weekly-import.lock"))).toBe(false);
  });

  test("finalize CLI는 action을 생략하면 MISSING_ACTION으로 실패한다", () => {
    const privateRoot = makePrivateRoot();
    ensureWeeklyPrivateLayout(privateRoot);

    const result = runBunScript([
      "accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts",
      "--private-root",
      privateRoot,
      "--image-sha256",
      sha256(),
    ]);

    expect(result.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(result.stderr)).toContain("MISSING_ACTION");
  });
});

function readdirSorted(path: string): string[] {
  return Array.from(new Bun.Glob("*").scanSync({ cwd: path, dot: true })).sort();
}
