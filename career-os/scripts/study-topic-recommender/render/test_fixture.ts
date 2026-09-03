import type { MorningReadingReport } from "../reading_contracts.js";

export const morningReadingReportFixture: MorningReadingReport = {
  generatedAt: "2026-08-11T15:30:00.000Z",
  sourceOfTruth: {
    config: "config/external-reading-sources.ts",
    collectedArticles: "state/reading-candidates.json",
  },
  counts: {
    activeSources: 2,
    sourcesWithCandidates: 1,
    collectedArticles: 8,
    techBlogSources: 1,
    geekSources: 0,
    aiSources: 0,
    videoSources: 1,
  },
  collectionLog: [],
  topics: [{
    topicKey: "operable-ai-products",
    title: "운영 가능한 AI 제품",
    careerQuestion: "현재 서비스의 장애 복구에 어떤 판단을 적용할 수 있는가?",
    items: [{
      contentKey: "url:safe",
      canonicalUrl: "https://example.com/article",
      sourceKey: "safe",
      sourceName: "공식 블로그",
      category: "techBlog",
      title: "관찰성 <script>alert(1)</script>",
      url: "https://example.com/article",
      published: "",
      summary: "운영 장애를 설명한다.",
      reason: "현재 운영 관점과 연결된다.",
      careerValue: "current-work",
    }],
  }],
};
