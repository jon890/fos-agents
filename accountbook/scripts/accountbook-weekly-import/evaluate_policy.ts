import { chmodSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import {
  validatedImportSchema,
  type ValidatedImport,
} from "../accountbook-screenshot-import/contracts.ts";
import {
  inboxSidecarManifestSchema,
  type InboxSidecarManifest,
} from "./contracts.ts";

const POLICY_VERSION = "weekly-safe-v1";
const MAX_CAPTURE_AGE_MS = 14 * 24 * 60 * 60 * 1000;

const weeklyPolicyDecisionSchema = z.object({
  policyVersion: z.literal(POLICY_VERSION),
  eligible: z.boolean(),
  reasons: z.array(z.string()),
  evaluatedAt: z.string().datetime({ offset: true }),
});

export type WeeklyPolicyDecision = z.infer<typeof weeklyPolicyDecisionSchema>;

function nowIso(now?: Date): string {
  return (now ?? new Date()).toISOString();
}

function addReason(reasons: Set<string>, reason: string): void {
  reasons.add(reason);
}

function parseDateParts(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function dateOnlyMillis(date: string): number {
  const { year, month, day } = parseDateParts(date);
  return Date.UTC(year, month - 1, day);
}

function captureTime(manifest: InboxSidecarManifest): number {
  const millis = Date.parse(manifest.capturedAt);
  if (Number.isNaN(millis)) throw new Error("INVALID_MANIFEST_CAPTURED_AT");
  return millis;
}

function expectedUploadMetadataYear(manifest: InboxSidecarManifest, screenMonth: number, screenDay: number): number {
  const [capturedYear, capturedMonth, capturedDay] = manifest.capturedAt
    .slice(0, 10)
    .split("-")
    .map(Number);
  if (screenMonth < capturedMonth || (screenMonth === capturedMonth && screenDay <= capturedDay)) {
    return capturedYear;
  }
  return capturedYear - 1;
}

export function evaluateWeeklySafePolicy(
  rawValidated: unknown,
  rawManifest: unknown,
  now = new Date(),
): WeeklyPolicyDecision {
  const validated = validatedImportSchema.parse(rawValidated);
  const manifest = inboxSidecarManifestSchema.parse(rawManifest);
  const reasons = new Set<string>();
  const capturedAtMillis = captureTime(manifest);

  if (!validated.validation.submissionReady) addReason(reasons, "VALIDATION_NOT_SUBMITTABLE");
  if (capturedAtMillis > now.getTime()) addReason(reasons, "SOURCE_CAPTURED_AT_FUTURE");
  if (now.getTime() - capturedAtMillis > MAX_CAPTURE_AGE_MS) addReason(reasons, "SOURCE_CAPTURED_AT_TOO_OLD");
  if (validated.sourceImage.fileName !== manifest.imageFile) addReason(reasons, "SOURCE_IMAGE_FILE_MISMATCH");
  if (Date.parse(validated.sourceImage.capturedAt) !== capturedAtMillis) {
    addReason(reasons, "SOURCE_CAPTURED_AT_MISMATCH");
  }
  const capturedDateMillis = dateOnlyMillis(manifest.capturedAt.slice(0, 10));

  for (const day of validated.days.filter((candidateDay) => candidateDay.selectedForImport)) {
    if (day.validation.status !== "exact") addReason(reasons, "SELECTED_DAY_NOT_EXACT");
    if (day.completeness !== "complete") addReason(reasons, "SELECTED_DAY_INCOMPLETE");
    if (manifest.source === "hermes-discord") {
      const selectedDateMillis = dateOnlyMillis(day.date);
      if (selectedDateMillis > capturedDateMillis) addReason(reasons, "DISCORD_DATE_IN_FUTURE");
      if (capturedDateMillis - selectedDateMillis > MAX_CAPTURE_AGE_MS) {
        addReason(reasons, "DISCORD_DATE_OUTSIDE_AUTO_WINDOW");
      }
    }

    const evidence = day.dateEvidence;
    if (!evidence) {
      addReason(reasons, day.dateSource === "upload-metadata"
        ? "FULL_DATE_FROM_UPLOAD_METADATA"
        : "DATE_EVIDENCE_REQUIRED");
    } else {
      const date = parseDateParts(day.date);
      if (evidence.screenMonth !== date.month || evidence.screenDay !== date.day) {
        addReason(reasons, "DATE_EVIDENCE_MONTH_DAY_MISMATCH");
      }
      if (day.dateSource === "screen") {
        if (evidence.yearSource !== "screen") addReason(reasons, "SCREEN_DATE_YEAR_SOURCE_NOT_SCREEN");
      } else if (day.dateSource === "upload-metadata") {
        if (evidence.yearSource !== "upload-metadata") addReason(reasons, "UPLOAD_METADATA_YEAR_SOURCE_REQUIRED");
        if (date.year !== expectedUploadMetadataYear(manifest, evidence.screenMonth, evidence.screenDay)) {
          addReason(reasons, "UPLOAD_METADATA_YEAR_MISMATCH");
        }
      } else {
        addReason(reasons, "DATE_SOURCE_NOT_AUTO_APPROVABLE");
      }
    }

    for (const transaction of day.transactions) {
      if (transaction.confidence.amount !== "high") addReason(reasons, "AMOUNT_CONFIDENCE_NOT_HIGH");
      if (transaction.confidence.description !== "high") addReason(reasons, "DESCRIPTION_CONFIDENCE_NOT_HIGH");
      if (day.dateSource === "screen" && transaction.confidence.date !== "high") {
        addReason(reasons, "SCREEN_DATE_CONFIDENCE_NOT_HIGH");
      }
      if (day.dateSource === "upload-metadata" && transaction.confidence.date !== "medium") {
        addReason(reasons, "UPLOAD_METADATA_DATE_CONFIDENCE_NOT_MEDIUM");
      }
    }
  }

  return weeklyPolicyDecisionSchema.parse({
    policyVersion: POLICY_VERSION,
    eligible: reasons.size === 0,
    reasons: [...reasons].sort(),
    evaluatedAt: nowIso(now),
  });
}

export function createWeeklyPolicyApprovedImport(
  rawValidated: unknown,
  decision: WeeklyPolicyDecision,
): ValidatedImport {
  const parsedDecision = weeklyPolicyDecisionSchema.parse(decision);
  if (!parsedDecision.eligible) throw new Error("WEEKLY_POLICY_NOT_ELIGIBLE");
  const validated = validatedImportSchema.parse(rawValidated);
  return validatedImportSchema.parse({
    ...validated,
    reviewStatus: "approved",
    reviewedAt: parsedDecision.evaluatedAt,
    approvalSource: "weekly-policy",
    approvalPolicyVersion: POLICY_VERSION,
  });
}

export function writeWeeklyPolicyFiles(options: {
  validated: unknown;
  manifest: unknown;
  policyOutput: string;
  approvedOutput: string;
  now?: Date;
}): WeeklyPolicyDecision {
  const decision = evaluateWeeklySafePolicy(options.validated, options.manifest, options.now);
  atomicJsonWrite0600(options.policyOutput, decision);
  if (decision.eligible) {
    atomicJsonWrite0600(options.approvedOutput, createWeeklyPolicyApprovedImport(options.validated, decision));
  } else if (existsSync(options.approvedOutput)) {
    unlinkSync(options.approvedOutput);
  }
  return decision;
}

function atomicJsonWrite0600(path: string, value: unknown): void {
  const tempPath = join(dirname(path), `.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`);
  writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(tempPath, 0o600);
  renameSync(tempPath, path);
  chmodSync(path, 0o600);
}

function parseArgs(args: string[]): {
  validatedPath: string;
  manifestPath: string;
  policyOutput: string;
  approvedOutput: string;
} {
  let validatedPath = "";
  let manifestPath = "";
  let policyOutput = "";
  let approvedOutput = "";
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--validated") validatedPath = args[++index] ?? "";
    else if (arg === "--manifest") manifestPath = args[++index] ?? "";
    else if (arg === "--policy-output") policyOutput = args[++index] ?? "";
    else if (arg === "--approved-output") approvedOutput = args[++index] ?? "";
    else throw new Error(`UNKNOWN_ARGUMENT:${arg}`);
  }
  if (!validatedPath) throw new Error("MISSING_ARGUMENT:--validated");
  if (!manifestPath) throw new Error("MISSING_ARGUMENT:--manifest");
  if (!policyOutput) throw new Error("MISSING_ARGUMENT:--policy-output");
  if (!approvedOutput) throw new Error("MISSING_ARGUMENT:--approved-output");
  return { validatedPath, manifestPath, policyOutput, approvedOutput };
}

export function main(args = process.argv.slice(2)): void {
  const options = parseArgs(args);
  const decision = writeWeeklyPolicyFiles({
    validated: JSON.parse(readFileSync(options.validatedPath, "utf8")),
    manifest: JSON.parse(readFileSync(options.manifestPath, "utf8")),
    policyOutput: options.policyOutput,
    approvedOutput: options.approvedOutput,
  });
  if (!decision.eligible) process.exitCode = 3;
  else process.stdout.write(`${POLICY_VERSION}\n`);
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (entrypoint === import.meta.url) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`WEEKLY_POLICY_EVALUATION_FAILED:${message}\n`);
    process.exitCode = 2;
  }
}
