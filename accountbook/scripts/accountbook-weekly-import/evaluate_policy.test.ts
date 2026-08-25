import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ExtractedImport, ValidatedImport } from "../accountbook-screenshot-import/contracts.ts";
import { validateImport } from "../accountbook-screenshot-import/validate_candidates.ts";
import type { InboxSidecarManifest } from "./contracts.ts";
import {
  createWeeklyPolicyApprovedImport,
  evaluateWeeklySafePolicy,
  writeWeeklyPolicyFiles,
} from "./evaluate_policy.ts";

const tempDirs: string[] = [];

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function tempDir(): string {
  const path = mkdtempSync(join(tmpdir(), "accountbook-weekly-policy-"));
  tempDirs.push(path);
  return path;
}

function manifest(
  capturedAt = "2026-08-20T10:17:53+09:00",
  source: InboxSidecarManifest["source"] = "ios-shortcut",
): InboxSidecarManifest {
  return {
    schemaVersion: 1,
    source,
    imageFile: "sample.png",
    capturedAt,
    receivedAt: "2026-08-20T10:18:53+09:00",
  };
}

function extractedFixture(overrides: Partial<ExtractedImport["days"][number]> = {}): ExtractedImport {
  const day = {
    date: "2026-08-19",
    dateSource: "upload-metadata" as const,
    dateEvidence: { screenMonth: 8, screenDay: 19, yearSource: "upload-metadata" as const },
    completeness: "complete" as const,
    selectedForImport: true,
    expectedTotals: { expense: 12000, income: 0 },
    transactions: [
      {
        rowIndex: 1,
        type: "expense" as const,
        amount: 12000,
        description: "예시 상점",
        paymentMethod: "예시 카드",
        categoryName: null,
        confidence: { amount: "high" as const, description: "high" as const, date: "medium" as const },
        evidence: { amountText: "-12,000원", detailText: "예시 상점 | 예시 카드" },
      },
    ],
    ...overrides,
  };
  return {
    schemaVersion: 1,
    source: "toss-consumption-screenshot",
    sourceImage: {
      fileName: "sample.png",
      sha256: "c".repeat(64),
      capturedAt: "2026-08-20T10:17:53+09:00",
      width: 1179,
      height: 2556,
    },
    extraction: {
      engine: "agent-vision",
      runtime: "test",
      extractedAt: "2026-08-20T10:20:00+09:00",
    },
    reviewStatus: "pending",
    days: [day],
  };
}

function validated(
  overrides: Partial<ExtractedImport["days"][number]> = {},
  importOverrides: Partial<ExtractedImport> = {},
): ValidatedImport {
  return validateImport({ ...extractedFixture(overrides), ...importOverrides }, {
    now: () => new Date("2026-08-20T01:30:00Z"),
  });
}

function decisionReasons(batch: ValidatedImport, sidecar = manifest()) {
  return evaluateWeeklySafePolicy(batch, sidecar, new Date("2026-08-20T02:00:00Z")).reasons;
}

function runPolicyCli(args: string[]): ReturnType<typeof Bun.spawnSync> {
  return Bun.spawnSync(["bun", "accountbook/scripts/accountbook-weekly-import/evaluate_policy.ts", ...args], {
    cwd: process.cwd(),
    stdout: "pipe",
    stderr: "pipe",
  });
}

