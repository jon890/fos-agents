import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * `prisma/migrations` 를 찾는다.
 *
 * 소스에서 바로 돌 때와 `dist/` 로 빌드해 돌 때의 상대 깊이가 다르므로
 * 이 모듈의 위치에서 위로 올라가며 찾는다.
 */
export function resolveMigrationDirectory(
  from: string = dirname(fileURLToPath(import.meta.url)),
): string {
  let current = resolve(from);
  for (;;) {
    const candidate = join(current, "prisma", "migrations");
    if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
    const parent = dirname(current);
    if (parent === current) {
      throw new Error("prisma/migrations 디렉터리를 찾을 수 없습니다.");
    }
    current = parent;
  }
}

/** 적용되어야 할 migration 이름을 순서대로 읽는다. */
export function expectedMigrationNames(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}
