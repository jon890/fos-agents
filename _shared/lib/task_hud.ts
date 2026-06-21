#!/usr/bin/env node
// _shared/lib/task_hud.ts
// OpenClaw session task HUD helper.

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  hasUsageRemaining,
  mergeKnownUsage,
  safeUsageSnapshot,
  type SafeUsageSnapshot,
} from "./session_status_hud.ts";

const DEFAULT_STATE_ROOT_RELATIVE = ".openclaw/task-hud";
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const WARNING_COOLDOWN_MS = 15 * 60 * 1000;
const MAX_ACTIVE_SUBAGENT_LABELS = 3;

const ACTIVE_STATUS_SET = new Set(["active", "running", "in_progress"]);
const INACTIVE_STATUS_SET = new Set(["completed", "done", "failed", "cancelled", "stopped", "error"]);

type Command = "status" | "update" | "warn";
type WarningKind = "usage" | "context" | "compaction";
type GuardState = "ok" | "usage warning" | "usage parse warning" | "context warning" | "compaction likely";
type RefreshSource = "local" | "session-status" | "both";

interface ActiveSubagent {
  id?: string;
  label?: string;
  status?: string;
}

type UsageSnapshot = SafeUsageSnapshot;

interface HudState {
  sessionId: string;
  sourceChannel?: string;
  sourceMessageId?: string;
  hudMessageId?: string;
  hudThreadId?: string;
  supersededHudMessageIds?: string[];
  taskLabel: string;
  taskStatus: string;
  guard: GuardState;
  lastUsageSnapshot?: UsageSnapshot;
  lastContextSnapshot?: UsageSnapshot;
  lastCompactionCount?: number;
  lastWarningAt?: Partial<Record<WarningKind, string>>;
  lastLocalRefreshAt?: string;
  lastSessionStatusRefreshAt?: string;
  activeSubagents?: ActiveSubagent[];
  createdAt: string;
  updatedAt: string;
}

interface CliOptions {
  command?: Command;
  dryRun: boolean;
  session?: string;
  stateRoot: string;
  stateRootOverridden?: boolean;
  target?: string;
  threadId?: string;
  taskLabel?: string;
  status?: string;
  kind?: WarningKind;
  message?: string;
  jsonInput?: string;
  sessionStatusJson?: string;
  subagentsJson?: string;
  fiveHourRemaining?: string;
  weeklyRemaining?: string;
  contextPercent?: number;
  compactionCount?: number;
  refreshSource?: RefreshSource;
}

interface OpenClawResult {
  ok: boolean;
  messageId?: string;
  stderr?: string;
}

