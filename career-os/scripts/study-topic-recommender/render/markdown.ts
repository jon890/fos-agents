import type { MorningReadingReport, ReadingCareerValue, ReadingRecommendation } from "../reading_contracts.js";

const CAREER_VALUE_LABELS: Record<ReadingCareerValue, string> = {
  "current-work": "현재 업무 적용",
  "target-role": "목표 역할 준비",
  "engineering-judgment": "엔지니어링 판단",
  "product-business": "제품·사업 관점",
};

function renderItem(index: number, item: ReadingRecommendation): string[] {
  const lines = [
    `${index}. **${item.title}**`,
    `   - 출처: ${item.sourceName}`,
    `   - 종류: ${item.category}`,
    `   - 링크: ${item.url}`,
  ];
  if (item.published) lines.push(`   - 게시: ${item.published}`);
  lines.push(
    `   - 커리어 연결: ${CAREER_VALUE_LABELS[item.careerValue]}`,
    `   - 간단한 요약: ${item.summary}`,
    `   - 추천 이유: ${item.reason}`
  );
  return lines;
}

export function buildMorningMarkdown(report: MorningReadingReport): string {
  const lines: string[] = [
    "# 오늘 아침 공부 주제",
    "",
    "수집한 외부 자료 중 현재 업무와 다음 커리어에 적용할 판단이 있는 자료를 골랐다.",
    "",
  ];

  if (report.topics.length === 0) {
    lines.push("오늘 새로 추천할 만한 자료를 찾지 못했다.", "");
  } else {
    report.topics.forEach((topic) => {
      lines.push(`## ${topic.title}`, "", `**생각해 볼 질문:** ${topic.careerQuestion}`, "");
      topic.items.forEach((item, index) => lines.push(...renderItem(index + 1, item), ""));
    });
  }

  lines.push(
    "## 수집 상태",
    "",
    `- 활성 소스: ${report.counts.activeSources}개`,
    `- 자료를 수집한 소스: ${report.counts.sourcesWithCandidates}개`,
    `- 수집한 자료: ${report.counts.collectedArticles}개`,
    "",
    "추천은 이 실행에서 수집한 외부 자료만 사용했다."
  );
  return `${lines.join("\n")}\n`;
}
