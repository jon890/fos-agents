#!/usr/bin/env bun

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { artifactTextSha256 } from "./artifact_identity.ts";
import { ClaimLedgerSchema, type ClaimLedger } from "./claim_ledger_schema.ts";

export type ClaimLedgerValidation = {
  passed: boolean;
  file: string;
  artifact: string;
  summary: {
    totalClaims: number;
    safe: number;
    soften: number;
    askUser: number;
    remove: number;
    errors: number;
  };
  errors: string[];
};

function resolveLedgerArtifact(ledgerPath: string, artifact: string): string {
  return isAbsolute(artifact) ? artifact : resolve(dirname(resolve(ledgerPath)), artifact);
}

function evidencePathExists(path: string): boolean {
  return existsSync(path) || (!isAbsolute(path) && existsSync(resolve(process.cwd(), path)));
}

function contextualErrors(ledger: ClaimLedger): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const claim of ledger.claims) {
    if (ids.has(claim.id)) errors.push(`중복 claim id: ${claim.id}`);
    ids.add(claim.id);

    const axes = [claim.implementation, claim.ownership, claim.outcome];
    const statuses = axes.map((axis) => axis.status);
    const hasBlockingStatus = statuses.some(
      (status) => status === "unsupported" || status === "contradicted",
    );
    if (claim.verdict === "safe" && hasBlockingStatus) {
      errors.push(`${claim.id}: unsupported 또는 contradicted 상태는 safe일 수 없습니다.`);
    }

    const allEvidence = axes.flatMap((axis) => axis.evidence);
    if (/\d/.test(claim.text) && allEvidence.length === 0) {
      errors.push(`${claim.id}: 수치가 있는 주장에는 근거가 필요합니다.`);
    }

    const strongOwnership = /단독|처음부터 설계|직접 설계|직접 구현|주도/.test(claim.text);
    if (
      strongOwnership &&
      claim.verdict === "safe" &&
      !["git_verified", "user_attested"].includes(claim.ownership.status)
    ) {
      errors.push(`${claim.id}: 강한 소유권 표현은 git_verified 또는 user_attested가 필요합니다.`);
    }

    const claimsOutcome = claim.type === "outcome" || claim.type === "causal";
    const strongOutcome = /해결|제거|안정화|개선|감소|증가/.test(claim.text);
    if (
      (claimsOutcome || strongOutcome) &&
      claim.verdict === "safe" &&
      ["not_claimed", "unsupported", "contradicted"].includes(claim.outcome.status)
    ) {
      errors.push(`${claim.id}: 결과 표현에는 측정·테스트·문서 또는 사용자 확인 근거가 필요합니다.`);
    }

    for (const evidence of allEvidence) {
      if (!evidencePathExists(evidence.path)) {
        errors.push(`${claim.id}: 근거 경로가 존재하지 않습니다: ${evidence.path}`);
      }
    }
  }
  return errors;
}

export function validateClaimLedger(
  ledgerPath: string,
  expectedArtifactPath: string,
): ClaimLedgerValidation {
  const errors: string[] = [];
  let ledger: ClaimLedger | undefined;

  try {
    const parsed = ClaimLedgerSchema.safeParse(JSON.parse(readFileSync(ledgerPath, "utf8")));
    if (!parsed.success) {
      errors.push(...parsed.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`));
    } else {
      ledger = parsed.data;
    }
  } catch (error) {
    errors.push(`claim ledger를 읽을 수 없습니다: ${error}`);
  }

  if (ledger) {
    const ledgerArtifactPath = resolveLedgerArtifact(ledgerPath, ledger.artifact);
    if (!existsSync(ledgerArtifactPath)) {
      errors.push(`ledger의 감사 대상 파일이 존재하지 않습니다: ${ledger.artifact}`);
    } else if (!existsSync(expectedArtifactPath)) {
      errors.push(`요청한 감사 대상 파일이 존재하지 않습니다: ${expectedArtifactPath}`);
    } else {
      if (realpathSync(ledgerArtifactPath) !== realpathSync(expectedArtifactPath)) {
        errors.push(`ledger 감사 대상과 요청한 파일이 다릅니다: ${ledger.artifact}`);
      }
      const currentDigest = artifactTextSha256(expectedArtifactPath);
      if (ledger.artifactTextSha256 !== currentDigest) {
        errors.push("감사 이후 제출 문구가 변경되었습니다. 현재 파일을 다시 감사해야 합니다.");
      }
    }
    errors.push(...contextualErrors(ledger));
  }

  const claims = ledger?.claims ?? [];
  return {
    passed: errors.length === 0,
    file: ledgerPath,
    artifact: expectedArtifactPath,
    summary: {
      totalClaims: claims.length,
      safe: claims.filter((claim) => claim.verdict === "safe").length,
      soften: claims.filter((claim) => claim.verdict === "soften").length,
      askUser: claims.filter((claim) => claim.verdict === "ask_user").length,
      remove: claims.filter((claim) => claim.verdict === "remove").length,
      errors: errors.length,
    },
    errors,
  };
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (import.meta.main) {
  const ledgerPath = process.argv[2];
  const artifactPath = argumentValue("--artifact");
  if (!ledgerPath || !artifactPath || !existsSync(ledgerPath)) {
    console.error(JSON.stringify({
      passed: false,
      error: "사용법: validate_claim_ledger.ts <claim-ledger.json> --artifact <resume.html>",
    }, null, 2));
    process.exit(2);
  }

  const result = validateClaimLedger(ledgerPath, artifactPath);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
