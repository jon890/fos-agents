import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import type { ClaimLedger } from "../claim_ledger_schema.ts";
import { sha256 } from "./identity.ts";
import type { VerifiedClaim } from "./schema.ts";

const axes = (claim: ClaimLedger["claims"][number]) => [
  ["implementation", claim.implementation] as const,
  ["ownership", claim.ownership] as const,
  ["outcome", claim.outcome] as const,
  ...(claim.experienceDepth ? [["experienceDepth", claim.experienceDepth] as const] : []),
];

export function repositoryPath(path: string, root = process.cwd()): string {
  if (/^https?:\/\//i.test(path)) return path;
  return relative(root, isAbsolute(path) ? path : resolve(root, path)).replaceAll("\\", "/");
}

export function snapshotsFor(claim: ClaimLedger["claims"][number], root = process.cwd()) {
  return axes(claim)
    .flatMap(([axis, value]) =>
      value.evidence.map((evidence) => {
        const path = repositoryPath(evidence.path, root);
        if (/^https:\/\//i.test(evidence.path) && evidence.kind === "runtime")
          return {
            path,
            kind: evidence.kind,
            locator: evidence.locator,
            axis,
            freshness: "refresh_required" as const,
          };
        const full = resolve(root, path);
        if (!existsSync(full))
          return {
            path,
            kind: evidence.kind,
            locator: evidence.locator,
            axis,
            freshness: "missing" as const,
          };
        return {
          path,
          kind: evidence.kind,
          locator: evidence.locator,
          axis,
          sha256: sha256(readFileSync(full)),
          freshness: "tracked" as const,
        };
      }),
    )
    .sort((a, b) =>
      `${a.path}:${a.kind}:${a.locator ?? ""}`.localeCompare(
        `${b.path}:${b.kind}:${b.locator ?? ""}`,
      ),
    );
}

export function claimFreshness(
  claim: VerifiedClaim,
  root = process.cwd(),
): { fresh: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const axis of ["implementation", "ownership", "outcome", "experienceDepth"] as const) {
    const snapshots = claim.evidenceSnapshots.filter((snapshot) => snapshot.axis === axis);
    if (!snapshots.length) continue;
    let hasTracked = false;
    for (const snapshot of snapshots) {
      if (snapshot.freshness === "refresh_required") continue;
      hasTracked = true;
      const full = resolve(root, snapshot.path);
      if (!existsSync(full)) reasons.push(`${snapshot.path}: 근거 파일 없음`);
      else if (snapshot.sha256 !== sha256(readFileSync(full)))
        reasons.push(`${snapshot.path}: 근거 파일 변경`);
    }
    if (!hasTracked && snapshots.some((snapshot) => snapshot.freshness === "refresh_required"))
      reasons.push(`${axis}: HTTPS runtime 근거 재확인 필요`);
  }
  return { fresh: reasons.length === 0, reasons };
}
