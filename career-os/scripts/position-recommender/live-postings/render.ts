// Markdown snapshot renderer. Sorts postings and writes the output file.

import { mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { Posting, CollectionDiagnostics } from "./types.ts";
import { postSortKey } from "./policy.ts";

const DEFAULT_TEXT_LIMIT = 360;
const SUMMARY_TEXT_LIMIT = 120;
const LIST_LIMIT = 8;

function compactText(value: string | undefined, limit = DEFAULT_TEXT_LIMIT): string {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, Math.max(0, limit - 3)).trimEnd()}...`;
}

function compactList(values: string[], limit = LIST_LIMIT): string[] {
  return values
    .map((value) => compactText(value, 60))
    .filter(Boolean)
    .slice(0, limit);
}

export function render(posts: Posting[], outPath: string, diagnostics: CollectionDiagnostics): void {
  posts.sort((a, b) => {
    const [aj, at] = postSortKey(a);
    const [bj, bt] = postSortKey(b);
    return aj !== bj ? aj - bj : at - bt;
  });

  const sourceCounts = new Map<string, number>();
  for (const p of posts) sourceCounts.set(p.source, (sourceCounts.get(p.source) ?? 0) + 1);
  const directActiveCount = posts.filter(
    (p) => p.linkType === "direct_posting" && ["active", "open"].includes(p.postingStatus)
  ).length;
  const nonDirectCount = posts.filter((p) => p.linkType !== "direct_posting").length;
  const urgentCount = posts.filter((p) => p.closeUrgency === "urgent").length;
  const soonCount = posts.filter((p) => p.closeUrgency === "soon").length;
  const noDeadlineCount = posts.filter((p) => p.closeUrgency === "no_deadline").length;

  const lines: string[] = [
    "# Live Posting Snapshot",
    "",
    "수집 기준: active-only. `link_type: direct_posting`이고 `posting_status: active/open`인 지원 가능한 개별 공고만 유지한다.",
    "닫힌 공고, 상태 확인 실패 공고, 회사 채용홈, 커리어 아티클, 검색 페이지는 snapshot에서 제외한다.",
    "",
    "## Collection Diagnostics",
    "",
    `- requested_source: ${diagnostics.requestedSource}`,
    `- configured_sources: ${diagnostics.configuredSources.join(", ") || "-"}`,
    `- server_only: ${diagnostics.serverOnly}`,
    `- wanted_limit: ${diagnostics.wantedLimit}`,
    `- include_toss_articles: ${diagnostics.includeTossArticles}`,
    `- total_collected: ${posts.length}`,
    `- direct_active_or_open_postings: ${directActiveCount}`,
    `- non_direct_leads: ${nonDirectCount}`,
    `- close_urgency_counts: urgent=${urgentCount}, soon=${soonCount}, no_deadline=${noDeadlineCount}`,
    `- source_counts: ${Array.from(sourceCounts.entries()).map(([k, v]) => `${k}=${v}`).join(", ") || "-"}`,
    `- source_diagnostics: ${
      diagnostics.sourceDiagnostics.length > 0
        ? diagnostics.sourceDiagnostics
            .map((d) =>
              `${d.source}:${d.status} collected=${d.collectedCount} imported=${d.importedCount} skipped=${d.skippedCount} failed=${d.failedCount}`
            )
            .join(" | ")
        : "-"
    }`,
    `- source_errors: ${diagnostics.errors.length > 0 ? diagnostics.errors.join(" | ") : "-"}`,
    "",
  ];
  for (const p of posts) {
    lines.push(`- [${p.company}] ${p.title}`);
    lines.push(`  - source: ${p.source}`);
    if (p.discoveryMode) lines.push(`  - discovery_mode: ${p.discoveryMode}`);
    if (p.identityHash) lines.push(`  - identity_hash: ${p.identityHash}`);
    lines.push(`  - link_type: ${p.linkType}`);
    lines.push(`  - posting_status: ${p.postingStatus}`);
    lines.push(`  - active_evidence: ${p.activeEvidence}`);
    if (p.openedAt) lines.push(`  - opened_at: ${p.openedAt}`);
    lines.push(`  - closes_at: ${p.closesAt}`);
    lines.push(`  - days_until_close: ${p.daysUntilClose}`);
    lines.push(`  - close_urgency: ${p.closeUrgency}`);
    lines.push(`  - tags: ${compactList(p.tags).join(", ")}`);
    if (p.summary) lines.push(`  - summary: ${compactText(p.summary, SUMMARY_TEXT_LIMIT)}`);
    if (p.skills.length > 0) lines.push(`  - skills: ${compactList(p.skills).join(", ")}`);
    if (p.careerUpsideHypothesis) {
      lines.push(`  - career_upside_hypothesis: ${compactText(p.careerUpsideHypothesis, 180)}`);
    }
    if (p.careerUpsideEvidence && p.careerUpsideEvidence.length > 0) {
      lines.push(`  - career_upside_evidence: ${compactList(p.careerUpsideEvidence, 4).join(" | ")}`);
    }
    if (p.careerUpsideRiskFlags && p.careerUpsideRiskFlags.length > 0) {
      lines.push(`  - career_upside_risk_flags: ${compactList(p.careerUpsideRiskFlags, 4).join(", ")}`);
    }
    if (p.dueTime) lines.push(`  - due: ${compactText(p.dueTime, 80)}`);
    if (p.mainTasks) lines.push(`  - main_tasks: ${compactText(p.mainTasks)}`);
    if (p.requirements) lines.push(`  - requirements: ${compactText(p.requirements)}`);
    if (p.preferred) lines.push(`  - preferred: ${compactText(p.preferred)}`);
    lines.push(`  - url: ${p.url}`);
  }

  const content = lines.join("\n").trimEnd() + "\n";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, "utf-8");
  console.log(`Wrote live posting snapshot: ${outPath} (${posts.length} postings)`);
}