function printHelp(): void {
  console.log(`Usage:
  node _shared/lib/task_hud.ts status --session <session-id> [--dry-run]
  node _shared/lib/task_hud.ts update --session <session-id> --task-label <label> --status <status> [--dry-run]
  node _shared/lib/task_hud.ts warn --session <session-id> --kind <usage|context|compaction> [--dry-run]

Options:
  --target <channel:id>              Discord target for real send/edit.
  --thread-id <id>                   Optional thread id for real send/edit.
  --state-root <path>                Explicit state root override.
  --json '<object>'                  Input object with session, taskLabel, status, usage, subagents, or sessionStatus.
  --session-status-json '<object>'   Sanitized session_status-like input.
  --subagents-json '<array>'         JSON array of subagent objects {id?, label?, status}.
  --five-hour-remaining <text>       Visible 5h remaining value.
  --weekly-remaining <text>          Visible weekly remaining value.
  --context-percent <number>         Warning-only context percentage.
  --compaction-count <number>        Compaction count for likely post-detection.
  --refresh-source <source>          local|session-status|both. Records refresh timing separately.

Visible HUD output:
  Task, State, Usage, Context, Agents (active only), Warn, Refresh, Updated.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    stateRoot: defaultStateRoot(),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (!opts.command && ["status", "update", "warn"].includes(arg)) {
      opts.command = arg as Command;
      continue;
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
      case "--state-root":
        opts.stateRoot = resolveStateRoot(next);
        opts.stateRootOverridden = true;
        break;
      case "--target":
        opts.target = next;
        break;
      case "--thread-id":
        opts.threadId = next;
        break;
      case "--task-label":
        opts.taskLabel = next;
        break;
      case "--status":
        opts.status = next;
        break;
      case "--kind":
        if (!["usage", "context", "compaction"].includes(next)) {
          throw new Error(`invalid warning kind: ${next}`);
        }
        opts.kind = next as WarningKind;
        break;
      case "--message":
        opts.message = next;
        break;
      case "--json":
        opts.jsonInput = next;
        break;
      case "--session-status-json":
        opts.sessionStatusJson = next;
        break;
      case "--subagents-json":
        opts.subagentsJson = next;
        break;
      case "--five-hour-remaining":
        opts.fiveHourRemaining = next;
        break;
      case "--weekly-remaining":
        opts.weeklyRemaining = next;
        break;
      case "--context-percent":
        opts.contextPercent = Number(next);
        break;
      case "--compaction-count":
        opts.compactionCount = Number(next);
        break;
      case "--refresh-source":
        if (!["local", "session-status", "both"].includes(next)) {
          throw new Error(`invalid refresh source: ${next}`);
        }
        opts.refreshSource = next as RefreshSource;
        break;
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }

  return mergeJsonInput(opts);
}

function defaultStateRoot(): string {
  return resolve(REPO_ROOT, DEFAULT_STATE_ROOT_RELATIVE);
}

function resolveStateRoot(raw: string): string {
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

function mergeJsonInput(opts: CliOptions): CliOptions {
  const envStateRoot = process.env.TASK_HUD_STATE_ROOT;
  if (envStateRoot && !opts.stateRootOverridden) {
    opts.stateRoot = resolveStateRoot(envStateRoot);
  }
  if (!opts.jsonInput) {
    return opts;
  }
  const input = parseJsonObject(opts.jsonInput, "--json");
  const sessionStatus = readObject(input.sessionStatus);
  const usageSnapshotFromJson = safeUsageSnapshot(input);
  const statusSnapshotFromJson = sessionStatus ? safeUsageSnapshot(sessionStatus) : undefined;
  const subagentsFromJson = Array.isArray(input.subagents) ? JSON.stringify(input.subagents) : undefined;
  return {
    ...opts,
    session: opts.session ?? readString(input.session) ?? readString(input.sessionId),
    target: opts.target ?? readString(input.target),
    threadId: opts.threadId ?? readString(input.threadId),
    taskLabel: opts.taskLabel ?? readString(input.taskLabel),
    status: opts.status ?? readString(input.status) ?? readString(input.taskStatus),
    kind: opts.kind ?? readWarningKind(input.kind),
    message: opts.message ?? readString(input.message),
    subagentsJson: opts.subagentsJson ?? subagentsFromJson,
    fiveHourRemaining:
      opts.fiveHourRemaining ??
      usageSnapshotFromJson.fiveHourRemaining ??
      statusSnapshotFromJson?.fiveHourRemaining,
    weeklyRemaining:
      opts.weeklyRemaining ??
      usageSnapshotFromJson.weeklyRemaining ??
      statusSnapshotFromJson?.weeklyRemaining,
    contextPercent:
      opts.contextPercent ??
      usageSnapshotFromJson.contextPercent ??
      statusSnapshotFromJson?.contextPercent,
    compactionCount:
      opts.compactionCount ??
      usageSnapshotFromJson.compactionCount ??
      statusSnapshotFromJson?.compactionCount,
    refreshSource: opts.refreshSource ?? readRefreshSource(input.refreshSource),
  };
}

function parseJsonObject(raw: string, label: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function readObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function readRefreshSource(value: unknown): RefreshSource | undefined {
  return value === "local" || value === "session-status" || value === "both" ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readWarningKind(value: unknown): WarningKind | undefined {
  return value === "usage" || value === "context" || value === "compaction" ? value : undefined;
}

function normalizeActiveSubagents(raw: unknown[]): ActiveSubagent[] {
  return raw
    .filter((item): item is Record<string, unknown> =>
      item !== null && typeof item === "object" && !Array.isArray(item),
    )
    .filter((item) => {
      const status = readString(item.status);
      if (!status) return false;
      const normalized = status.toLowerCase().replace(/[\s-]/g, "_");
      // only include explicitly active statuses; unknown statuses are excluded
      return ACTIVE_STATUS_SET.has(normalized) && !INACTIVE_STATUS_SET.has(normalized);
    })
    .map((item) => ({
      id: readString(item.id),
      label: readString(item.label) ?? readString(item.task) ?? readString(item.name),
      status: readString(item.status),
    }));
}

function parseSubagents(opts: CliOptions): ActiveSubagent[] | undefined {
  if (!opts.subagentsJson && !opts.sessionStatusJson) return undefined;
  let raw: unknown;
  try {
    raw = opts.subagentsJson
      ? JSON.parse(opts.subagentsJson)
      : readSessionStatusAgents(parseJsonObject(opts.sessionStatusJson ?? "{}", "--session-status-json"));
  } catch {
    return undefined;
  }
  if (!Array.isArray(raw)) return undefined;
  return normalizeActiveSubagents(raw);
}

function statePath(stateRoot: string, sessionId: string): string {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return join(stateRoot, `${safeSessionId}.json`);
}

async function loadState(opts: CliOptions): Promise<HudState> {
  const sessionId = opts.session;
  if (!sessionId) {
    throw new Error("--session is required");
  }

  const path = statePath(opts.stateRoot, sessionId);
  const now = new Date().toISOString();
  try {
    const existing = JSON.parse(await readFile(path, "utf-8")) as HudState;
    return {
      ...existing,
      sessionId,
      taskLabel: existing.taskLabel || "unknown",
      taskStatus: existing.taskStatus || "unknown",
      guard: existing.guard || "ok",
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
    return {
      sessionId,
      taskLabel: "unknown",
      taskStatus: "unknown",
      guard: "ok",
      createdAt: now,
      updatedAt: now,
    };
  }
}

async function saveState(opts: CliOptions, state: HudState): Promise<void> {
  await mkdir(opts.stateRoot, { recursive: true });
  await writeFile(statePath(opts.stateRoot, state.sessionId), `${JSON.stringify(state, null, 2)}\n`);
}

function usageSnapshot(opts: CliOptions): UsageSnapshot | undefined {
  let fromSessionStatus: UsageSnapshot = {};
  if (opts.sessionStatusJson) {
    const raw = parseJsonObject(opts.sessionStatusJson, "--session-status-json");
    fromSessionStatus = safeUsageSnapshot(raw);
  }
  const snapshot: UsageSnapshot = {
    ...fromSessionStatus,
    fiveHourRemaining: opts.fiveHourRemaining ?? fromSessionStatus.fiveHourRemaining,
    weeklyRemaining: opts.weeklyRemaining ?? fromSessionStatus.weeklyRemaining,
    contextPercent: opts.contextPercent ?? fromSessionStatus.contextPercent,
    compactionCount: opts.compactionCount ?? fromSessionStatus.compactionCount,
  };
  return Object.values(snapshot).some((value) => value !== undefined) ? snapshot : undefined;
}

function readSessionStatusAgents(raw: Record<string, unknown>): unknown[] | undefined {
  const nested = readObject(raw.native) ?? readObject(raw.activeAgents) ?? readObject(raw.agentsState);
  const candidates = [
    raw.subagents,
    raw.agents,
    raw.activeSubagents,
    nested?.subagents,
    nested?.agents,
  ];
  return candidates.find((candidate): candidate is unknown[] => Array.isArray(candidate));
}

// Visible field allowlist: only these fields are included in the rendered HUD body.
// Raw session_status objects must never be stringified and written directly.
function renderContextLine(usage: UsageSnapshot | undefined): string {
  if (!usage || usage.contextPercent === undefined) return "unavailable";
  return `${usage.contextPercent}%`;
}

function renderAgentsLine(agents: ActiveSubagent[] | undefined): string {
  if (agents === undefined) return "unavailable";
  if (agents.length === 0) return "none active";

  const labels = agents
    .slice(0, MAX_ACTIVE_SUBAGENT_LABELS)
    .map((a) => sanitizeVisible(a.label ?? a.id ?? "unknown"));

  const remainder = agents.length - MAX_ACTIVE_SUBAGENT_LABELS;
  const summary = labels.join(", ");

  if (remainder > 0) {
    return `${agents.length} active — ${summary}, +${remainder} more`;
  }
  return `${agents.length} active — ${summary}`;
}

function formatUpdatedAt(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return sanitizeVisible(isoString);
    }
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(date)
      .reduce<Record<string, string>>((acc, part) => {
        acc[part.type] = part.value;
        return acc;
      }, {});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} KST`;
  } catch {
    return sanitizeVisible(isoString);
  }
}

