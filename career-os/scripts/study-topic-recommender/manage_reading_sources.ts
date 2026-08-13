#!/usr/bin/env bun
import { externalReadingSources } from "../../config/external-reading-sources.js";
import {
  READING_CATEGORIES,
  type ReadingCategory,
  type ReadingSource,
  parseReadingSourcesConfig,
} from "./reading_sources.js";

const config = parseReadingSourcesConfig(externalReadingSources);

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

function printHelp(): void {
  console.log(`외부 읽을거리 소스 관리

사용법:
  manage_reading_sources.ts validate
  manage_reading_sources.ts list [--category techBlog|geek] [--include-disabled]
  manage_reading_sources.ts template --category <값> --key <키> --title <제목> [옵션]

template 옵션:
  --url <HTTPS URL> --feed-url <HTTPS URL>
  --adapter <feed|page>

기준 설정: config/external-reading-sources.ts`);
}

function listSources(): void {
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

function printTemplate(): void {
  const source: ReadingSource = {
    key: requiredOption("key"),
    category: categoryOption(),
    title: requiredOption("title"),
    enabled: true,
  };
  if (option("url")) source.url = option("url");
  if (option("feed-url")) source.feedUrl = option("feed-url");
  if (option("adapter")) source.adapter = option("adapter") as ReadingSource["adapter"];
  parseReadingSourcesConfig({ ...config, sources: [...config.sources, source] });
  console.log(JSON.stringify(source, null, 2));
}

function main(): void {
  const command = process.argv[2] ?? "help";
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "validate") {
    console.log(JSON.stringify({
      status: "ok",
      schemaVersion: config._meta.schemaVersion,
      sources: config.sources.length,
    }, null, 2));
    return;
  }
  if (command === "list") return listSources();
  if (command === "template") return printTemplate();
  throw new Error(`알 수 없는 명령: ${command}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
