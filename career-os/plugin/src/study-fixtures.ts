// Shared by study.test.ts and contract-parity.test.ts. Not imported by the connector.

const hex = (seed: number) => seed.toString(16).padStart(2, "0").repeat(32);
export const urlKey = (seed: number) => `url:${hex(seed)}`;

// Every list at its count limit and every text field at its length limit, in Hangul (3 bytes each).
export function worstCaseRecommendation() {
  const hangul = (length: number) => "가".repeat(length);
  const topicKey = (index: number) => `${index}`.padEnd(80, "k");
  let seed = 0;
  return {
    candidateContextVersion: hangul(100),
    generatedAt: "2026-10-03T16:00:00.000Z",
    topics: [0, 1, 2, 3].map((topicIndex) => ({
      topicKey: topicKey(topicIndex),
      title: hangul(60),
      careerQuestion: hangul(100),
      items: [0, 1].map(() => ({
        contentKey: urlKey(++seed),
        summary: hangul(100),
        reason: hangul(100),
        careerValue: "engineering-judgment" as const,
      })),
    })),
    rejections: Array.from({ length: 20 }, () => ({ contentKey: urlKey(++seed), reason: hangul(50) })),
  };
}