function renderHud(state: HudState): string {
  const usage = state.lastUsageSnapshot;
  const fiveHour = renderRemainingWithReset(usage?.fiveHourRemaining, usage?.fiveHourResetIn);
  const weekly = renderRemainingWithReset(usage?.weeklyRemaining, usage?.weeklyResetIn);
  const contextLine = renderContextLine(usage);
  const agentsLine = renderAgentsLine(state.activeSubagents);
  const warnLine = state.guard === "ok" ? "ok" : sanitizeVisible(state.guard);
  const refreshLine = renderRefreshLine(state);
  const updatedAt = formatUpdatedAt(state.updatedAt);

  return [
    "[OpenClaw HUD]",
    `Task: ${sanitizeVisible(state.taskLabel)}`,
    `State: ${sanitizeVisible(state.taskStatus)}`,
    `Usage: 5h ${fiveHour} · weekly ${weekly}`,
    `Context: ${contextLine}`,
    `Agents: ${agentsLine}`,
    `Warn: ${warnLine}`,
    `Refresh: ${refreshLine}`,
    `Updated: ${updatedAt}`,
  ].join("\n");
}

function renderRemainingWithReset(remaining: string | undefined, resetIn: string | undefined): string {
  const safeRemaining = sanitizeVisible(remaining ?? "unknown");
  if (!resetIn) {
    return safeRemaining;
  }
  return `${safeRemaining} (reset in ${sanitizeVisible(resetIn)})`;
}

