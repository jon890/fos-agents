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
    schemaVersion: 2,
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

  test("runtime 근거의 HTTPS URL을 허용한다", () => {
    const { artifact, data, ledger } = fixture();
    data.claims[0].outcome = {
      status: "measured",
      evidence: [{
        kind: "runtime",
        path: "https://api.example.com/metrics/downloads",
        supports: "실행 시점 다운로드 지표",
      }],
    };
    writeFileSync(ledger, JSON.stringify(data));
    expect(validateClaimLedger(ledger, artifact)).toMatchObject({ passed: true });
  });

  test("runtime 근거라도 HTTP URL은 거부한다", () => {
    const { artifact, data, ledger } = fixture();
    data.claims[0].outcome = {
      status: "measured",
      evidence: [{
        kind: "runtime",
        path: "http://api.example.com/metrics/downloads",
        supports: "실행 시점 다운로드 지표",
      }],
    };
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("근거 경로가 존재하지 않습니다");
  });

  test("runtime이 아닌 근거는 원격 URL을 사용할 수 없다", () => {
    const { artifact, data, ledger } = fixture();
    data.claims[0].implementation.evidence[0] = {
      kind: "document",
      path: "https://docs.example.com/claim",
      supports: "원격 문서",
    };
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("근거 경로가 존재하지 않습니다");
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

  test("사용자 확인이 남은 원장은 제출 준비 완료로 통과시키지 않는다", () => {
    const { artifact, data, ledger } = fixture();
    data.claims[0].verdict = "ask_user";
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("ask_user 판정이 남아 있어");
  });

  test("Kotlin 코드 기여만으로 Kotlin 운영 노하우를 통과시키지 않는다", () => {
    const { artifact, data, ledger } = fixture();
    writeFileSync(artifact, "<html><body><p>Kotlin 운영 노하우를 보유했습니다.</p></body></html>");
    data.artifactTextSha256 = artifactTextSha256(artifact);
    data.claims[0].text = "Kotlin 운영 노하우를 보유했습니다.";
    data.claims[0].type = "technology";
    data.claims[0].experienceDepth = {
      status: "delivery_verified",
      evidence: [{ kind: "git", path: data.claims[0].implementation.evidence[0].path, supports: "기능 커밋" }],
    };
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("숙련도·운영 깊이 표현에는");
  });

  test("기술 숙련도 주장에 경험 깊이 판정이 없으면 거부한다", () => {
    const { artifact, data, ledger } = fixture();
    writeFileSync(artifact, "<html><body><p>Kotlin을 주력 기술로 사용했습니다.</p></body></html>");
    data.artifactTextSha256 = artifactTextSha256(artifact);
    data.claims[0].text = "Kotlin을 주력 기술로 사용했습니다.";
    data.claims[0].type = "technology";
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("experienceDepth");
  });

  test("운영 노하우를 주장하면서 경험 깊이를 주장하지 않았다고 표시할 수 없다", () => {
    const { artifact, data, ledger } = fixture();
    writeFileSync(artifact, "<html><body><p>Kotlin 운영 노하우를 보유했습니다.</p></body></html>");
    data.artifactTextSha256 = artifactTextSha256(artifact);
    data.claims[0].text = "Kotlin 운영 노하우를 보유했습니다.";
    data.claims[0].type = "technology";
    data.claims[0].experienceDepth = { status: "not_claimed", evidence: [] };
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("숙련도·운영 깊이 표현에는");
  });

  test("여러 기술에 하나의 경력 기간을 적용하면 기술별 분리를 요구한다", () => {
    const { artifact, data, ledger } = fixture();
    writeFileSync(artifact, "<html><body><p>7년 동안 Java와 Kotlin 백엔드를 개발했습니다.</p></body></html>");
    data.artifactTextSha256 = artifactTextSha256(artifact);
    data.claims[0].text = "7년 동안 Java와 Kotlin 백엔드를 개발했습니다.";
    data.claims[0].type = "timeline";
    data.claims[0].experienceDepth = {
      status: "delivery_verified",
      evidence: [{ kind: "git", path: data.claims[0].implementation.evidence[0].path, supports: "기능 커밋" }],
    };
    writeFileSync(ledger, JSON.stringify(data));
    const result = validateClaimLedger(ledger, artifact);
    expect(result.passed).toBe(false);
    expect(result.errors.join("\n")).toContain("기술별로 분리해야 합니다");
  });
});
