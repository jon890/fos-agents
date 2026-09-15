import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import {
  VerifiedClaimsFileSchema,
  VERIFIED_CLAIMS_SCHEMA_VERSION,
  type VerifiedClaim,
  type VerifiedClaimsFile,
} from "./schema.ts";

export function defaultStateDir(root = process.cwd()): string {
  return join(root, "career-os/state/verified-claims");
}

export function groupForPath(path: string): string {
  const clean = path.replace(/^career-os\//, "").replace(/[^A-Za-z0-9._/-]/g, "_");
  if (clean.startsWith("sources/fos-study/task/"))
    return `task/${clean.slice("sources/fos-study/task/".length)}.json`;
  if (clean.startsWith("library/profiles/"))
    return `profile/${clean.slice("library/profiles/".length)}.json`;
  if (clean.startsWith("applications/"))
    return `application/${clean.split("/").slice(1, 3).join("/")}.json`;
  return `other/${clean}.json`;
}

export function readStateFiles(
  stateDir: string,
): Array<{ path: string; file: VerifiedClaimsFile }> {
  if (!existsSync(stateDir)) return [];
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }))
      entry.isDirectory()
        ? walk(join(dir, entry.name))
        : entry.name.endsWith(".json") && files.push(join(dir, entry.name));
  };
  walk(stateDir);
  return files.sort().map((path) => {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      throw new Error(`검증 완료 주장 상태 파일을 읽을 수 없습니다: ${path}: ${error}`);
    }
    const parsed = VerifiedClaimsFileSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `검증 완료 주장 상태 파일 형식이 올바르지 않습니다: ${path}: ${parsed.error.message}`,
      );
    }
    return { path, file: parsed.data };
  });
}

export function writeGroup(
  stateDir: string,
  group: string,
  additions: VerifiedClaim[],
): { changed: boolean; path: string } {
  const path = join(stateDir, group);
  const old = existsSync(path)
    ? VerifiedClaimsFileSchema.parse(JSON.parse(readFileSync(path, "utf8")))
    : { schemaVersion: VERIFIED_CLAIMS_SCHEMA_VERSION, groupKey: group, claims: [] };
  const byKey = new Map(old.claims.map((claim) => [claim.claimKey, claim]));
  for (const addition of additions) {
    const current = byKey.get(addition.claimKey);
    if (!current) byKey.set(addition.claimKey, addition);
    else {
      const origins = [...current.origins, ...addition.origins]
        .filter(
          (origin, index, all) =>
            index ===
            all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(origin)),
        )
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const merged = { ...addition, origins };
      if (JSON.stringify(current) !== JSON.stringify(merged)) byKey.set(addition.claimKey, merged);
    }
  }
  const next = {
    ...old,
    claims: [...byKey.values()].sort((a, b) => a.claimKey.localeCompare(b.claimKey)),
  };
  const encoded = `${JSON.stringify(next, null, 2)}\n`;
  if (existsSync(path) && readFileSync(path, "utf8") === encoded) return { changed: false, path };
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, encoded);
  renameSync(temporary, path);
  return { changed: true, path };
}

export function displayStatePath(path: string, root = process.cwd()): string {
  return relative(root, resolve(path)).replaceAll("\\", "/");
}