function renderRefreshLine(state: HudState): string {
  const local = state.lastLocalRefreshAt ? formatUpdatedAt(state.lastLocalRefreshAt) : "unknown";
  const exact = state.lastSessionStatusRefreshAt ? formatUpdatedAt(state.lastSessionStatusRefreshAt) : "unknown";
  return `local ${local} · exact ${exact}`;
}

function sanitizeVisible(value: string): string {
  const homePathPattern = new RegExp(`/${"home"}/[^/\\s]+(?:/[^\\s]*)?`, "g");
  const usersPathPattern = new RegExp(`/${"Users"}/[^/\\s]+(?:/[^\\s]*)?`, "g");
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(homePathPattern, "~/...")
    .replace(usersPathPattern, "~/...")
    .replace(/\b(?:sk|xoxb|ghp)_[A-Za-z0-9_-]{12,}\b/g, "[redacted]");
}

function nextGuard(state: HudState, snapshot: UsageSnapshot | undefined, explicitKind?: WarningKind): GuardState {
  if (state.guard === "usage parse warning" && !hasUsageRemaining(snapshot)) {
    return "usage parse warning";
  }
  if (explicitKind === "usage") {
    return "usage warning";
  }
  if (explicitKind === "context") {
    return "context warning";
  }
  if (explicitKind === "compaction") {
    return "compaction likely";
  }
  if (snapshot?.contextPercent !== undefined && snapshot.contextPercent >= 85) {
    return snapshot.contextPercent >= 92 ? "compaction likely" : "context warning";
  }
  if (isLowRemaining(snapshot?.fiveHourRemaining) || isLowRemaining(snapshot?.weeklyRemaining)) {
    return "usage warning";
  }
  if (
    snapshot?.compactionCount !== undefined &&
    state.lastCompactionCount !== undefined &&
    snapshot.compactionCount !== state.lastCompactionCount
  ) {
    return "compaction likely";
  }
  return "ok";
}

