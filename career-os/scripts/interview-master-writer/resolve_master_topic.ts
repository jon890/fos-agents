#!/usr/bin/env bun
import { readFileSync } from "fs";

if (process.argv.length !== 4) {
  process.stderr.write("usage: resolve_master_topic.ts <config-json> <topic>\n");
  process.exit(1);
}

const configPath = process.argv[2];
const topic = process.argv[3];
const config = JSON.parse(readFileSync(configPath, "utf-8"));
const ns = (config["master"] ?? {}) as Record<string, Record<string, unknown>>;
const entry = ns[topic];

if (!entry) {
  process.stderr.write(`unknown interview-master topic: ${topic}\n`);
  process.exit(2);
}

const exports: Record<string, string> = {
  MASTER_TOPIC: topic,
  OUTPUT_REL_PATH: entry.outputPath as string,
  INPUT_FILES_JSON: JSON.stringify(entry.inputFiles),
  MASTER_APPEND_PROMPT: (entry.promptAppend as string) ?? "",
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
