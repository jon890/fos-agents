import type { CandidateRefreshReport } from "../candidate_refresh_schema.js";

export function renderCandidateRefreshMarkdown(report: CandidateRefreshReport): string {
  const { generatedAt, trigger, inputs, proposals, decisions, applied } = report;
  const byDecision = (decision: string) => decisions.filter((item) => item.decision === decision);
  const newDecisions = byDecision("new");
  const updateDecisions = byDecision("update-existing");
  const confirmDecisions = byDecision("needs-confirmation");
  const skipDecisions = byDecision("skip");
  const proposalMap = new Map(proposals.map((proposal) => [proposal.key, proposal]));
  const lines = [
    "# 학습 후보 Refresh 결과",
    "",
    `생성: ${generatedAt}`,
    `트리거: ${trigger.kind} — ${trigger.reason}`,
    "",
    "## 입력 요약",
    "",
    `- fos-study 마크다운: ${inputs.fosStudyMarkdownCount}개`,
    `- 최근 히스토리: ${inputs.recentHistoryEntries}회`,
    `- 현재 active 후보: ${inputs.remainingNewCandidates}개`,
    ...(inputs.dominantRecentDomains.length > 0
      ? [`- 최근 반복 도메인: ${inputs.dominantRecentDomains.join(", ")}`]
      : []),
    "",
    "## 결정 요약",
    "",
    "| 분류 | 수 |",
    "|---|---|",
    `| new | ${newDecisions.length} |`,
    `| update-existing | ${updateDecisions.length} |`,
    `| needs-confirmation | ${confirmDecisions.length} |`,
    `| skip | ${skipDecisions.length} |`,
    "",
  ];

  if (applied.added.length || applied.updated.length || applied.staled.length) {
    lines.push("## 설정 반영 결과", "");
    if (applied.added.length) lines.push(`- 추가: ${applied.added.join(", ")}`);
    if (applied.updated.length) lines.push(`- 갱신: ${applied.updated.join(", ")}`);
    if (applied.staled.length) lines.push(`- stale 처리: ${applied.staled.join(", ")}`);
    lines.push("");
  }

  if (newDecisions.length) {
    lines.push("## 새 후보", "");
    for (const decision of newDecisions) {
      const proposal = proposalMap.get(decision.key);
      if (!proposal) continue;
      lines.push(
        `### ${proposal.title}`,
        `- key: \`${proposal.key}\``,
        `- domain: ${proposal.domain}`,
        `- tag: ${proposal.tag}`,
        `- 난이도: ${proposal.difficulty}`,
        `- 예상 시간: ${proposal.estMinutes}분`,
        ...(proposal.whyNow[0] ? [`- 이유: ${proposal.whyNow[0]}`] : []),
        ""
      );
    }
  }

  const appendMatched = (title: string, items: typeof decisions): void => {
    if (!items.length) return;
    lines.push(`## ${title}`, "");
    for (const decision of items) {
      const proposal = proposalMap.get(decision.key);
      lines.push(`- **${proposal?.title ?? decision.key}** — ${decision.reason}`);
      if (decision.matchedPath) lines.push(`  - 기존 파일: \`${decision.matchedPath}\``);
    }
    lines.push("");
  };
  appendMatched("확인 필요 후보", confirmDecisions);
  appendMatched("기존 문서 보강 후보", updateDecisions);
  appendMatched("제외 후보", skipDecisions);
  return `${lines.join("\n")}\n`;
}
