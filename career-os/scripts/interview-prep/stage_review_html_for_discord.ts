#!/usr/bin/env bun

import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");
const allowedSourceDir = resolve(rootDir, "data/runtime/downloads");
const trustedStageDir = "/tmp/openclaw/career-review-downloads";

function usage(): never {
  console.error("usage: stage_review_html_for_discord.ts <data/runtime/downloads/*.html>");
  process.exit(2);
}

function isInside(child: string, parent: string): boolean {
  const normalizedChild = resolve(child);
  const normalizedParent = resolve(parent);
  return normalizedChild === normalizedParent || normalizedChild.startsWith(`${normalizedParent}/`);
}

function hasHtmlDocumentShape(text: string): boolean {
  const sample = text.trimStart().slice(0, 8192);
  return /^(?:<!doctype\s+html\b|<html\b)/iu.test(sample) || /<\/(?:html|body)>/iu.test(sample);
}

function main(): number {
  const input = process.argv[2];
  if (!input || input === "--help" || input === "-h") usage();

  const sourcePath = resolve(rootDir, input);
  if (!existsSync(sourcePath)) {
    console.error(`source file not found: ${sourcePath}`);
    return 2;
  }

  const stat = lstatSync(sourcePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    console.error(`source must be a regular file: ${sourcePath}`);
    return 2;
  }

  const realSourcePath = realpathSync(sourcePath);
  const realAllowedDir = realpathSync(allowedSourceDir);
  if (!isInside(realSourcePath, realAllowedDir)) {
    console.error(`refusing to stage HTML outside ${allowedSourceDir}: ${sourcePath}`);
    return 2;
  }

  const ext = extname(sourcePath).toLowerCase();
  if (ext !== ".html" && ext !== ".htm") {
    console.error(`source must be .html or .htm: ${sourcePath}`);
    return 2;
  }

  const text = readFileSync(sourcePath, "utf8");
  if (!hasHtmlDocumentShape(text)) {
    console.error(`source does not look like a complete HTML document: ${sourcePath}`);
    return 2;
  }

  mkdirSync(trustedStageDir, { recursive: true, mode: 0o700 });
  chmodSync(trustedStageDir, 0o700);

  const stagedPath = resolve(trustedStageDir, basename(sourcePath));
  copyFileSync(sourcePath, stagedPath);
  chmodSync(stagedPath, 0o600);

  console.log(`file://${stagedPath}`);
  return 0;
}

process.exit(main());
