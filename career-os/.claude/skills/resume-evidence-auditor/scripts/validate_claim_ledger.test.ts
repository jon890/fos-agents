import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { artifactTextSha256 } from "./artifact_identity.ts";
import { validateClaimLedger } from "./validate_claim_ledger.ts";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "claim-ledger-"));
  tempDirectories.push(directory);
  const artifact = join(directory, "resume.html");
  const evidence = join(directory, "evidence.md");
  const ledger = join(directory, "claim-ledger.json");

  writeFileSync(artifact, "<html><body><p>검색 파이프라인을 구현했습니다.</p></body></html>");
  writeFileSync(evidence, "# 근거\n검색 파이프라인 구현 기록");

  const data = {
    schemaVersion: 1,
    artifact: "resume.html",
    artifactTextSha256: artifactTextSha256(artifact),
    generatedAt: "2026-08-12T00:00:00.000Z",
    claims: [
      {
        id: "claim-1",
        text: "검색 파이프라인을 구현했습니다.",
        location: "경력",
        type: "implementation",
        implementation: {
          status: "document_only",
          evidence: [{ kind: "document", path: evidence, supports: "구현 기록" }],
        },
        ownership: { status: "document_only", evidence: [] },
        outcome: { status: "not_claimed", evidence: [] },
        verdict: "safe",
        proposedText: "검색 파이프라인을 구현했습니다.",
      },
    ],
  };
  writeFileSync(ledger, JSON.stringify(data));
  return { artifact, data, directory, ledger };
}

describe("validateClaimLedger", () => {
  test("원장과 감사 대상 문구가 같으면 통과한다", () => {
    const { artifact, ledger } = fixture();
    expect(validateClaimLedger(ledger, artifact)).toMatchObject({ passed: true });
  });

  test("스키마에 없는 상태를 거부한다", () => {
    const { artifact, data, ledger } = fixture();
    data.claims[0].implementation.status = "probably_verified";
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("implementation.status");
  });

  test("원장이 다른 제출 파일을 가리키면 거부한다", () => {
    const { directory, ledger } = fixture();
    const otherArtifact = join(directory, "other.html");
    writeFileSync(otherArtifact, "<html><body><p>다른 이력서</p></body></html>");
    const result = validateClaimLedger(ledger, otherArtifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("감사 대상과 요청한 파일이 다릅니다");
  });

  test("감사 뒤 제출 문구가 바뀌면 재감사를 요구한다", () => {
    const { artifact, ledger } = fixture();
    writeFileSync(artifact, "<html><body><p>전체 검색 플랫폼을 단독 설계했습니다.</p></body></html>");
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("제출 문구가 변경되었습니다");
  });
});
