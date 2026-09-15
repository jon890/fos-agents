import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claimKey, normalizeClaimText } from "./verified-claims/identity.ts";
import { groupForPath, readStateFiles, writeGroup } from "./verified-claims/store.ts";
import type { VerifiedClaim } from "./verified-claims/schema.ts";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function claim(): VerifiedClaim {
  return {
    claimKey: claimKey("검증 문장"),
    claim: {
      id: "c1",
      text: "검증 문장",
      location: "이력서",
      type: "technology",
      implementation: { status: "document_only", evidence: [] },
      ownership: { status: "not_claimed", evidence: [] },
      outcome: { status: "not_claimed", evidence: [] },
      experienceDepth: { status: "not_claimed", evidence: [] },
      verdict: "safe",
      proposedText: "검증 문장",
    },
    evidenceSnapshots: [],
    origins: [
      {
        application: "career-os/applications/test/role",
        ledger: "ledger.json",
        artifactTextSha256: "a".repeat(64),
        generatedAt: "2026-09-15",
      },
    ],
  };
}

describe("verified claims", () => {
  test("정규화한 문장은 같은 안정 키를 쓴다", () =>
    expect(claimKey(" 검증\n문장 ")).toBe(claimKey(normalizeClaimText("검증 문장"))));
  test("같은 반영은 상태 파일을 다시 쓰지 않는다", () => {
    const state = mkdtempSync(join(tmpdir(), "verified-claims-"));
    directories.push(state);
    const group = groupForPath("career-os/library/profiles/wanted-profile.md");
    expect(writeGroup(state, group, [claim()]).changed).toBe(true);
    expect(writeGroup(state, group, [claim()]).changed).toBe(false);
    expect(readStateFiles(state)[0].file.claims).toHaveLength(1);
  });
});
