#!/usr/bin/env bun
// _shared/lib/task_hud.ts
// OpenClaw session task HUD helper.

const DEFAULT_STATE_ROOT = "openclaw-orchestrator/state/task-hud";
const WARNING_COOLDOWN_MS = 15 * 60 * 1000;

type Command = "status" | "update" | "warn";
type WarningKind = "usage" | "context" | "compaction";
type GuardState = "ok" | "usage warning" | "context warning" | "compaction likely";

interface UsageSnapshot {
  fiveHourRemaining?: string;
  weeklyRemaining?: string;
  contextPercent?: number;
  compactionCount?: number;
}

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
  createdAt: string;
  updatedAt: string;
}

interface CliOptions {
  command?: Command;
  dryRun: boolean;
  session?: string;
  stateRoot: string;
  target?: string;
  threadId?: string;
  taskLabel?: string;
  status?: string;
  kind?: WarningKind;
  message?: string;
  jsonInput?: string;
  sessionStatusJson?: string;
  fiveHourRemaining?: string;
  weeklyRemaining?: string;
  contextPercent?: number;
  compactionCount?: number;
}

interface OpenClawResult {
  ok: boolean;
  messageId?: string;
  stderr?: string;
}

function printHelp(): void {
  console.log(`Usage:
  bun _shared/lib/task_hud.ts status --session <session-id> [--dry-run]
  bun _shared/lib/task_hud.ts update --session <session-id> --task-label <label> --status <status> [--dry-run]
  bun _shared/lib/task_hud.ts warn --session <session-id> --kind <usage|context|compaction> [--dry-run]

Options:
  --target <channel:id>              Discord target for real send/edit.
  --thread-id <id>                   Optional thread id for real send/edit.
  --state-root <path>                State root, default openclaw-orchestrator/state/task-hud.
  --json '<object>'                  Input object with session, taskLabel, status, usage, or sessionStatus.
  --session-status-json '<object>'   Sanitized session_status-like input.
  --five-hour-remaining <text>       Visible 5h remaining value.
  --weekly-remaining <text>          Visible weekly remaining value.
  --context-percent <number>         Warning-only context percentage.
  --compaction-count <number>        Compaction count for likely post-detection.

Visible HUD output:
  Task, Status, Usage, Guard.
`);
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    dryRun: false,
    stateRoot: process.env.TASK_HUD_STATE_ROOT ?? DEFAULT_STATE_ROOT,
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
        opts.stateRoot = next;
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
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }

  return mergeJsonInput(opts);
}

