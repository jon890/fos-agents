import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { MonthlyMeasurement } from "./measure.ts";
import { createUsageFileStore, readUsageFile, resolveUsageFilePath } from "./usage_file.ts";

const directories: string[] = [];

function usageFile(): string {
  const directory = mkdtempSync(join(tmpdir(), "usage-file-"));
  directories.push(directory);
  return join(directory, "agent-usage", "snapshots.json");
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function measurement(month: string, claudeTokens = 1000): MonthlyMeasurement {
  return { month, claudeTokens, codexTokens: 2000, claudeCostUsd: 1.5, codexCostUsd: 2.5, sessions: 3, unpricedTokens: 0 };
}

describe("resolveUsageFilePath", () => {
  test("환경값이 없으면 홈 아래 기본 자리, 있으면 그 절대 경로다", () => {
    expect(resolveUsageFilePath({}, "/home/example")).toBe("/home/example/.fos-career/agent-usage/snapshots.json");
    expect(resolveUsageFilePath({ CAREER_AGENT_USAGE_FILE: " /data/usage.json " }, "/home/example")).toBe("/data/usage.json");
  });

  test("상대 경로는 거절한다", () => {
    expect(() => resolveUsageFilePath({ CAREER_AGENT_USAGE_FILE: "usage.json" }, "/home/example")).toThrow("절대 경로");
  });
});

describe("createUsageFileStore", () => {
  test("파일이 없으면 빈 목록이고, 처음 쓰면 소유자만 읽고 쓰는 파일이 달 오름차순으로 생긴다", async () => {
    const file = usageFile();
    const store = createUsageFileStore(file);
    expect(await store.listMonths()).toEqual([]);

    expect(await store.putMeasured(measurement("2026-02"), "2026-03-01")).toEqual({ created: true, replaced: false });
    expect(await store.putMeasured(measurement("2026-01"), "2026-03-01")).toEqual({ created: true, replaced: false });

    expect(await store.listMonths()).toEqual(["2026-01", "2026-02"]);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(readdirSync(dirname(file))).toEqual(["snapshots.json"]);
  });

  test("이미 있는 달은 사유 없이 바꾸지 않고, 사유를 주면 값과 사유를 바꾼다", async () => {
    const file = usageFile();
    const store = createUsageFileStore(file);
    await store.putMeasured(measurement("2026-02", 1000), "2026-03-01");

    expect(await store.putMeasured(measurement("2026-02", 5), "2026-03-02")).toEqual({ created: false, replaced: false });
    expect(readUsageFile(file)[0]).toMatchObject({ claudeTokens: 1000, measuredOn: "2026-03-01" });

    expect(await store.putMeasured(measurement("2026-02", 7000), "2026-03-03", { replaceNote: "다른 기기 합계를 더했다" })).toEqual({ created: false, replaced: true });
    expect(readUsageFile(file)).toEqual([
      { ...measurement("2026-02", 7000), measuredOn: "2026-03-03", source: "MEASURED", note: "다른 기기 합계를 더했다" },
    ]);
  });

  test("깨진 JSON, 모르는 꼴, 겹친 달은 던지고 파일을 건드리지 않는다", async () => {
    for (const content of [
      "{",
      JSON.stringify({ schemaVersion: 2, snapshots: [] }),
      JSON.stringify({ schemaVersion: 1, snapshots: [{ month: "2026-13" }] }),
      JSON.stringify({
        schemaVersion: 1,
        snapshots: [1, 2].map(() => ({ ...measurement("2026-02"), measuredOn: "2026-03-01", source: "MEASURED" })),
      }),
    ]) {
      const file = usageFile();
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
      const store = createUsageFileStore(file);
      await expect(store.listMonths()).rejects.toThrow("사용량 파일");
      await expect(store.putMeasured(measurement("2026-03"), "2026-04-01")).rejects.toThrow("사용량 파일");
      expect(readFileSync(file, "utf8")).toBe(content);
    }
  });
});