describe("evaluateWeeklySafePolicy", () => {
  test("금액/설명 high와 upload metadata 연도 기반 날짜 medium이면 승인한다", () => {
    const batch = validated();

    const decision = evaluateWeeklySafePolicy(batch, manifest(), new Date("2026-08-20T02:00:00Z"));
    const approved = createWeeklyPolicyApprovedImport(batch, decision);

    expect(decision).toMatchObject({ policyVersion: "weekly-safe-v1", eligible: true, reasons: [] });
    expect(approved).toMatchObject({
      reviewStatus: "approved",
      approvalSource: "weekly-policy",
      approvalPolicyVersion: "weekly-safe-v1",
      reviewedAt: decision.evaluatedAt,
    });
  });

  test("화면 연도 기반 날짜 high이면 승인한다", () => {
    const batch = validated({
      dateSource: "screen",
      dateEvidence: { screenMonth: 8, screenDay: 19, yearSource: "screen" },
      transactions: [{
        ...extractedFixture().days[0].transactions[0],
        confidence: { amount: "high", description: "high", date: "high" },
      }],
    });

    expect(evaluateWeeklySafePolicy(batch, manifest(), new Date("2026-08-20T02:00:00Z")).eligible)
      .toBe(true);
  });

  test("전체 날짜를 upload metadata로 만든 후보는 차단한다", () => {
    expect(decisionReasons(validated({ dateEvidence: null })))
      .toContain("FULL_DATE_FROM_UPLOAD_METADATA");
  });

  test("화면 월일 불일치는 차단한다", () => {
    expect(decisionReasons(validated({
      dateEvidence: { screenMonth: 8, screenDay: 20, yearSource: "upload-metadata" },
    }))).toContain("DATE_EVIDENCE_MONTH_DAY_MISMATCH");
  });

  test("설명 medium과 low confidence는 차단한다", () => {
    expect(decisionReasons(validated({
      transactions: [{
        ...extractedFixture().days[0].transactions[0],
        confidence: { amount: "high", description: "medium", date: "medium" },
      }],
    }))).toContain("DESCRIPTION_CONFIDENCE_NOT_HIGH");

    expect(decisionReasons(validated({
      transactions: [{
        ...extractedFixture().days[0].transactions[0],
        confidence: { amount: "low", description: "high", date: "medium" },
      }],
    }))).toEqual(expect.arrayContaining([
      "VALIDATION_NOT_SUBMITTABLE",
      "AMOUNT_CONFIDENCE_NOT_HIGH",
    ]));
  });

  test("14일 초과와 미래 원본 생성 시각은 차단한다", () => {
    expect(decisionReasons(validated(), manifest("2026-08-01T10:17:53+09:00")))
      .toContain("SOURCE_CAPTURED_AT_TOO_OLD");
    expect(decisionReasons(validated(), manifest("2026-08-21T10:17:53+09:00")))
      .toContain("SOURCE_CAPTURED_AT_FUTURE");
  });

  test("Discord 입력은 당일 거래 날짜를 승인한다", () => {
    const batch = validated({
      date: "2026-08-20",
      dateEvidence: { screenMonth: 8, screenDay: 20, yearSource: "upload-metadata" },
    });

    expect(evaluateWeeklySafePolicy(
      batch,
      manifest("2026-08-20T10:17:53+09:00", "hermes-discord"),
      new Date("2026-08-20T02:00:00Z"),
    ).eligible).toBe(true);
  });

  test("Discord 입력은 14일 전 거래 날짜까지 승인한다", () => {
    const batch = validated({
      date: "2026-08-06",
      dateEvidence: { screenMonth: 8, screenDay: 6, yearSource: "upload-metadata" },
    });

    expect(evaluateWeeklySafePolicy(
      batch,
      manifest("2026-08-20T10:17:53+09:00", "hermes-discord"),
      new Date("2026-08-20T02:00:00Z"),
    ).eligible).toBe(true);
  });

  test("Discord 입력은 15일 전 거래 날짜를 차단한다", () => {
    const batch = validated({
      date: "2026-08-05",
      dateEvidence: { screenMonth: 8, screenDay: 5, yearSource: "upload-metadata" },
    });

    expect(evaluateWeeklySafePolicy(
      batch,
      manifest("2026-08-20T10:17:53+09:00", "hermes-discord"),
      new Date("2026-08-20T02:00:00Z"),
    ).reasons).toContain("DISCORD_DATE_OUTSIDE_AUTO_WINDOW");
  });

  test("Discord 입력은 수신 날짜보다 미래인 거래 날짜를 차단한다", () => {
    const batch = validated({
      date: "2026-08-21",
      dateEvidence: { screenMonth: 8, screenDay: 21, yearSource: "upload-metadata" },
    });

    expect(evaluateWeeklySafePolicy(
      batch,
      manifest("2026-08-20T10:17:53+09:00", "hermes-discord"),
      new Date("2026-08-20T02:00:00Z"),
    ).reasons).toContain("DISCORD_DATE_IN_FUTURE");
  });

  test("upload metadata 연도는 캡처 로컬 날짜 이하의 가장 최근 화면 월일만 승인한다", () => {
    const capturedAt = "2027-01-02T08:00:00+09:00";
    const batch = validated(
      {
        date: "2026-12-31",
        dateEvidence: { screenMonth: 12, screenDay: 31, yearSource: "upload-metadata" },
      },
      {
        sourceImage: {
          ...extractedFixture().sourceImage,
          capturedAt,
        },
      },
    );

    expect(evaluateWeeklySafePolicy(batch, manifest(capturedAt), new Date("2027-01-03T00:00:00Z")).eligible)
      .toBe(true);
    expect(evaluateWeeklySafePolicy(
      validated(
        {
          date: "2027-12-31",
          dateEvidence: { screenMonth: 12, screenDay: 31, yearSource: "upload-metadata" },
        },
        {
          sourceImage: {
            ...extractedFixture().sourceImage,
            capturedAt,
          },
        },
      ),
      manifest(capturedAt),
      new Date("2027-01-03T00:00:00Z"),
    ).reasons).toContain("UPLOAD_METADATA_YEAR_MISMATCH");
  });

  test("validated sourceImage capturedAt과 manifest capturedAt이 같은 instant가 아니면 차단한다", () => {
    const batch = validated({}, {
      sourceImage: {
        ...extractedFixture().sourceImage,
        capturedAt: "2026-08-20T10:17:54+09:00",
      },
    });

    expect(decisionReasons(batch)).toContain("SOURCE_CAPTURED_AT_MISMATCH");
  });

  test("weekly-policy.json과 approved.json을 분리해 mode 0600으로 쓴다", () => {
    const dir = tempDir();
    const policyOutput = join(dir, "weekly-policy.json");
    const approvedOutput = join(dir, "approved.json");

    const decision = writeWeeklyPolicyFiles({
      validated: validated(),
      manifest: manifest(),
      policyOutput,
      approvedOutput,
      now: new Date("2026-08-20T02:00:00Z"),
    });

    expect(decision.eligible).toBe(true);
    expect(JSON.parse(readFileSync(policyOutput, "utf8")).policyVersion).toBe("weekly-safe-v1");
    expect(JSON.parse(readFileSync(approvedOutput, "utf8")).approvalSource).toBe("weekly-policy");
    expect(statSync(policyOutput).mode & 0o777).toBe(0o600);
    expect(statSync(approvedOutput).mode & 0o777).toBe(0o600);
  });

  test("차단되면 이전 approved.json을 제거해 stale 승인을 막는다", () => {
    const dir = tempDir();
    const policyOutput = join(dir, "weekly-policy.json");
    const approvedOutput = join(dir, "approved.json");
    writeFileSync(approvedOutput, "{\"stale\":true}\n", { mode: 0o600 });

    const decision = writeWeeklyPolicyFiles({
      validated: validated({ dateEvidence: null }),
      manifest: manifest(),
      policyOutput,
      approvedOutput,
      now: new Date("2026-08-20T02:00:00Z"),
    });

    expect(decision.eligible).toBe(false);
    expect(existsSync(policyOutput)).toBe(true);
    expect(existsSync(approvedOutput)).toBe(false);
  });

  test("approved 생성은 decision schema와 eligible을 검증한다", () => {
    const batch = validated();
    const decision = evaluateWeeklySafePolicy(batch, manifest(), new Date("2026-08-20T02:00:00Z"));

    expect(() => createWeeklyPolicyApprovedImport(batch, { ...decision, eligible: false }))
      .toThrow("WEEKLY_POLICY_NOT_ELIGIBLE");
    expect(() => createWeeklyPolicyApprovedImport(batch, { ...decision, policyVersion: "tampered" } as never))
      .toThrow();
  });

  test("차단 CLI는 policy만 쓰고 exit 3, 입력 오류는 exit 2를 반환한다", () => {
    const dir = tempDir();
    const validatedPath = join(dir, "validated.json");
    const manifestPath = join(dir, "manifest.json");
    const policyOutput = join(dir, "weekly-policy.json");
    const approvedOutput = join(dir, "approved.json");
    writeFileSync(validatedPath, `${JSON.stringify(validated({ dateEvidence: null }), null, 2)}\n`);
    writeFileSync(manifestPath, `${JSON.stringify(manifest(), null, 2)}\n`);

    const blocked = runPolicyCli([
      "--validated", validatedPath,
      "--manifest", manifestPath,
      "--policy-output", policyOutput,
      "--approved-output", approvedOutput,
    ]);
    expect(blocked.exitCode).toBe(3);
    expect(existsSync(policyOutput)).toBe(true);
    expect(existsSync(approvedOutput)).toBe(false);

    const invalid = runPolicyCli([
      "--validated", join(dir, "missing.json"),
      "--manifest", manifestPath,
      "--policy-output", join(dir, "policy2.json"),
      "--approved-output", join(dir, "approved2.json"),
    ]);
    expect(invalid.exitCode).toBe(2);
  });
});