function isLowRemaining(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  const percent = value.match(/(\d+(?:\.\d+)?)\s*%/);
  if (percent) {
    return Number(percent[1]) <= 10;
  }
  const minutes = value.match(/(\d+(?:\.\d+)?)\s*(m|min|minute|minutes)\b/i);
  if (minutes) {
    return Number(minutes[1]) <= 30;
  }
  return /\b(low|critical|near empty)\b/i.test(value);
}

function warningMessage(kind: WarningKind, state: HudState): string {
  if (kind === "compaction") {
    return "Context is likely to compact soon. I will keep the task state in the HUD and continue.";
  }
  if (kind === "context") {
    return "Context warning: compaction appears possible soon. I will continue and keep the HUD state current.";
  }
  if (state.guard === "usage parse warning") {
    return "Usage parse warning: could not parse remaining usage from session_status. I will keep previous known values when available.";
  }
  return "Usage warning: remaining usage appears low. This is warn-only; work will continue unless the user stops it.";
}

function shouldWarn(state: HudState, kind: WarningKind): boolean {
  const last = state.lastWarningAt?.[kind];
  if (!last) {
    return true;
  }
  return Date.now() - Date.parse(last) >= WARNING_COOLDOWN_MS;
}

async function publishHud(opts: CliOptions, state: HudState): Promise<void> {
  const body = renderHud(state);
  if (opts.dryRun) {
    console.log(body);
    return;
  }

  const target = opts.target ?? targetFromEnv();
  if (!target) {
    throw new Error("Cannot persist per-session HUD identity without a target.");
  }

  if (state.hudMessageId) {
    const edited = await openclawMessage("edit", target, body, opts.threadId ?? state.hudThreadId, state.hudMessageId);
    if (edited.ok) {
      state.updatedAt = new Date().toISOString();
      await saveState(opts, state);
      return;
    }
    const previous = state.hudMessageId;
    const sent = await openclawMessage("send", target, body, opts.threadId ?? state.hudThreadId);
    if (!sent.ok) {
      throw new Error(`OpenClaw HUD edit and fallback send failed: ${edited.stderr ?? sent.stderr ?? "unknown error"}`);
    }
    if (!sent.messageId) {
      throw new Error("Cannot persist per-session HUD identity without a returned message id.");
    }
    state.supersededHudMessageIds = [...(state.supersededHudMessageIds ?? []), previous];
    state.hudMessageId = sent.messageId;
    await saveState(opts, state);
    await publishWarning(opts, state, fallbackWarningMessage());
    return;
  }

  const sent = await openclawMessage("send", target, body, opts.threadId ?? state.hudThreadId);
  if (!sent.ok) {
    throw new Error(`OpenClaw HUD send failed: ${sent.stderr ?? "unknown error"}`);
  }
  if (!sent.messageId) {
    throw new Error("Cannot persist per-session HUD identity without a returned message id.");
  }
  state.hudMessageId = sent.messageId;
  await saveState(opts, state);
}

async function publishWarning(opts: CliOptions, state: HudState, message: string): Promise<void> {
  if (opts.dryRun) {
    console.log(message);
    return;
  }
  const target = opts.target ?? targetFromEnv();
  if (!target) {
    throw new Error("Cannot persist per-session HUD identity without a target.");
  }
  const result = await openclawMessage("send", target, message, opts.threadId ?? state.hudThreadId);
  if (!result.ok) {
    throw new Error(`OpenClaw HUD warning send failed: ${result.stderr ?? "unknown error"}`);
  }
}

function fallbackWarningMessage(): string {
  return "⚠ New OpenClaw HUD message was created after the pinned edit failed. Please pin the new HUD message.";
}

function targetFromEnv(): string | undefined {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  return channelId ? `channel:${channelId}` : undefined;
}

