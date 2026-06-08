import { readFileSync, readdirSync, statSync } from "fs";
import { basename, dirname, join, relative, sep } from "path";

export interface FosStudyInventoryOptions {
  root: string;
  excludeDirs?: string[];
}

export interface FosStudyInventory {
  root: string;
  scannedMarkdownCount: number;
  excludedDirs: string[];
  markdownPathsRelative: string[];
  items: FosStudyInventoryItem[];
}

export interface FosStudyInventoryItem {
  path: string;
  slug: string;
  titleCandidate: string | null;
  domainCandidate: string | null;
  categoryCandidate: string | null;
  tagsCandidate: string[];
  mtimeMs: number | null;
  updatedAt: string | null;
}

function normalizeRelativePath(root: string, abs: string): string {
  return relative(root, abs).split(sep).join("/");
}

function slugFromPath(path: string): string {
  return basename(path).replace(/\.md$/i, "");
}

function firstPathSegment(path: string): string | null {
  const segment = path.split("/").find(Boolean);
  return segment || null;
}

function parentCategory(path: string): string | null {
  const parent = dirname(path).split(sep).join("/");
  if (!parent || parent === ".") return null;
  return parent;
}

function readTitleCandidate(path: string): string | null {
  try {
    const lines = readFileSync(path, "utf-8").split(/\r?\n/).slice(0, 80);
    const heading = lines.find((line) => /^#\s+\S/.test(line.trim()));
    return heading ? heading.replace(/^#\s+/, "").trim() : null;
  } catch {
    return null;
  }
}

function readTagsCandidate(path: string): string[] {
  try {
    const lines = readFileSync(path, "utf-8").split(/\r?\n/).slice(0, 40);
    if (lines[0]?.trim() !== "---") return [];
    const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (end === -1) return [];
    const tagsLine = lines.slice(1, end).find((line) => /^tags:\s*/.test(line.trim()));
    if (!tagsLine) return [];
    const rawTags = tagsLine.replace(/^tags:\s*/, "").trim();
    if (!rawTags.startsWith("[") || !rawTags.endsWith("]")) return [];
    return rawTags
      .slice(1, -1)
      .split(",")
      .map((tag) => tag.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function toInventoryItem(root: string, abs: string): FosStudyInventoryItem {
  const path = normalizeRelativePath(root, abs);
  let mtimeMs: number | null = null;
  let updatedAt: string | null = null;
  try {
    const stat = statSync(abs);
    mtimeMs = stat.mtime.getTime();
    updatedAt = stat.mtime.toISOString();
  } catch {
    // Missing mtime is diagnostic-only and should not fail inventory generation.
  }

  return {
    path,
    slug: slugFromPath(path),
    titleCandidate: readTitleCandidate(abs),
    domainCandidate: firstPathSegment(path),
    categoryCandidate: parentCategory(path),
    tagsCandidate: readTagsCandidate(abs),
    mtimeMs,
    updatedAt,
  };
}

export function scanFosStudyInventory(opts: FosStudyInventoryOptions): FosStudyInventory {
  const excludeDirs = opts.excludeDirs ?? [".git", ".claude", "private"];
  const items: FosStudyInventoryItem[] = [];

  function walk(dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (excludeDirs.includes(entry.name)) continue;
        walk(join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const abs = join(dir, entry.name);
        items.push(toInventoryItem(opts.root, abs));
      }
    }
  }

  walk(opts.root);
  items.sort((a, b) => a.path.localeCompare(b.path));
  const markdownPathsRelative = items.map((item) => item.path);

  return {
    root: opts.root,
    scannedMarkdownCount: items.length,
    excludedDirs: excludeDirs,
    markdownPathsRelative,
    items,
  };
}
