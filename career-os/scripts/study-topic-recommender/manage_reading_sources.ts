#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  READING_CATEGORIES,
  type ReadingCategory,
  type ReadingSource,
  toReadingSourcesV2,
  validateReadingSources,
} from "./reading_sources.js";

const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const CONFIG_PATH = resolve(ROOT, "config", "external-reading-sources.json");

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) throw new Error(`설정 파일이 없다: ${CONFIG_PATH}`);
  return toReadingSourcesV2(JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as unknown);
}

function saveConfig(config: ReturnType<typeof loadConfig>): void {
  const errors = validateReadingSources(config);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredOption(name: string): string {
  const value = option(name);
  if (!value) throw new Error(`--${name} 값이 필요하다.`);
  return value;
}

function categoryOption(): ReadingCategory {
  const value = requiredOption("category");
  if (!READING_CATEGORIES.includes(value as ReadingCategory)) {
    throw new Error(`--category는 ${READING_CATEGORIES.join(", ")} 중 하나여야 한다.`);
  }
  return value as ReadingCategory;
}

function sourceByKey(sources: ReadingSource[], key: string): ReadingSource {
  const source = sources.find((item) => item.key === key);
  if (!source) throw new Error(`소스를 찾을 수 없다: ${key}`);
  return source;
}

function printHelp(): void {
  console.log(`외부 읽을거리 소스 관리

사용법:
  manage_reading_sources.ts validate
  manage_reading_sources.ts list [--category techBlog|ai|geek] [--include-disabled]
  manage_reading_sources.ts add --category <값> --key <키> --title <제목> [옵션]
  manage_reading_sources.ts enable <키>
  manage_reading_sources.ts disable <키>
  manage_reading_sources.ts set-slots <카테고리> <숫자>
  manage_reading_sources.ts normalize

add 옵션:
  --source <출처> --url <HTTPS URL> --feed-url <HTTPS URL>
  --adapter <feed|page> --minutes <분>`);
}

function listSources(): void {
  const config = loadConfig();
  const category = option("category");
  const includeDisabled = process.argv.includes("--include-disabled");
  const items = config.sources
    .filter((item) => !category || item.category === category)
    .filter((item) => includeDisabled || item.enabled !== false)
    .map((item, index) => ({
      key: item.key,
      category: item.category,
      enabled: item.enabled !== false,
      registrationOrder: index + 1,
      title: item.title,
      feedUrl: item.feedUrl,
    }));
  console.log(JSON.stringify(items, null, 2));
}

function addSource(): void {
  const config = loadConfig();
  const key = requiredOption("key");
  if (config.sources.some((item) => item.key === key)) throw new Error(`이미 존재하는 key다: ${key}`);
  const minutes = option("minutes");
  const source: ReadingSource = {
    key,
    category: categoryOption(),
    title: requiredOption("title"),
    enabled: true,
  };
  if (option("source")) source.source = option("source");
  if (option("url")) source.url = option("url");
  if (option("feed-url")) source.feedUrl = option("feed-url");
  if (option("adapter")) source.adapter = option("adapter") as ReadingSource["adapter"];
  if (minutes) source.estMinutes = Number(minutes);
  config.sources.push(source);
  saveConfig(config);
  console.log(JSON.stringify({ status: "added", key }, null, 2));
}

function setEnabled(enabled: boolean): void {
  const config = loadConfig();
  const key = process.argv[3];
  if (!key) throw new Error("소스 key가 필요하다.");
  sourceByKey(config.sources, key).enabled = enabled;
  saveConfig(config);
  console.log(JSON.stringify({ status: enabled ? "enabled" : "disabled", key }, null, 2));
}

function setSlots(): void {
  const config = loadConfig();
  const category = process.argv[3];
  const slots = Number(process.argv[4]);
  if (!READING_CATEGORIES.includes(category as ReadingCategory) || !Number.isInteger(slots) || slots < 0) {
    throw new Error("카테고리와 0 이상의 정수 slots가 필요하다.");
  }
  config.categories[category as ReadingCategory].slots = slots;
  saveConfig(config);
  console.log(JSON.stringify({ status: "slots-updated", category, slots }, null, 2));
}

function validateConfig(): void {
  const config = loadConfig();
  const errors = validateReadingSources(config);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  const counts = Object.fromEntries(
    READING_CATEGORIES.map((category) => [
      category,
      config.sources.filter((item) => item.category === category && item.enabled !== false).length,
    ])
  );
  console.log(JSON.stringify({ status: "ok", schemaVersion: 2, counts }, null, 2));
}

function normalizeConfig(): void {
  const config = loadConfig();
  saveConfig(config);
  console.log(JSON.stringify({ status: "normalized", schemaVersion: 2, sources: config.sources.length }, null, 2));
}

function main(): void {
  const command = process.argv[2] ?? "help";
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "validate") return validateConfig();
  if (command === "list") return listSources();
  if (command === "add") return addSource();
  if (command === "enable") return setEnabled(true);
  if (command === "disable") return setEnabled(false);
  if (command === "set-slots") return setSlots();
  if (command === "normalize") return normalizeConfig();
  throw new Error(`알 수 없는 명령: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
