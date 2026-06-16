#!/usr/bin/env bun
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { notifyDiscord } from "../../../_shared/lib/notify_discord.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const envFile = resolve(rootDir, ".env");
const logDir = resolve(rootDir, "logs/study-pack-writer");

function loadEnvFileIfPresent(path: string): void {
  if (!existsSync(path)) return;
  loadDotenv({ path, override: false, quiet: true });
}

function formatRunId(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`;
}

function timestampKst(date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(date);
}

function shortenTopic(topic: string): string {
  const normalized = topic.replace(/\s+/g, " ").trim();
  return normalized.length <= 120 ? normalized : `${normalized.slice(0, 117)}...`;
}

function stripControlChars(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

function tailLines(path: string, maxLines: number, maxChars: number): string {
  if (!existsSync(path)) return "";
  const lines = readFileSync(path, "utf8").split(/\r?\n/).slice(-maxLines).join("\n");
  const clean = stripControlChars(lines);
  return clean.length <= maxChars ? clean : clean.slice(clean.length - maxChars);
}

async function notify(message: string, logFile?: string): Promise<void> {
  try {
    await notifyDiscord(message);
  } catch (err) {
    const msg = `[warn] discord notify failed: ${err instanceof Error ? err.message : String(err)}\n`;
    if (logFile) appendFileSync(logFile, msg);
    else console.error(msg.trim());
  }
}

async function appendStream(stream: ReadableStream<Uint8Array> | null, logFile: string): Promise<void> {
  if (!stream) return;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    appendFileSync(logFile, Buffer.from(value));
  }
}

async function gitHeadShort(): Promise<string> {
  const proc = Bun.spawn(["git", "-C", resolve(rootDir, "sources/fos-study"), "rev-parse", "--short", "HEAD"], {
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return code === 0 ? out.trim() : "";
}

async function fosStudyStatus(): Promise<string> {
  const proc = Bun.spawn(["git", "-C", resolve(rootDir, "sources/fos-study"), "status", "--porcelain"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return code === 0 ? out.trim() : "status-check-failed";
}

async function main(): Promise<number> {
  loadEnvFileIfPresent(envFile);
  mkdirSync(logDir, { recursive: true });
  const claudeBin = process.env.STUDY_PACK_WRITER_CLAUDE_BIN || "claude";
  const permissionMode = process.env.STUDY_PACK_WRITER_PERMISSION_MODE || "bypassPermissions";

  const topic = process.argv.slice(2).join(" ").trim();
  if (!topic) {
    console.error("usage: run_with_discord_notify.ts <topic-or-natural-language-request>");
    return 2;
  }

  const runId = formatRunId();
  const logFile = resolve(logDir, `${runId}.log`);
  const topicShort = shortenTopic(topic);

  await notify(`[시작] study-pack-writer: ${topicShort}`, logFile);

  appendFileSync(logFile, [
    `[run_id] ${runId}`,
    `[started_at] ${timestampKst()}`,
    `[topic] ${topic}`,
    `[cwd] ${rootDir}`,
    `[claude_bin] ${claudeBin}`,
    `[permission_mode] ${permissionMode}`,
    "--- claude output ---",
    "",
  ].join("\n"));

  const proc = Bun.spawn([
    claudeBin,
    "--permission-mode",
    permissionMode,
    "-p",
    `/study-pack-writer ${topic}`,
  ], {
    cwd: rootDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  await Promise.all([
    appendStream(proc.stdout, logFile),
    appendStream(proc.stderr, logFile),
  ]);
  const status = await proc.exited;

  if (status === 0) {
    const dirtyStatus = await fosStudyStatus();
    if (dirtyStatus) {
      await notify(`[보류] study-pack-writer: ${topicShort}\nfos-study 미발행 변경이 남아 있어 publish 완료로 처리하지 않음\n${dirtyStatus}`, logFile);
      return 1;
    }
    const sha = await gitHeadShort();
    await notify(`[완료] study-pack-writer: ${topicShort}${sha ? ` (fos-study ${sha})` : ""}`, logFile);
  } else {
    const recent = tailLines(logFile, 20, 1500);
    await notify(`[에러] study-pack-writer 실패: ${topicShort}\nexit=${status}\nlog=${logFile}\n\n최근 로그:\n${recent}`, logFile);
  }

  return status;
}

const exitCode = await main();
try {
  chmodSync(fileURLToPath(import.meta.url), 0o755);
} catch {
  // best effort only
}
process.exit(exitCode);
