#!/usr/bin/env bun
import { readFileSync, writeFileSync } from "node:fs";
import { assertOutsideRepository } from "../candidate-context/repository-guard.ts";
import { CareerBackendHttpError } from "../lib/career-backend-http.ts";
import { firstOptionValue } from "../lib/cli.ts";
import { createProfileClient } from "./client.ts";
import { profileDocumentKeySchema, profileDocumentKeys, type UsageSnapshotPutPayload } from "./contracts.ts";

const value = (args: readonly string[], name: string) => firstOptionValue(args, `--${name}`);
const required = (args: readonly string[], name: string) => {
  const found = value(args, name);
  if (!found?.trim()) throw new Error(`--${name} 값이 필요하다.`);
  return found;
};
const usage = `사용법: manage_profile.ts <documents | usage> <명령>\n\n로컬 명령:\n  help, --help, -h\n\nAPI 명령:\n  documents list\n  documents get --key <${profileDocumentKeys.join("|")}> [--out <path>]\n  documents put --key <documentKey> --file <markdownPath> --expected-version <n> --note <note>\n  usage list\n  usage put --month <YYYY-MM> --claude-tokens <n> --codex-tokens <n> --unpriced-tokens <n> --measured-on <YYYY-MM-DD> --source <MEASURED|BACKFILLED>\n    [--claude-cost-usd <n>] [--codex-cost-usd <n>] [--sessions <n>] [--note <note>] [--replace]\n    --replace 는 --note 에 사유가 있어야 한다. 기록이 이미 있으면 created=false 와 저장돼 있던 기록이 나온다.\n`;

function documentKey(args: readonly string[]) {
  const parsed = profileDocumentKeySchema.safeParse(required(args, "key"));
  if (!parsed.success) throw new Error(`--key 는 ${profileDocumentKeys.join(", ")} 중 하나여야 한다.`);
  return parsed.data;
}

function integerOption(name: string, found: string): number {
  const parsed = Number(found);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`--${name} 은 0 이상의 정수여야 한다.`);
  return parsed;
}

function numberOption(name: string, found: string): number {
  const parsed = Number(found);
  if (found.trim() === "" || !Number.isFinite(parsed)) throw new Error(`--${name} 은 숫자여야 한다.`);
  return parsed;
}

async function documents(command: string | undefined, args: readonly string[]): Promise<unknown> {
  if (command === "list") return (await createProfileClient().listDocuments()).documents;

  if (command === "get") {
    const key = documentKey(args);
    const out = value(args, "out");
    const outPath = out === undefined ? undefined : assertOutsideRepository(out);
    let document;
    try {
      document = await createProfileClient().getDocument(key);
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status === 404) {
        throw new Error(`문서가 없다: ${key}. documents put --expected-version 0 으로 새 문서를 만든다.`);
      }
      throw error;
    }
    if (outPath === undefined) return document.body;
    writeFileSync(outPath, document.body, "utf8");
    return { documentKey: document.documentKey, version: document.version, updatedAt: document.updatedAt, out: outPath };
  }

  if (command === "put") {
    const key = documentKey(args);
    const file = required(args, "file");
    const expectedVersion = integerOption("expected-version", required(args, "expected-version"));
    const note = required(args, "note");
    const body = readFileSync(file, "utf8");
    try {
      return (await createProfileClient().putDocument(key, { body, note, expectedVersion })).document;
    } catch (error) {
      if (error instanceof CareerBackendHttpError && error.status === 409) {
        throw new Error("문서가 바뀌었다. documents get 으로 다시 조회하고 변경을 검토한 뒤 명령을 다시 실행한다.");
      }
      throw error;
    }
  }

  throw new Error(usage);
}

async function usageCommand(command: string | undefined, args: readonly string[]): Promise<unknown> {
  if (command === "list") return createProfileClient().listUsageSnapshots();
  if (command !== "put") throw new Error(usage);

  const month = required(args, "month");
  const payload: UsageSnapshotPutPayload = {
    claudeTokens: integerOption("claude-tokens", required(args, "claude-tokens")),
    codexTokens: integerOption("codex-tokens", required(args, "codex-tokens")),
    unpricedTokens: integerOption("unpriced-tokens", required(args, "unpriced-tokens")),
    measuredOn: required(args, "measured-on"),
    source: required(args, "source") as UsageSnapshotPutPayload["source"],
  };
  const claudeCost = value(args, "claude-cost-usd");
  if (claudeCost !== undefined) payload.claudeCostUsd = numberOption("claude-cost-usd", claudeCost);
  const codexCost = value(args, "codex-cost-usd");
  if (codexCost !== undefined) payload.codexCostUsd = numberOption("codex-cost-usd", codexCost);
  const sessions = value(args, "sessions");
  if (sessions !== undefined) payload.sessions = integerOption("sessions", sessions);
  const note = value(args, "note");
  if (note !== undefined) payload.note = note;
  if (args.includes("--replace")) {
    if (!note?.trim()) throw new Error("--replace 는 --note 에 바꾸는 사유가 필요하다.");
    payload.replace = true;
  }
  return createProfileClient().putUsageSnapshot(month, payload);
}

export async function manageProfile(args = process.argv.slice(2)): Promise<unknown> {
  const group = args[0];
  if (!group || ["help", "--help", "-h"].includes(group)) return usage;
  if (group === "documents") return documents(args[1], args);
  if (group === "usage") return usageCommand(args[1], args);
  throw new Error(usage);
}

/** 오류는 상태, code, requestId 만 담는다. 원고 본문은 담지 않는다. */
export function formatManageProfileError(error: unknown): string {
  if (error instanceof CareerBackendHttpError) {
    const detail = [`status=${error.status ?? "none"}`, `code=${error.code}`];
    if (error.requestId) detail.push(`requestId=${error.requestId}`);
    return `${error.message} (${detail.join(", ")})`;
  }
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  manageProfile()
    .then((result) => {
      // 문자열 본문은 줄바꿈을 더하지 않고 그대로 낸다. get > file 후 put 하면 저장할 때마다 끝 줄바꿈이 늘기 때문이다.
      if (typeof result === "string") process.stdout.write(result);
      else console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(formatManageProfileError(error));
      process.exit(1);
    });
}
