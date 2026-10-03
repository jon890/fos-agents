// The plugin keeps its own thin Backend client so the bundle never carries the CLI's
// token-file reader. This test is not bundled; it imports the CLI contracts to keep both sides aligned.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createCandidateContextClient } from "../../scripts/candidate-context/client.ts";
import { candidateContextDocumentKeys } from "../../scripts/candidate-context/contracts.ts";
import { createProfileClient } from "../../scripts/profile/client.ts";
import {
  profileDocumentKeys as cliProfileDocumentKeys,
  usageSnapshotSchema,
} from "../../scripts/profile/contracts.ts";
import { CareerBackend, type FetchLike } from "./backend.ts";
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

describe("저장 요청이 CLI 와 같은 경로, 본문, Idempotency-Key 로 간다", () => {
  const origin = "https://career.example.com/";
  const token = "x".repeat(40);
  type Sent = { url: string; body: unknown; key: string | null };

  function recorder(documentKey: string) {
    const sent: Sent[] = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({
        url: String(input),
        body: JSON.parse(String(init?.body)),
        key: new Headers(init?.headers).get("Idempotency-Key"),
      });
      return new Response(
        JSON.stringify({ document: { documentKey, version: 4, updatedAt: "2026-09-01T00:00:00.000Z" } }),
        { status: 200 },
      );
    };
    return { sent, fetchImpl };
  }

  const payload = { body: "# 저장할 본문\n", note: "  경력 갱신  ", expectedVersion: 3 };

  const cases = [
    {
      tool: "save_context_document",
      documentKey: "career-status",
      viaCli: (fetchImpl: FetchLike) =>
        createCandidateContextClient({ origin, token, fetchImpl }).putDocument("career-status", payload),
    },
    {
      tool: "save_profile_document",
      documentKey: "github",
      viaCli: (fetchImpl: FetchLike) =>
        createProfileClient({ origin, token, fetchImpl }).putDocument("github", payload),
    },
  ] as const;

  for (const c of cases) {
    test(c.tool, async () => {
      const cli = recorder(c.documentKey);
      await c.viaCli(cli.fetchImpl);
      const plugin = recorder(c.documentKey);
      const result = await new CareerTools(new CareerBackend({ baseUrl: origin, token }, plugin.fetchImpl)).call(
        c.tool,
        { documentKey: c.documentKey, ...payload },
      );
      expect(result.isError).toBeUndefined();
      expect(cli.sent).toHaveLength(1);
      expect(plugin.sent).toHaveLength(1);
      expect(cli.sent[0]!.key).not.toBeNull();
      expect(plugin.sent[0]).toEqual(cli.sent[0]!);
    });
  }
});
