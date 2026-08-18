import type {
  MorningReadingReport,
  ReadingRecommendation,
} from "../reading_contracts.js";

function renderItem(index: number, item: ReadingRecommendation): string[] {
  const lines = [
    `${index}. **${item.title}**`,
    `   - 출처: ${item.sourceName}`,
    `   - 링크: ${item.url}`,
  ];
  if (item.published) lines.push(`   - 게시: ${item.published}`);
  lines.push(
    `   - 간단한 요약: ${item.summary}`,
    `   - 추천 이유: ${item.reason}`
  );
  return lines;
}

function renderSection(
  title: string,
  items: ReadingRecommendation[]
): string[] {
  const lines = [`## ${title} (${items.length})`, ""];
  if (items.length === 0) {
    lines.push("이번 실행에서 추천할 글을 찾지 못했다.", "");
    return lines;
  }
  for (let index = 0; index < items.length; index++) {
    lines.push(...renderItem(index + 1, items[index]), "");
  }
  return lines;
}

export function buildMorningMarkdown(report: MorningReadingReport): string {
  const lines: string[] = [
    "# 오늘 아침 읽을거리",
    "",
    "등록된 외부 소스에서 수집한 글 가운데 오늘 읽을 자료를 골랐다.",
    "",
    ...renderSection("회사·엔지니어링 기술 블로그", report.recommendations.techBlog),
    ...renderSection("GeekNews와 엔지니어링 인사이트", report.recommendations.geek),
    ...renderSection("AI 공식 문서와 연구", report.recommendations.ai),
    ...renderSection("영상 추천", report.recommendations.video),
    "## 수집 상태",
    "",
    `- 활성 소스: ${report.counts.activeSources}개`,
    `- 글을 수집한 소스: ${report.counts.sourcesWithCandidates}개`,
    `- 수집한 글: ${report.counts.collectedArticles}개`,
    "",
    "추천은 이 실행에서 수집한 외부 글만 사용했다.",
  ];
  return `${lines.join("\n")}\n`;
}
