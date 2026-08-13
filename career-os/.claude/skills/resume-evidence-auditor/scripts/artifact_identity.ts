#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }
    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

export function normalizeArtifactText(path: string): string {
  const source = readFileSync(path, "utf8");
  if (![".htm", ".html"].includes(extname(path).toLowerCase())) {
    return source.replace(/\s+/g, " ").trim();
  }

  return decodeHtmlEntities(
    source
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function artifactTextSha256(path: string): string {
  return createHash("sha256").update(normalizeArtifactText(path)).digest("hex");
}

if (import.meta.main) {
  const artifactPath = process.argv[2];
  if (!artifactPath || !existsSync(artifactPath)) {
    console.error(JSON.stringify({ passed: false, error: "감사 대상 파일을 찾을 수 없습니다." }, null, 2));
    process.exit(2);
  }

  console.log(JSON.stringify({
    artifact: resolve(artifactPath),
    artifactTextSha256: artifactTextSha256(artifactPath),
  }, null, 2));
}
