import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { ExtractedImport } from "../accountbook-screenshot-import/contracts.ts";
import type { SubmitConfig } from "../accountbook-screenshot-import/submit_import.ts";
import { validateImport } from "../accountbook-screenshot-import/validate_candidates.ts";
import { finalizeInboxItem } from "../accountbook-weekly-import/finalize_inbox.ts";
import { evaluateWeeklySafePolicy } from "../accountbook-weekly-import/evaluate_policy.ts";
import { runWeeklyImport } from "../accountbook-weekly-import/run_weekly_import.ts";
import {
  acquireWeeklyRunLock,
  loadWeeklyState,
  scanAndClaimInbox,
} from "../accountbook-weekly-import/scan_inbox.ts";
import type { WeeklyWorkItem } from "../accountbook-weekly-import/contracts.ts";
import { stageDiscordAttachment } from "./stage_attachment.ts";

const tempDirs: string[] = [];
const receivedAt = new Date("2026-08-20T10:00:00+09:00");
const now = () => new Date("2026-08-20T10:10:00+09:00");
const config: SubmitConfig = {
  apiBaseUrl: "https://accountbook.test/api/v1",
  familyUuid: "family-uuid",
  refreshToken: "test-refresh-token",
  defaultCategoryName: "미분류",
  excludeFromBudget: false,
};
const pngBytes = Buffer.from([
  137, 80, 78, 71, 13, 10, 26, 10,
  0, 0, 0, 13, 73, 72, 68, 82,
  0, 0, 0, 1, 0, 0, 0, 1,
  8, 6, 0, 0, 0, 31, 21, 196,
  137,
]);

afterEach(() => {
  for (const path of tempDirs.splice(0)) rmSync(path, { recursive: true, force: true });
});

function fixture(): { privateRoot: string; attachmentPath: string } {
  const root = mkdtempSync(join(tmpdir(), "accountbook-discord-pipeline-"));
  tempDirs.push(root);
  const attachmentPath = join(root, "attachment.png");
  writeFileSync(attachmentPath, pngBytes);
  return { privateRoot: join(root, "private"), attachmentPath };
}

function extracted(item: WeeklyWorkItem, date: string): ExtractedImport {
  const [, month, day] = date.split("-").map(Number);
  return {
    schemaVersion: 1,
    source: "toss-consumption-screenshot",
    sourceImage: {
      fileName: item.imageFile,
      sha256: item.imageSha256,
      capturedAt: item.manifest.capturedAt,
      width: 1179,
      height: 2556,
    },
    extraction: {
      engine: "agent-vision",
      runtime: "discord-pipeline-test",
      extractedAt: now().toISOString(),
    },
    reviewStatus: "pending",
    days: [{
      date,
      dateSource: "upload-metadata",
      dateEvidence: { screenMonth: month, screenDay: day, yearSource: "upload-metadata" },
      completeness: "complete",
      selectedForImport: true,
      expectedTotals: { expense: 12000, income: 0 },
      transactions: [{
        rowIndex: 1,
        type: "expense",
        amount: 12000,
        description: "비식별 상점",
        paymentMethod: "비식별 카드",
        categoryName: null,
        confidence: { amount: "high", description: "high", date: "medium" },
        evidence: { amountText: "-12,000원", detailText: "비식별 상점 | 비식별 카드" },
      }],
    }],
  };
}

function stageAndClaim(privateRoot: string, attachmentPath: string, runId?: string): WeeklyWorkItem {
  stageDiscordAttachment({ inputPath: attachmentPath, privateRoot, receivedAt });
  const items = scanAndClaimInbox({ privateRoot, runId, now: now() });
  expect(items).toHaveLength(1);
  return items[0];
}

describe("Discord 가계부 입력 통합 흐름", () => {
  test("첨부 파일을 적재하고 당일 거래 후보를 안전 정책으로 승인한다", () => {
    const { privateRoot, attachmentPath } = fixture();
    const staged = stageDiscordAttachment({ inputPath: attachmentPath, privateRoot, receivedAt });
    const [item] = scanAndClaimInbox({ privateRoot, now: now() });
    const candidate = validateImport(extracted(item, "2026-08-20"), { now });
    const manifest = JSON.parse(readFileSync(item.manifestPath, "utf8"));

    expect(staged.status).toBe("staged");
    expect(basename(staged.imagePath)).toBe(item.imageFile);
    expect(item.manifest.source).toBe("hermes-discord");
    expect(evaluateWeeklySafePolicy(candidate, manifest, now())).toMatchObject({
      eligible: true,
      reasons: [],
    });
  });

  test("수신일보다 15일 지난 거래 날짜는 accountbook 요청 전에 차단한다", async () => {
    const { privateRoot, attachmentPath } = fixture();
    const runId = "discord-old-date";
    acquireWeeklyRunLock(privateRoot, runId, now());
    const item = stageAndClaim(privateRoot, attachmentPath, runId);
    const queuePath = join(privateRoot, "state", `${runId}-queue.json`);
    writeFileSync(queuePath, `${JSON.stringify({
      schemaVersion: 1,
      runId,
      generatedAt: now().toISOString(),
      items: [item],
    }, null, 2)}\n`, { mode: 0o600 });

    const candidate = validateImport(extracted(item, "2026-08-05"), { now });
    const runDir = join(privateRoot, "imports", candidate.batchId);
    mkdirSync(runDir, { recursive: true, mode: 0o700 });
    const validatedPath = join(runDir, "validated.json");
    writeFileSync(validatedPath, `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o600 });
    let fetchCount = 0;

    const summary = await runWeeklyImport({
      privateRoot,
      plan: {
        schemaVersion: 1,
        runId,
        queuePath,
        items: [{ imageSha256: item.imageSha256, validatedPath }],
      },
      config,
      fetchImpl: async () => {
        fetchCount += 1;
        return new Response("{}", { status: 200 });
      },
      now,
    });

    expect(summary).toMatchObject({ submitted: 0, needsReview: 1, failed: 0 });
    expect(fetchCount).toBe(0);
    expect(loadWeeklyState(privateRoot).items[item.imageSha256]).toMatchObject({
      status: "needs_review",
      lastErrorCode: "WEEKLY_POLICY_REJECTED",
    });
  });

  test("처리가 끝난 같은 첨부 파일을 다시 보내도 새 작업을 만들지 않는다", () => {
    const { privateRoot, attachmentPath } = fixture();
    const item = stageAndClaim(privateRoot, attachmentPath);
    finalizeInboxItem({
      privateRoot,
      imageSha256: item.imageSha256,
      status: "failed",
      batchId: null,
      lastErrorCode: "WEEKLY_INPUT_INVALID",
      now: now(),
    });

    expect(stageDiscordAttachment({ inputPath: attachmentPath, privateRoot, receivedAt }).status)
      .toBe("staged");
    expect(scanAndClaimInbox({ privateRoot, now: now() })).toEqual([]);
    expect(Object.keys(loadWeeklyState(privateRoot).items)).toEqual([item.imageSha256]);
  });
});
