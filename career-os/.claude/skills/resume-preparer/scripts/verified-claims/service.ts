import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { artifactTextSha256 } from "../artifact_identity.ts";
import { validateClaimLedger } from "../validate_claim_ledger.ts";
import {
  ClaimLedgerSchema,
  CURRENT_CLAIM_LEDGER_SCHEMA_VERSION,
  type ClaimLedger,
} from "../claim_ledger_schema.ts";
import { claimFreshness, repositoryPath, snapshotsFor } from "./evidence.ts";
import { claimKey } from "./identity.ts";
import { defaultStateDir, groupForPath, readStateFiles, writeGroup } from "./store.ts";
import type { VerifiedClaim } from "./schema.ts";

const comparisonAxes = ["implementation", "ownership", "outcome", "experienceDepth"] as const;

/** 공고별 위치인 id와 location을 빼고, 재사용 안전성에 영향을 주는 원장 내용만 비교한다. */
export function isSameRegisteredClaim(
  current: ClaimLedger["claims"][number],
  registered: VerifiedClaim,
): boolean {
  if (
    current.proposedText !== registered.claim.proposedText ||
    current.type !== registered.claim.type
  )
    return false;
  return comparisonAxes.every((axis) => {
    const left = current[axis];
    const right = registered.claim[axis];
    if (!left || !right || left.status !== right.status) return left === right;
    const evidence = (value: typeof left) =>
      value.evidence.map(({ path, kind, locator, supports }) => ({
        path,
        kind,
        locator,
        supports,
      }));
    return JSON.stringify(evidence(left)) === JSON.stringify(evidence(right));
  });
}

export function promote(applicationDir: string, stateDir = defaultStateDir()) {
  const root = process.cwd();
  const directory = resolve(applicationDir);
  const ledgerPath = join(directory, "review/claim-ledger.json");
  const artifactPath = join(directory, "review/resume.html");
  const validation = validateClaimLedger(ledgerPath, artifactPath);
  if (!validation.passed)
    throw new Error(`원장 검증에 실패해 반영하지 않습니다: ${validation.errors.join("; ")}`);
  const ledger = ClaimLedgerSchema.parse(JSON.parse(readFileSync(ledgerPath, "utf8")));
  if (ledger.schemaVersion !== CURRENT_CLAIM_LEDGER_SCHEMA_VERSION)
    throw new Error("schemaVersion 3 원장만 반영할 수 있습니다.");
  if (ledger.claims.some((claim) => claim.verdict !== "safe"))
    throw new Error("모든 주장이 safe여야 반영할 수 있습니다.");
  if (!existsSync(artifactPath) || ledger.artifactTextSha256 !== artifactTextSha256(artifactPath))
    throw new Error("현재 HTML 문구 해시가 원장과 다릅니다.");
  const application = repositoryPath(directory, root);
  const ledgerRelative = repositoryPath(ledgerPath, root);
  const groups = new Map<string, VerifiedClaim[]>();
  for (const claim of ledger.claims) {
    const snapshots = snapshotsFor(claim, root);
    const first = snapshots.find((item) => item.freshness !== "refresh_required");
    if (!first) continue;
    const value: VerifiedClaim = {
      claimKey: claimKey(claim.proposedText),
      claim,
      evidenceSnapshots: snapshots,
      origins: [
        {
          application,
          ledger: ledgerRelative,
          artifactTextSha256: ledger.artifactTextSha256,
          generatedAt: ledger.generatedAt,
        },
      ],
    };
    const group = groupForPath(first.path);
    groups.set(group, [...(groups.get(group) ?? []), value]);
  }
  const results = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, claims]) => writeGroup(stateDir, group, claims));
  return {
    passed: true,
    application,
    totalClaims: ledger.claims.length,
    storedClaims: results.length ? [...groups.values()].flat().length : 0,
    changedFiles: results.filter((result) => result.changed).map((result) => result.path),
    unchangedFiles: results.filter((result) => !result.changed).map((result) => result.path),
  };
}

