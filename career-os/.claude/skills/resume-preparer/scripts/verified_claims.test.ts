import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { claimKey, normalizeClaimText } from "./verified-claims/identity.ts";
import { claimFreshness } from "./verified-claims/evidence.ts";
import { groupForPath, readStateFiles, writeGroup } from "./verified-claims/store.ts";
import type { VerifiedClaim } from "./verified-claims/schema.ts";
import { isSameRegisteredClaim, search } from "./verified-claims/service.ts";

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
  test("runtime-only 판정 축은 재확인이 필요하다", () => {
    const runtimeOnly: VerifiedClaim = {
      ...claim(),
      evidenceSnapshots: [
        {
          path: "https://example.com/runtime",
          kind: "runtime",
          axis: "implementation",
          freshness: "refresh_required",
        },
      ],
    };
    expect(claimFreshness(runtimeOnly)).toEqual({
      fresh: false,
      reasons: ["https://example.com/runtime: implementation 축 HTTPS runtime 근거 재확인 필요"],
    });
  });
  test("claimKey가 같아도 판정 근거가 다르면 재사용하지 않는다", () => {
    const registered = claim();
    const current = {
      ...registered.claim,
      implementation: {
        status: "document_only" as const,
        evidence: [{ kind: "document" as const, path: "changed.md", supports: "다른 근거" }],
      },
    };
    expect(isSameRegisteredClaim(current, registered)).toBe(false);
  });
  test("손상된 상태 파일은 경로를 포함해 중단한다", () => {
    const state = mkdtempSync(join(tmpdir(), "verified-claims-"));
    directories.push(state);
    writeFileSync(join(state, "broken.json"), "{");
    expect(() => readStateFiles(state)).toThrow("broken.json");
  });
  test("같은 키의 origin은 안정적으로 합치고 전체 축 supports를 검색한다", () => {
    const state = mkdtempSync(join(tmpdir(), "verified-claims-"));
    directories.push(state);
    const first = claim();
    const second: VerifiedClaim = {
      ...first,
      claim: {
        ...first.claim,
        outcome: {
          status: "documented",
          evidence: [{ kind: "document", path: "outcome.md", supports: "결과 검색어" }],
        },
      },
      evidenceSnapshots: [
        { path: "outcome.md", kind: "document", axis: "outcome", freshness: "missing" },
      ],
      origins: [{ ...first.origins[0], ledger: "other-ledger.json" }],
    };
    const group = groupForPath("career-os/library/profiles/wanted-profile.md");
    writeGroup(state, group, [first]);
    writeGroup(state, group, [second]);
    expect(readStateFiles(state)[0].file.claims[0].origins).toHaveLength(2);
    expect(search("결과 검색어", state)[0].evidence[0].axis).toBe("outcome");
  });
});
