import type { CollectorInput, CollectorResult, CompanyEvidenceCollector } from "./types.ts";

export async function collectCompanyEvidence(
  input: CollectorInput,
  collectors: readonly CompanyEvidenceCollector[],
): Promise<CollectorResult> {
  const result: CollectorResult = { evidence: [], diagnostics: [] };
  const today = input.now.toISOString().slice(0, 10);
  for (const collector of collectors) {
    if (!collector.enabled(input)) continue;
    if (
      !collector.refreshEveryRun &&
      collector.sourceTypes.every((sourceType) =>
        input.existingEvidence.some(
          (item) => item.sourceType === sourceType && item.validUntil >= today,
        ),
      )
    )
      continue;
    try {
      const collected = await collector.collect(input);
      result.evidence.push(...collected.evidence);
      result.diagnostics.push(...collected.diagnostics);
    } catch {
      // 외부 요청 오류에는 인증키가 들어간 URL이 포함될 수 있다.
      result.diagnostics.push(`${collector.name}: 수집 실패`);
    }
  }
  return result;
}