export function assess(applicationDir: string, stateDir = defaultStateDir()) {
  const directory = resolve(applicationDir);
  const ledgerPath = join(directory, "review/claim-ledger.json");
  const artifactPath = join(directory, "review/resume.html");
  if (!existsSync(ledgerPath) || !existsSync(artifactPath))
    return {
      passed: true,
      mode: "full_audit",
      totalClaims: 0,
      reusableClaims: 0,
      changedClaims: 0,
      unregisteredClaims: 0,
      rereadEvidence: [],
    };
  let ledger: ClaimLedger;
  try {
    ledger = ClaimLedgerSchema.parse(JSON.parse(readFileSync(ledgerPath, "utf8")));
  } catch {
    return {
      passed: true,
      mode: "full_audit",
      totalClaims: 0,
      reusableClaims: 0,
      changedClaims: 0,
      unregisteredClaims: 0,
      rereadEvidence: [{ path: ledgerPath, reason: "원장 형식 오류" }],
    };
  }
  if (
    ledger.schemaVersion !== CURRENT_CLAIM_LEDGER_SCHEMA_VERSION ||
    ledger.artifactTextSha256 !== artifactTextSha256(artifactPath)
  )
    return {
      passed: true,
      mode: "full_audit",
      totalClaims: ledger.claims.length,
      reusableClaims: 0,
      changedClaims: 0,
      unregisteredClaims: ledger.claims.length,
      rereadEvidence: [
        { path: ledgerPath, reason: "현재 HTML과 일치하는 버전 3 원장이 필요합니다." },
      ],
    };
  const indexed = new Map(
    readStateFiles(stateDir)
      .flatMap(({ file }) => file.claims)
      .map((claim) => [claim.claimKey, claim]),
  );
  let reusableClaims = 0,
    changedClaims = 0,
    unregisteredClaims = 0;
  const reread: Array<{ path: string; reason: string }> = [];
  for (const claim of ledger.claims) {
    const known = indexed.get(claimKey(claim.proposedText));
    if (!known || !isSameRegisteredClaim(claim, known)) {
      unregisteredClaims++;
      continue;
    }
    const freshness = claimFreshness(known);
    if (freshness.fresh) reusableClaims++;
    else {
      changedClaims++;
      for (const reason of freshness.reasons) {
        const separator = reason.indexOf(": ");
        reread.push({ path: separator >= 0 ? reason.slice(0, separator) : reason, reason });
      }
    }
  }
  return {
    passed: true,
    mode:
      reusableClaims === ledger.claims.length
        ? "reuse_all"
        : reusableClaims
          ? "reuse_partial"
          : "full_audit",
    totalClaims: ledger.claims.length,
    reusableClaims,
    changedClaims,
    unregisteredClaims,
    rereadEvidence: reread.sort(
      (a, b) => a.path.localeCompare(b.path) || a.reason.localeCompare(b.reason),
    ),
  };
}

export function search(query: string, stateDir = defaultStateDir()) {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return readStateFiles(stateDir)
    .flatMap(({ file }) => file.claims)
    .map((entry) => {
      const supports = comparisonAxes
        .flatMap((axis) => entry.claim[axis]?.evidence ?? [])
        .map((item) => item.supports)
        .join(" ");
      const corpus =
        `${entry.claim.proposedText} ${entry.evidenceSnapshots.map((item) => item.path).join(" ")} ${supports}`.toLocaleLowerCase();
      const score = terms.reduce((sum, term) => sum + (corpus.includes(term) ? 1 : 0), 0);
      const freshness = claimFreshness(entry);
      return {
        score,
        claimKey: entry.claimKey,
        proposedText: entry.claim.proposedText,
        evidence: entry.evidenceSnapshots.map((item) => ({
          path: item.path,
          axis: item.axis,
          locator: item.locator,
          freshness: item.freshness === "tracked" && freshness.fresh ? "fresh" : item.freshness,
        })),
        origins: entry.origins,
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.claimKey.localeCompare(b.claimKey));
}
