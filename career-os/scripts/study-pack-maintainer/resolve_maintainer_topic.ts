#!/usr/bin/env bun
import { readFileSync } from "fs";

if (process.argv.length !== 4) {
  process.stderr.write("usage: resolve_maintainer_topic.ts <config-json> <topic>\n");
  process.exit(1);
}

const configPath = process.argv[2];
const topic = process.argv[3];
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const ns = (config["study-pack-maintainer"] ?? {}) as Record<string, Record<string, unknown>>;
const entry = ns[topic];

if (!entry) {
  process.stderr.write(`unknown topic: ${topic}\n`);
  process.exit(2);
}

const exports: Record<string, string> = {
  MAINTAINER_TOPIC: topic,
  REQUESTED_TOPIC: entry.requestedTopic as string,
  CANDIDATE_FILES_JSON: JSON.stringify(entry.candidateFiles ?? []),
  PREFERRED_DOMAIN: (entry.preferredDomain as string) ?? "interview",
};

const SAFE_CHARS = /^[a-zA-Z0-9@%+=:,./-]+$/;
function shellQuote(s: string): string {
  if (s === "") return "''";
  if (SAFE_CHARS.test(s)) return s;
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

for (const [key, value] of Object.entries(exports)) {
  process.stdout.write(`export ${key}=${shellQuote(value)}\n`);
}
