#!/usr/bin/env bun
/**
 * study-pack-writer runner with 자연어/freeform input support.
 *
 * Without CLI arg: reads env (STUDY_TOPIC / STUDY_DOMAIN / OUTPUT_REL_PATH).
 * With CLI arg:    자연어 or freeform text → resolves topic key → publishes.
 *
 * Absorbs freeform routing from the removed skill (ADR-025).
 */
import { readFileSync } from "fs";
import { spawnSync } from "child_process";
import { join } from "path";

const TASK_ROOT = process.env.TASK_ROOT ?? join(import.meta.dir, "..", "..");
const TOPICS_CFG = join(TASK_ROOT, "config", "topics.json");
const PUBLISH_SCRIPT = join(TASK_ROOT, "scripts", "_lib", "study_pack_publish.ts");

const freeformArg = process.argv.slice(2).join(" ").trim();

if (freeformArg) {
  resolveNaturalLanguageAndPublish(freeformArg);
} else {
  for (const k of ["STUDY_TOPIC", "STUDY_DOMAIN", "OUTPUT_REL_PATH"]) {
    if (!process.env[k]) {
      process.stderr.write(`${k} is required (or pass a 자연어/freeform topic as CLI arg)\n`);
      process.exit(1);
    }
  }
  execPublish();
}

// Resolves 자연어/freeform text to topic config then publishes.
// Resolution logic ported from the removed freeform resolver (ADR-025).
function resolveNaturalLanguageAndPublish(text: string): void {
  const topicsCfg = JSON.parse(readFileSync(TOPICS_CFG, "utf-8"));
  const studyCfg = (topicsCfg["study-pack"] ?? {}) as Record<string, Record<string, string>>;
  const maintCfg = (topicsCfg["study-pack-maintainer"] ?? {}) as Record<string, Record<string, string>>;

  let normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.startsWith("/study-pack")) normalized = normalized.slice("/study-pack".length).trim();
  const hyphenized = normalized.replace(/ /g, "-");

  // Known alias mappings (freeform phrases → canonical topic keys)
  const aliasMap: Record<string, string> = {
    "jvm gc 튜닝 가이드": "jvm-tuning",
    "jvm gc 튜닝": "jvm-tuning",
    "redis cache-aside": "redis-cache-aside",
    "redis 캐시 어사이드": "redis-cache-aside",
    "innodb gap lock": "gap-lock-next-key-lock",
    "gap lock": "gap-lock-next-key-lock",
    "next key lock": "gap-lock-next-key-lock",
    "innodb gap lock next key lock": "gap-lock-next-key-lock",
    "spring 트랜잭션 전파 격리수준 after_commit requires_new":
      "spring-transaction-propagation-isolation-after-commit",
  };

  let topicKey: string;
  let entry: Record<string, string> | undefined;

  if (normalized in aliasMap) {
    topicKey = aliasMap[normalized];
    entry = maintCfg[topicKey] ?? studyCfg[topicKey];
  } else if (hyphenized in maintCfg) {
    topicKey = hyphenized;
    entry = maintCfg[topicKey];
  } else if (hyphenized in studyCfg) {
    topicKey = hyphenized;
    entry = studyCfg[topicKey];
  } else if (normalized in maintCfg) {
    topicKey = normalized;
    entry = maintCfg[topicKey];
  } else if (normalized in studyCfg) {
    topicKey = normalized;
    entry = studyCfg[topicKey];
  } else {
    // Unresolved freeform — synthesize a temporary topic config inline.
    topicKey = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-study-pack";
    entry = {
      domain: "custom",
      outputPath: `custom/${topicKey}.md`,
      commitTopic: topicKey,
      appendPrompt:
        `다음 자유 주제를 백엔드 면접 대비용 스터디팩으로 정리한다: ${text}. ` +
        `단순 요약이 아니라 개념, 실무 관점, 흔한 오해, 예시, 면접 답변 포인트까지 포함한다. ` +
        `기존 문서와 겹치면 중복 설명을 줄이고 링크로 연결한다. ` +
        `문서 제목은 반드시 [초안]으로 시작한다.`,
    };
  }

  const reportDate = process.env.REPORT_DATE ?? new Date().toISOString().slice(0, 10);
  process.env.STUDY_TOPIC = topicKey;
  process.env.STUDY_DOMAIN = entry!.domain;
  process.env.OUTPUT_REL_PATH = entry!.outputPath;
  process.env.COMMIT_TOPIC = entry!.commitTopic ?? topicKey;
  process.env.STUDY_APPEND_PROMPT = entry!.appendPrompt ?? entry!.promptAppend ?? "";
  process.env.TASK_ROOT = TASK_ROOT;
  process.env.OUTDIR ??= join(TASK_ROOT, "data", "reports", "daily", reportDate, `study-pack-${topicKey}`);

  execPublish();
}

function execPublish(): void {
  const r = spawnSync("bun", ["run", PUBLISH_SCRIPT], { stdio: "inherit", env: process.env });
  process.exit(r.status ?? 1);
}
