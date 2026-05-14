#!/usr/bin/env bun
import { readFileSync } from "fs";

if (process.argv.length !== 4) {
  process.stderr.write("usage: resolve_freeform_study_pack.ts <topics.json> <freeform-text>\n");
  process.exit(1);
}

const topicsCfg = JSON.parse(readFileSync(process.argv[2], "utf-8"));
const studyCfg = (topicsCfg["study-pack"] ?? {}) as Record<string, unknown>;
const maintCfg = (topicsCfg["study-pack-maintainer"] ?? {}) as Record<string, unknown>;
const text = process.argv[3].trim();
let normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
if (normalized.startsWith("/study-pack")) {
  normalized = normalized.slice("/study-pack".length).trim();
}

const aliasMap: Record<string, string> = {
  "jvm gc 튜닝 가이드": "jvm-tuning",
  "jvm gc 튜닝": "jvm-tuning",
  "redis cache-aside": "redis-cache-aside",
  "redis 캐시 어사이드": "redis-cache-aside",
  "innodb gap lock": "gap-lock-next-key-lock",
  "gap lock": "gap-lock-next-key-lock",
  "next key lock": "gap-lock-next-key-lock",
  "innodb gap lock next key lock": "gap-lock-next-key-lock",
  "spring 트랜잭션 전파 격리수준 after_commit requires_new": "spring-transaction-propagation-isolation-after-commit",
};

if (normalized in aliasMap) {
  const topic = aliasMap[normalized];
  process.stdout.write(JSON.stringify({
    topic,
    mode: "study-pack",
    source: "alias-map",
    maintainer: topic in maintCfg,
  }) + "\n");
  process.exit(0);
}

for (const key of Object.keys(maintCfg)) {
  if (normalized === key || normalized.replace(/ /g, "-") === key) {
    process.stdout.write(JSON.stringify({
      topic: key,
      mode: "study-pack",
      source: "maintainer-key",
      maintainer: true,
    }) + "\n");
    process.exit(0);
  }
}

for (const key of Object.keys(studyCfg)) {
  if (normalized === key || normalized.replace(/ /g, "-") === key) {
    process.stdout.write(JSON.stringify({
      topic: key,
      mode: "study-pack",
      source: "study-key",
      maintainer: false,
    }) + "\n");
    process.exit(0);
  }
}

const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-study-pack";
process.stdout.write(JSON.stringify({
  topic: slug,
  mode: "unresolved",
  source: "freeform",
  maintainer: false,
  requestedText: text,
}) + "\n");
