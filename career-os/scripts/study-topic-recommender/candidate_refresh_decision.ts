import { deterministicDedupe, type DuplicateCandidateInput } from "./duplicate_detection.js";
import type {
  CandidateRefreshDecision,
  CandidateRefreshProposal,
} from "./candidate_refresh_schema.js";

export function buildCandidateRefreshDecisions(
  proposals: CandidateRefreshProposal[],
  fosStudyPaths: string[]
): CandidateRefreshDecision[] {
  const dedupeResult = deterministicDedupe(
    proposals.map((proposal): DuplicateCandidateInput => ({
      key: proposal.key,
      candidatePath: proposal.promotionTarget.outputPath,
    })),
    fosStudyPaths
  );
  const exact = new Map(dedupeResult.exactPathMatches.map((match) => [match.key, match]));
  const normalized = new Map(
    dedupeResult.normalizedPathMatches.map((match) => [match.key, match])
  );
  const possible = new Map(dedupeResult.possibleDuplicates.map((match) => [match.key, match]));

  return proposals.map((proposal) => {
    const candidatePath = proposal.promotionTarget.outputPath;
    const exactMatch = exact.get(proposal.key);
    if (exactMatch) return {
      key: proposal.key,
      decision: "update-existing",
      candidatePath,
      matchedPath: exactMatch.matchedPath,
      reason: "exact path already exists in fos-study",
    };
    const normalizedMatch = normalized.get(proposal.key);
    if (normalizedMatch) return {
      key: proposal.key,
      decision: "update-existing",
      candidatePath,
      matchedPath: normalizedMatch.matchedPath,
      reason: "normalized path already exists in fos-study",
    };
    const possibleMatch = possible.get(proposal.key);
    if (possibleMatch) return {
      key: proposal.key,
      decision: "needs-confirmation",
      candidatePath,
      matchedPath: possibleMatch.matchedPath,
      reason: possibleMatch.reason,
    };
    return {
      key: proposal.key,
      decision: "new",
      candidatePath,
      matchedPath: null,
      reason: "no existing fos-study file match",
    };
  });
}