function mergeJsonInput(opts: CliOptions): CliOptions {
  if (!opts.jsonInput) {
    return opts;
  }
  const input = parseJsonObject(opts.jsonInput, "--json");
  const usage = readObject(input.usage);
  const sessionStatus = readObject(input.sessionStatus);
  return {
    ...opts,
    session: opts.session ?? readString(input.session) ?? readString(input.sessionId),
    target: opts.target ?? readString(input.target),
    threadId: opts.threadId ?? readString(input.threadId),
    taskLabel: opts.taskLabel ?? readString(input.taskLabel),
    status: opts.status ?? readString(input.status) ?? readString(input.taskStatus),
    kind: opts.kind ?? readWarningKind(input.kind),
    message: opts.message ?? readString(input.message),
    fiveHourRemaining:
      opts.fiveHourRemaining ??
      readString(usage?.fiveHourRemaining) ??
      readString(sessionStatus?.fiveHourRemaining),
    weeklyRemaining:
      opts.weeklyRemaining ??
      readString(usage?.weeklyRemaining) ??
      readString(sessionStatus?.weeklyRemaining),
    contextPercent:
      opts.contextPercent ??
      readNumber(usage?.contextPercent) ??
      readNumber(sessionStatus?.contextPercent),
    compactionCount:
      opts.compactionCount ??
      readNumber(usage?.compactionCount) ??
      readNumber(sessionStatus?.compactionCount),
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

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readWarningKind(value: unknown): WarningKind | undefined {
  return value === "usage" || value === "context" || value === "compaction" ? value : undefined;
}

function statePath(stateRoot: string, sessionId: string): string {
  const safeSessionId = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${stateRoot}/${safeSessionId}.json`;
}

async function loadState(opts: CliOptions): Promise<HudState> {
  const sessionId = opts.session;
  if (!sessionId) {
    throw new Error("--session is required");
  }

  const path = statePath(opts.stateRoot, sessionId);
  const now = new Date().toISOString();
  try {
    const existing = JSON.parse(await Bun.file(path).text()) as HudState;
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
  await Bun.$`mkdir -p ${opts.stateRoot}`.quiet();
  await Bun.write(statePath(opts.stateRoot, state.sessionId), `${JSON.stringify(state, null, 2)}\n`);
}

function usageSnapshot(opts: CliOptions): UsageSnapshot | undefined {
  let fromSessionStatus: UsageSnapshot = {};
  if (opts.sessionStatusJson) {
    const raw = parseJsonObject(opts.sessionStatusJson, "--session-status-json");
    fromSessionStatus = {
      fiveHourRemaining: readString(raw.fiveHourRemaining),
      weeklyRemaining: readString(raw.weeklyRemaining),
      contextPercent: readNumber(raw.contextPercent),
      compactionCount: readNumber(raw.compactionCount),
    };
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

function renderHud(state: HudState): string {
  const usage = state.lastUsageSnapshot;
  const fiveHour = usage?.fiveHourRemaining ?? "unknown";
  const weekly = usage?.weeklyRemaining ?? "unknown";
  return [
    `Task: ${sanitizeVisible(state.taskLabel)}`,
    `Status: ${sanitizeVisible(state.taskStatus)}`,
    `Usage: 5h ${sanitizeVisible(fiveHour)}, weekly ${sanitizeVisible(weekly)}`,
    `Guard: ${state.guard}`,
  ].join("\n");
}

function sanitizeVisible(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .replace(/\/home\/[^/\s]+(?:\/[^\s]*)?/g, "~/...")
    .replace(/\/Users\/[^/\s]+(?:\/[^\s]*)?/g, "~/...")
    .replace(/\b(?:sk|xoxb|ghp)_[A-Za-z0-9_-]{12,}\b/g, "[redacted]");
}

function nextGuard(state: HudState, snapshot: UsageSnapshot | undefined, explicitKind?: WarningKind): GuardState {
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
    throw new Error("PHASE_BLOCKED: cannot persist per-session HUD identity");
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
      throw new Error("PHASE_BLOCKED: cannot persist per-session HUD identity");
    }
    state.supersededHudMessageIds = [...(state.supersededHudMessageIds ?? []), previous];
    state.hudMessageId = sent.messageId;
    await saveState(opts, state);
    return;
  }

  const sent = await openclawMessage("send", target, body, opts.threadId ?? state.hudThreadId);
  if (!sent.ok) {
    throw new Error(`OpenClaw HUD send failed: ${sent.stderr ?? "unknown error"}`);
  }
  if (!sent.messageId) {
    throw new Error("PHASE_BLOCKED: cannot persist per-session HUD identity");
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
    throw new Error("PHASE_BLOCKED: cannot persist per-session HUD identity");
  }
  const result = await openclawMessage("send", target, message, opts.threadId ?? state.hudThreadId);
  if (!result.ok) {
    throw new Error(`OpenClaw HUD warning send failed: ${result.stderr ?? "unknown error"}`);
  }
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
  const proc = Bun.spawn([bin, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if (exitCode !== 0) {
    return { ok: false, stderr: stderr.trim() };
  }
  return { ok: true, messageId: extractMessageId(stdout) };
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
  const now = new Date().toISOString();

  if (opts.command === "update") {
    state.taskLabel = opts.taskLabel ?? state.taskLabel;
    state.taskStatus = opts.status ?? state.taskStatus;
  }
  if (snapshot) {
    state.lastUsageSnapshot = snapshot;
    state.lastContextSnapshot = snapshot.contextPercent !== undefined ? snapshot : state.lastContextSnapshot;
  }
  state.guard = nextGuard(state, snapshot, opts.command === "warn" ? opts.kind : undefined);
  if (snapshot?.compactionCount !== undefined) {
    state.lastCompactionCount = snapshot.compactionCount;
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
  }

  await saveState(opts, state);
  await publishHud(opts, state);
}

if (import.meta.main) {
  try {
    await run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
