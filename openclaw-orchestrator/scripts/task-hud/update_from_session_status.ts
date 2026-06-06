#!/usr/bin/env bun
// Thin sanitized session_status-to-HUD wrapper.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { safeUsageSnapshot, type SafeUsageSnapshot } from "../../../_shared/lib/session_status_hud.ts";

interface Options {
  dryRun: boolean;
  session?: string;
  taskLabel?: string;
  status?: string;
  target?: string;
  threadId?: string;
  stateRoot?: string;
  sessionStatusJson?: string;
  sessionStatusFile?: string;
  subagentsJson?: string;
}

type SafeStatus = SafeUsageSnapshot;

interface SafeAgent {
  id?: string;
  label?: string;
  status?: string;
}

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function printHelp(): void {
  console.log(`Usage:
  bun openclaw-orchestrator/scripts/task-hud/update_from_session_status.ts --dry-run --session <id> --task-label <label> --status <status> --session-status-json '<object>'

Options:
  --session <id>                    HUD session id.
  --task-label <label>              Visible task label.
  --status <status>                 Visible task state.
  --target <channel:id>             Target for real edit/send mode.
  --thread-id <id>                  Optional thread id.
  --state-root <path>               Explicit state root override.
  --session-status-json '<object>'  session_status-like JSON input.
  --session-status-file <path|- >   Read session_status-like JSON from file or stdin.
  --subagents-json '<array>'        Optional agent array, sanitized before forwarding.
  --dry-run                         Render without writing state or editing messages.
`);
}

function parseArgs(argv: string[]): Options {
  const opts: Options = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      opts.dryRun = true;
      continue;
    }
    const next = argv[++i];
    if (next === undefined) {
      throw new Error(`missing value for ${arg}`);
    }
    switch (arg) {
      case "--session":
        opts.session = next;
        break;
      case "--task-label":
        opts.taskLabel = next;
        break;
      case "--status":
        opts.status = next;
        break;
      case "--target":
        opts.target = next;
        break;
      case "--thread-id":
        opts.threadId = next;
        break;
      case "--state-root":
        opts.stateRoot = next;
        break;
      case "--session-status-json":
        opts.sessionStatusJson = next;
        break;
      case "--session-status-file":
        opts.sessionStatusFile = next;
        break;
      case "--subagents-json":
        opts.subagentsJson = next;
        break;
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }
  return opts;
}

async function readSessionStatus(opts: Options): Promise<Record<string, unknown>> {
  const raw = opts.sessionStatusJson ?? (await readSessionStatusFile(opts.sessionStatusFile));
  if (!raw) {
    return {};
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("session status input must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

async function readSessionStatusFile(path: string | undefined): Promise<string | undefined> {
  if (!path) {
    return undefined;
  }
  if (path === "-") {
    return await new Response(Bun.stdin.stream()).text();
  }
  return await Bun.file(path).text();
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function safeStatus(raw: Record<string, unknown>): SafeStatus {
  return safeUsageSnapshot(raw);
}

function safeAgents(raw: Record<string, unknown>, explicitJson: string | undefined): SafeAgent[] {
  const source = explicitJson ? JSON.parse(explicitJson) : readAgents(raw);
  if (!Array.isArray(source)) {
    return [];
  }
  return source
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .map((item) =>
      compact({
        id: readString(item.id),
        label: readString(item.label) ?? readString(item.task) ?? readString(item.name),
        status: readString(item.status),
      }),
    );
}

function readAgents(raw: Record<string, unknown>): unknown[] | undefined {
  const native = readObject(raw.native) ?? readObject(raw.activeAgents) ?? readObject(raw.agentsState);
  for (const candidate of [raw.subagents, raw.agents, raw.activeSubagents, native?.subagents, native?.agents]) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

async function run(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.session) {
    throw new Error("--session is required");
  }
  const raw = await readSessionStatus(opts);
  const status = safeStatus(raw);
  const agents = safeAgents(raw, opts.subagentsJson);

  const args = [
    "run",
    resolve(REPO_ROOT, "_shared/lib/task_hud.ts"),
    "update",
    "--session",
    opts.session,
    "--session-status-json",
    JSON.stringify(status),
  ];
  if (opts.dryRun) args.push("--dry-run");
  if (opts.taskLabel) args.push("--task-label", opts.taskLabel);
  if (opts.status) args.push("--status", opts.status);
  if (opts.target) args.push("--target", opts.target);
  if (opts.threadId) args.push("--thread-id", opts.threadId);
  if (opts.stateRoot) args.push("--state-root", opts.stateRoot);
  if (agents.length > 0) args.push("--subagents-json", JSON.stringify(agents));

  const proc = Bun.spawn(["bun", ...args], {
    cwd: REPO_ROOT,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await proc.exited;
  process.exit(exitCode);
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
