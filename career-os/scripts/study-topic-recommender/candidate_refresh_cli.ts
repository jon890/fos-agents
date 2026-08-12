import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyNewCandidates } from "./candidate_refresh_apply.js";
import { candidateRefreshHelp, parseCandidateRefreshArgs } from "./candidate_refresh_args.js";
import { buildCandidateRefreshDecisions } from "./candidate_refresh_decision.js";
import {
  parseProposals,
  type CandidateRefreshReport,
  type CandidateRefreshTrigger,
} from "./candidate_refresh_schema.js";
import { scanFosStudyInventory } from "./fos_study_inventory.js";
import { renderCandidateRefreshMarkdown } from "./render/candidate_refresh.js";
import { loadCandidateRefreshInputs } from "./persistence/candidate_refresh_inputs.js";

const ROOT = process.env.CAREER_OS_ROOT
  ? resolve(process.env.CAREER_OS_ROOT)
  : resolve(import.meta.dir, "..", "..");
const STATE = join(ROOT, "state");
const FOS_STUDY_ROOT = join(ROOT, "sources", "fos-study");
const CANDIDATES_PATH = join(STATE, "study-pack-candidates.json");
const HISTORY_PATH = join(STATE, "topic-inventory-history.jsonl");
const REPORT_JSON_PATH = join(STATE, "study-topic-candidate-refresh.json");
const REPORT_MARKDOWN_PATH = join(STATE, "study-topic-candidate-refresh.md");

async function readProposalText(path: string): Promise<string> {
  if (path === "-") return new Response(Bun.stdin.stream()).text();
  if (!existsSync(path)) throw new Error(`proposals 파일이 없다: ${path}`);
  return readFileSync(path, "utf8");
}

function loadExistingReport(): CandidateRefreshReport {
  if (!existsSync(REPORT_JSON_PATH)) {
    throw new Error("study-topic-candidate-refresh.json이 없다. 먼저 일반 refresh를 실행해야 한다.");
  }
  const raw = JSON.parse(readFileSync(REPORT_JSON_PATH, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("candidate refresh 리포트가 객체가 아니다.");
  }
  const report = raw as Partial<CandidateRefreshReport>;
  if (!Array.isArray(report.proposals) || !Array.isArray(report.decisions) || !report.applied) {
    throw new Error("candidate refresh 리포트의 필수 필드가 없다.");
  }
  return raw as CandidateRefreshReport;
}

function decisionCounts(report: CandidateRefreshReport): Record<string, number> {
  return {
    new: report.decisions.filter((item) => item.decision === "new").length,
    updateExisting: report.decisions.filter((item) => item.decision === "update-existing").length,
    needsConfirmation: report.decisions.filter((item) => item.decision === "needs-confirmation").length,
    skip: report.decisions.filter((item) => item.decision === "skip").length,
  };
}

function writeReport(report: CandidateRefreshReport): void {
  mkdirSync(STATE, { recursive: true });
  writeFileSync(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(REPORT_MARKDOWN_PATH, renderCandidateRefreshMarkdown(report), "utf8");
}

export async function main(): Promise<void> {
  const options = parseCandidateRefreshArgs(process.argv);
  if (options.help) {
    process.stdout.write(`${candidateRefreshHelp()}\n`);
    return;
  }
  if (options.renderOnly) {
    const report = loadExistingReport();
    writeFileSync(REPORT_MARKDOWN_PATH, renderCandidateRefreshMarkdown(report), "utf8");
    console.log(JSON.stringify({
      mode: "render-only",
      runtimeJson: REPORT_JSON_PATH,
      runtimeMd: REPORT_MARKDOWN_PATH,
      decisions: decisionCounts(report),
    }));
    return;
  }
  if (!options.proposalsPath) {
    throw new Error("--proposals <path|-> 또는 --render-only가 필요하다.");
  }

  let rawProposals: unknown;
  try {
    rawProposals = JSON.parse(await readProposalText(options.proposalsPath)) as unknown;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`proposals JSON 파싱 실패: ${message}`);
  }
  const parsed = parseProposals(rawProposals);
  if (parsed.invalid.length > 0) {
    const details = parsed.invalid
      .map((item) => `[${item.index}] ${item.errors.join("; ")}`)
      .join("\n");
    process.stderr.write(`경고: ${parsed.invalid.length}개 proposal 검증 실패\n${details}\n`);
  }

  const fosStudy = scanFosStudyInventory({ root: FOS_STUDY_ROOT });
  const decisions = buildCandidateRefreshDecisions(
    parsed.valid,
    fosStudy.markdownPathsRelative
  );
  const generatedAt = new Date().toISOString();
  const trigger: CandidateRefreshTrigger = {
    kind: options.triggerKind,
    reason: options.triggerReason,
    sourceMessage: options.context || null,
  };
  const applied = options.dryRun
    ? { configPath: CANDIDATES_PATH, added: [], updated: [], staled: [] }
    : applyNewCandidates(CANDIDATES_PATH, parsed.valid, decisions, generatedAt);
  const report: CandidateRefreshReport = {
    generatedAt,
    trigger,
    inputs: loadCandidateRefreshInputs({
      historyPath: HISTORY_PATH,
      candidatesPath: CANDIDATES_PATH,
      fosStudyMarkdownCount: fosStudy.scannedMarkdownCount,
    }),
    proposals: parsed.valid,
    decisions,
    applied,
  };
  writeReport(report);
  console.log(JSON.stringify({
    generatedAt,
    runtimeJson: REPORT_JSON_PATH,
    runtimeMd: REPORT_MARKDOWN_PATH,
    dryRun: options.dryRun,
    proposals: parsed.valid.length,
    invalid: parsed.invalid.length,
    decisions: decisionCounts(report),
    applied: {
      added: applied.added.length,
      updated: applied.updated.length,
      staled: applied.staled.length,
    },
  }));
}