async function openclawMessage(
  action: "send" | "edit",
  target: string,
  message: string,
  threadId?: string,
  messageId?: string,
): Promise<OpenClawResult> {
  const bin = process.env.OPENCLAW_BIN ?? "openclaw";
  const args = ["message", action, "--channel", "discord", "--target", target, "--message", message, "--json"];
  if (threadId) {
    args.push("--thread-id", threadId);
  }
  if (messageId) {
    args.push("--message-id", messageId);
  }
  const { exitCode, stdout, stderr } = await spawnCapture(bin, args);
  if (exitCode !== 0) {
    return { ok: false, stderr: stderr.trim() };
  }
  return { ok: true, messageId: extractMessageId(stdout) };
}

function spawnCapture(command: string, args: string[]): Promise<{ exitCode: number | null; stdout: string; stderr: string }> {
  return new Promise((resolveResult) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdoutChunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));
    proc.on("error", (error) => {
      stderrChunks.push(Buffer.from(error instanceof Error ? error.message : String(error)));
      resolveResult({
        exitCode: 1,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      });
    });
    proc.on("exit", (exitCode) => {
      resolveResult({
        exitCode,
        stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
        stderr: Buffer.concat(stderrChunks).toString("utf-8"),
      });
    });
  });
}

function extractMessageId(stdout: string): string | undefined {
  try {
    const parsed = JSON.parse(stdout) as unknown;
    return findMessageId(parsed);
  } catch {
    return undefined;
  }
}

function findMessageId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of ["messageId", "message_id", "id"]) {
    const found = readString(record[key]);
    if (found) {
      return found;
    }
  }
  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const found = findMessageId(nested);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

async function run(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.command) {
    printHelp();
    process.exit(1);
  }

  const state = await loadState(opts);
  const snapshot = usageSnapshot(opts);
  const usageParseWarning = Boolean(opts.sessionStatusJson) && !hasUsageRemaining(snapshot) && !hasUsageRemaining(state.lastUsageSnapshot);
  const mergedSnapshot = mergeKnownUsage(state.lastUsageSnapshot, snapshot);
  const parsedSubagents = parseSubagents(opts);
  const now = new Date().toISOString();

  if (opts.command === "update") {
    state.taskLabel = opts.taskLabel ?? state.taskLabel;
    state.taskStatus = opts.status ?? state.taskStatus;
  }
  if (mergedSnapshot) {
    state.lastUsageSnapshot = mergedSnapshot;
    state.lastContextSnapshot = mergedSnapshot.contextPercent !== undefined ? mergedSnapshot : state.lastContextSnapshot;
  }
  if (parsedSubagents !== undefined) {
    state.activeSubagents = parsedSubagents;
  }
  state.guard = usageParseWarning ? "usage parse warning" : nextGuard(state, mergedSnapshot, opts.command === "warn" ? opts.kind : undefined);
  if (mergedSnapshot?.compactionCount !== undefined) {
    state.lastCompactionCount = mergedSnapshot.compactionCount;
  }
  if (opts.refreshSource === "local" || opts.refreshSource === "both") {
    state.lastLocalRefreshAt = now;
  }
  if (opts.refreshSource === "session-status" || opts.refreshSource === "both") {
    state.lastSessionStatusRefreshAt = now;
  }
  state.updatedAt = now;

  if (opts.command === "warn") {
    const kind = opts.kind ?? (state.guard === "usage warning" ? "usage" : state.guard === "context warning" ? "context" : "compaction");
    if (shouldWarn(state, kind)) {
      state.lastWarningAt = { ...(state.lastWarningAt ?? {}), [kind]: now };
      await publishWarning(opts, state, warningMessage(kind, state));
    } else {
      console.log(`Warning cooldown active for ${kind}.`);
    }
  } else if (opts.command === "update" && state.guard !== "ok") {
    const guardKindMap: Record<string, WarningKind | undefined> = {
      "usage warning": "usage",
      "usage parse warning": "usage",
      "context warning": "context",
      "compaction likely": "compaction",
    };
    const autoKind = guardKindMap[state.guard];
    if (autoKind && shouldWarn(state, autoKind)) {
      state.lastWarningAt = { ...(state.lastWarningAt ?? {}), [autoKind]: now };
      await publishWarning(opts, state, warningMessage(autoKind, state));
    }
  }

  if (!opts.dryRun) {
    await saveState(opts, state);
  }
  await publishHud(opts, state);
}

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
