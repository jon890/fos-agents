#!/usr/bin/env bun
import { readFileSync } from "fs";

if (process.argv.length !== 4) {
  process.stderr.write("usage: resolve_study_pack_topic.ts <config-json> <topic>\n");
  process.exit(1);
}

const configPath = process.argv[2];
const topic = process.argv[3];
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const ns = (config["study-pack"] ?? {}) as Record<string, Record<string, string>>;
const entry = ns[topic];

if (!entry) {
  process.stderr.write(`unknown topic: ${topic}\n`);
  process.exit(2);
}

const exports: Record<string, string> = {
  STUDY_TOPIC: topic,
  STUDY_DOMAIN: entry.domain,
  OUTPUT_REL_PATH: entry.outputPath,
  COMMIT_TOPIC: entry.commitTopic ?? topic,
  STUDY_APPEND_PROMPT: entry.appendPrompt ?? entry.promptAppend ?? "",
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
