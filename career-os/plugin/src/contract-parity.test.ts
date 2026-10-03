// The plugin keeps its own thin Backend client so the bundle never carries the CLI's
// token-file reader. This test is not bundled; it imports the CLI contracts to keep both sides aligned.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { candidateContextDocumentKeys } from "../../scripts/candidate-context/contracts.ts";
import {
  profileDocumentKeys as cliProfileDocumentKeys,
  usageSnapshotSchema,
} from "../../scripts/profile/contracts.ts";
import { CareerBackend } from "./backend.ts";
import { CareerTools, contextDocumentKeys, profileDocumentKeys } from "./tools.ts";

test("후보자 맥락 문서 키가 CLI 계약과 같다", () => {
  expect([...contextDocumentKeys]).toEqual([...candidateContextDocumentKeys]);
});

test("프로필 원고 키가 CLI 계약과 같다", () => {
  expect([...profileDocumentKeys]).toEqual([...cliProfileDocumentKeys]);
});

test("사용량 기록 한 줄은 CLI 계약의 칸을 모두 요구하고 그 밖의 칸을 요구하지 않는다", async () => {
  const row = usageSnapshotSchema.parse({
    month: "2026-08",
    claudeTokens: 1,
    codexTokens: 2,
    claudeCostUsd: null,
    codexCostUsd: null,
    sessions: null,
    unpricedTokens: 0,
    measuredOn: "2026-09-01",
    source: "MEASURED",
    note: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  });
  const keys = Object.keys(usageSnapshotSchema.shape);
  expect(Object.keys(row).sort()).toEqual([...keys].sort());

  const listWith = async (snapshot: Record<string, unknown>) =>
    new CareerTools(
      new CareerBackend({ baseUrl: "https://career.example.com/", token: "x".repeat(40) }, async () =>
        new Response(JSON.stringify({ snapshots: [snapshot] })),
      ),
    ).call("list_usage_snapshots", {});

  const accepted = await listWith(row);
  expect(accepted.isError).toBeUndefined();
  expect(JSON.parse(accepted.content[0].text)).toEqual({ snapshots: [row] });

  for (const key of keys) {
    const { [key]: _omitted, ...missing } = row as Record<string, unknown>;
    const rejected = await listWith(missing);
    expect({ key, code: JSON.parse(rejected.content[0].text).error?.code }).toEqual({
      key,
      code: "CAREER_INVALID_RESPONSE",
    });
  }
});

test("번들에 파일을 읽는 코드가 없다", () => {
  const bundle = readFileSync(join(import.meta.dir, "../dist/career-mcp.js"), "utf8");
  expect(bundle).not.toContain("readFileSync");
  expect(bundle).not.toContain("statSync");
});
