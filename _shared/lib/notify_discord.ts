#!/usr/bin/env bun
// _shared/lib/notify_discord.ts
// Discord 알림 — openclaw CLI subprocess 경유. ADR-021.
//
// Usage:
//   bun --env-file=<ws>/.env _shared/lib/notify_discord.ts [--media <path>] "<message>"
//   또는 import { notifyDiscord } from "@shared/lib/notify_discord.ts"
//
// 환경 변수:
//   DISCORD_CHANNEL_ID (필수) — 누락 시 exit 1.

const OPENCLAW_TIMEOUT_MS = 10_000;
const FNM_NODE_BIN = "/home/bifos/.local/share/fnm/node-versions/v24.14.0/installation/bin";
const OPENCLAW_CANDIDATES = [
  process.env.OPENCLAW_BIN,
  "openclaw",
  `${FNM_NODE_BIN}/openclaw`,
].filter(Boolean) as string[];

export interface NotifyOptions {
  media?: string;
  presentation?: unknown;
}

export async function notifyDiscord(message: string, opts?: NotifyOptions): Promise<void> {
  const channelId = process.env.DISCORD_CHANNEL_ID;
  if (!channelId) {
    console.error("[notify_discord] DISCORD_CHANNEL_ID env 누락 — 알림 발송 불가 (ADR-021)");
    process.exit(1);
  }

  const args = [
    "message", "send",
    "--channel", "discord",
    "--target", `channel:${channelId}`,
    "--message", message,
    "--json",
  ];
  if (opts?.media) {
    args.splice(args.indexOf("--message"), 0, "--media", opts.media);
  }
  if (opts?.presentation) {
    args.splice(args.indexOf("--json"), 0, "--presentation", JSON.stringify(opts.presentation));
  }

  let lastError: unknown;
  let proc: Bun.Subprocess<"pipe", "pipe", "pipe"> | null = null;
  for (const candidate of OPENCLAW_CANDIDATES) {
    try {
      proc = Bun.spawn([candidate, ...args], {
        env: {
          ...process.env,
          PATH: `${FNM_NODE_BIN}:${process.env.PATH ?? ""}`,
        },
        stdout: "pipe",
        stderr: "pipe",
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!proc) {
    console.error(`[notify_discord] openclaw executable not found: ${String(lastError)}`);
    process.exit(1);
  }

  const timeoutId = setTimeout(() => {
    proc.kill();
    console.error(`[notify_discord] openclaw timeout after ${OPENCLAW_TIMEOUT_MS}ms`);
  }, OPENCLAW_TIMEOUT_MS);

  const exitCode = await proc.exited;
  clearTimeout(timeoutId);

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.error(`[notify_discord] openclaw exit ${exitCode}: ${stderr.trim()}`);
    process.exit(1);
  }
}

// CLI 진입점
if (import.meta.main) {
  const argv = process.argv.slice(2);
  let media: string | undefined;
  let presentation: unknown;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--media") {
      media = argv[++i];
    } else if (argv[i] === "--presentation") {
      try {
        presentation = JSON.parse(argv[++i] ?? "");
      } catch (err) {
        console.error(`invalid --presentation JSON: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(2);
      }
    } else {
      positional.push(argv[i]);
    }
  }

  const message = positional[0];
  if (!message) {
    console.error("usage: notify_discord.ts [--media <path>] <message>");
    process.exit(1);
  }

  await notifyDiscord(message, {
    ...(media ? { media } : {}),
    ...(presentation ? { presentation } : {}),
  });
}
