#!/usr/bin/env bun
import { externalReadingSources } from "../../config/external-reading-sources.js";
import { firstOptionValue } from "../lib/cli.ts";
import {
  READING_CATEGORIES,
  type ReadingCategory,
  type ReadingSource,
  parseReadingSourcesConfig,
} from "./reading_sources.js";

const config = parseReadingSourcesConfig(externalReadingSources);

function requiredOption(args: readonly string[], name: string): string {
  const value = firstOptionValue(args, `--${name}`);
  if (!value) throw new Error(`--${name} 값이 필요하다.`);
  return value;
}

function categoryOption(args: readonly string[]): ReadingCategory {
  const value = requiredOption(args, "category");
  if (!READING_CATEGORIES.includes(value as ReadingCategory)) {
    throw new Error(`--category는 ${READING_CATEGORIES.join(", ")} 중 하나여야 한다.`);
  }
  return value as ReadingCategory;
}

function printHelp(): void {
  console.log(`외부 읽을거리 소스 관리

사용법:
  manage_reading_sources.ts validate
  manage_reading_sources.ts list [--category techBlog|geek|ai|video] [--include-disabled]
  manage_reading_sources.ts template --category <값> --key <키> --title <제목> [옵션]

template 옵션:
  --url <HTTPS URL> --feed-url <HTTPS URL>
  --adapter <feed|page|youtube>

기준 설정: config/external-reading-sources.ts`);
}

export type ReadingSourceListItem = Pick<ReadingSource, "key" | "category" | "title" | "feedUrl"> & {
  enabled: boolean;
  registrationOrder: number;
};

export function listReadingSources(category?: string, includeDisabled = false): ReadingSourceListItem[] {
  return config.sources
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
}

export function buildReadingSourceTemplate(args: readonly string[]): ReadingSource {
  const source: ReadingSource = {
    key: requiredOption(args, "key"),
    category: categoryOption(args),
    title: requiredOption(args, "title"),
    enabled: true,
  };
  const url = firstOptionValue(args, "--url");
  const feedUrl = firstOptionValue(args, "--feed-url");
  const adapter = firstOptionValue(args, "--adapter");
  if (url) source.url = url;
  if (feedUrl) source.feedUrl = feedUrl;
  if (adapter) source.adapter = adapter as ReadingSource["adapter"];
  parseReadingSourcesConfig({ ...config, sources: [...config.sources, source] });
  return source;
}

function main(args: readonly string[]): void {
  const command = args[2] ?? "help";
  if (command === "help" || command === "--help" || command === "-h") return printHelp();
  if (command === "validate") {
    console.log(JSON.stringify({
      status: "ok",
      schemaVersion: config._meta.schemaVersion,
      sources: config.sources.length,
    }, null, 2));
    return;
  }
  if (command === "list") {
    console.log(JSON.stringify(listReadingSources(firstOptionValue(args, "--category"), args.includes("--include-disabled")), null, 2));
    return;
  }
  if (command === "template") {
    console.log(JSON.stringify(buildReadingSourceTemplate(args), null, 2));
    return;
  }
  throw new Error(`알 수 없는 명령: ${command}`);
}

if (import.meta.main) {
  try {
    main(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
