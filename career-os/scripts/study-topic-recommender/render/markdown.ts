import type {
  BackendItem,
  Recommendation,
  UpdateExistingItem,
  MorningMarkdownStats,
} from "../transform/types.js";

export function renderBackendItem(idx: number, item: Recommendation): string[] {
  const tagLabel: Record<string, string> = {
    new: "신규",
    deepen: "심화",
    review: "복습",
    "live-coding": "live-coding",
  };
  const label = tagLabel[item.tag ?? "new"] ?? item.tag ?? "new";
  const [summary = "백엔드 실무와 면접 준비에 연결할 수 있는 학습 후보다.", ...reasons] =
    item.whyNow ?? [];
  const reason = reasons.length > 0
    ? reasons.join(" ")
    : "오늘의 학습 관심 축과 연결해 깊게 보기 좋다.";
  const lines = [
    `${idx}. **${label} 추천 — ${item.title}**`,
    `   - 분야: ${item.domain ?? "unknown"}`,
    `   - 난이도: ${item.difficulty ?? "중"}`,
    `   - 예상 학습 시간: ${item.estMinutes ?? 45}분`,
    `   - 간단한 요약: ${summary}`,
    `   - 추천 이유: ${reason}`,
  ];
  return lines;
}

export function renderSecondaryItem(
  idx: number,
  item: Recommendation,
  sourceField: string,
  sourceLabel = "출처"
): string[] {
  const source =
    (item[sourceField] as string | undefined) ||
    (item.source as string | undefined) ||
    (item.category as string | undefined) ||
    "";
  const article = item.discoveredArticle;

  if (article?.url) {
    const title = article.title || item.title || item.key || "제목 없음";
    const lines = [`${idx}. **${title}**`];
    if (source) lines.push(`   - ${sourceLabel}: ${source}`);
    lines.push(`   - 링크: ${article.url}`);
    if (article.published) lines.push(`   - 게시: ${article.published}`);
    if (item.tags && Array.isArray(item.tags))
      lines.push(`   - 태그: ${(item.tags as string[]).join(", ")}`);
    if (item.estMinutes) lines.push(`   - 예상 시간: ${item.estMinutes}분`);
    const [summary = "원문에서 실무 사례와 핵심 흐름을 확인할 수 있다.", ...reasons] =
      Array.isArray(item.whyNow) ? item.whyNow : [];
    lines.push(`   - 간단한 요약: ${summary}`);
    lines.push(`   - 추천 이유: ${reasons.join(" ") || "오늘의 관심 주제와 연결해 읽기 좋다."}`);
    return lines;
  }

  const lines = [`${idx}. **${item.title ?? item.key ?? "제목 없음"}**`];
  if (source) lines.push(`   - ${sourceLabel}: ${source}`);
  if (item.url) lines.push(`   - 링크: ${item.url}`);
  if (item.feedUrl) lines.push("   - 피드 후보를 가져오지 못해 출처 페이지로 표시한다.");
  if (item.tags && Array.isArray(item.tags))
    lines.push(`   - 태그: ${(item.tags as string[]).join(", ")}`);
  if (item.estMinutes) lines.push(`   - 예상 시간: ${item.estMinutes}분`);
  const [summary = "해당 출처에서 관련 기술 흐름을 확인할 수 있다.", ...reasons] =
    Array.isArray(item.whyNow) ? item.whyNow : [];
  lines.push(`   - 간단한 요약: ${summary}`);
  lines.push(`   - 추천 이유: ${reasons.join(" ") || "오늘의 관심 주제와 연결해 읽기 좋다."}`);
  return lines;
}

export function buildMorningMarkdown(
  backendRecommendations: BackendItem[],
  techBlogRecommendations: Recommendation[],
  aiRecommendations: Recommendation[],
  geekRecommendations: Recommendation[],
  updateExisting: UpdateExistingItem[],
  reviewStatus: string,
  stats: MorningMarkdownStats
): string {
  const lines: string[] = [
    "# 오늘 아침 읽을거리",
    "",
    "하루 학습을 시작할 때 읽고 생각할 주제를 카테고리별로 정리했다.",
    "",
  ];

  if (reviewStatus === "failed") {
    lines.push("> ⚠️ LLM duplicate review 실패 — 추천은 deterministic dedupe 기준입니다.", "");
  }

  lines.push(`## 회사·엔지니어링 기술 블로그 (${techBlogRecommendations.length})`, "");
  if (techBlogRecommendations.length > 0) {
    for (let i = 0; i < techBlogRecommendations.length; i++) {
      lines.push(
        ...renderSecondaryItem(i + 1, techBlogRecommendations[i], "source"),
        ""
      );
    }
  } else {
    lines.push("- (`config/external-reading-sources.json` techBlog 비어 있음)", "");
  }

  lines.push(`## GeekNews와 개발 동향 (${geekRecommendations.length})`, "");
  if (geekRecommendations.length > 0) {
    for (let i = 0; i < geekRecommendations.length; i++) {
      lines.push(
        ...renderSecondaryItem(i + 1, geekRecommendations[i], "source"),
        ""
      );
    }
  } else {
    lines.push("- (`config/external-reading-sources.json` geek 비어 있음)", "");
  }

  lines.push(`## AI 실전 읽을거리 (${aiRecommendations.length})`, "");
  if (aiRecommendations.length > 0) {
    for (let i = 0; i < aiRecommendations.length; i++) {
      lines.push(
        ...renderSecondaryItem(i + 1, aiRecommendations[i], "category", "분야"),
        ""
      );
    }
  } else {
    lines.push("- (`config/external-reading-sources.json` ai 비어 있음)", "");
  }

  lines.push(`## 에이전트가 제안한 백엔드 공부 후보 (${backendRecommendations.length})`, "");
  if (backendRecommendations.length > 0) {
    for (let i = 0; i < backendRecommendations.length; i++) {
      lines.push(...renderBackendItem(i + 1, backendRecommendations[i] as Recommendation), "");
    }
  } else {
    lines.push(
      '- (후보가 비어 있음 — `Use skill: /study-topic-recommender`로 보충)',
      ""
    );
  }

  lines.push(
    "",
    "## 기존 문서 보강 후보 (최대 5)",
    ""
  );
  if (reviewStatus === "failed") {
    lines.push("> ⚠️ LLM duplicate review 실패 — deterministic 중복 필터 결과만 반영했습니다.", "");
  }
  if (updateExisting.length === 0) {
    lines.push("- (보강 후보 없음 — 모든 추천은 새 study-pack 가능)", "");
  } else {
    for (let i = 0; i < updateExisting.length; i++) {
      const item = updateExisting[i];
      lines.push(
        `${i + 1}. **${item.candidatePath}**`,
        `   - 기존 문서: ${item.matchedPath}`,
        `   - 판단: ${item.decision} (${item.reason})`,
        "   - 추천 액션: 새 study-pack 생성 금지 → 기존 문서에 누락 항목 보강",
        ""
      );
    }
  }

  lines.push(
    "## 재고 메모",
    `- 신규 curated study topic 남음: ${stats.uncoveredCurated}개`,
    `- live-coding primary seed 남음: ${stats.remainingLive}개`,
    `- live-coding candidate seed 남음: ${stats.remainingLiveCandidates}개`,
    `- 활성 외부 소스: 기술 블로그 ${stats.techBlogItems}개, AI ${stats.aiTopicItems}개, 개발 동향 ${stats.geekNewsItems}개`,
    `- fos-study 스캔: ${stats.scannedMarkdownCount}개 .md 파일`,
    `- deterministic 중복 후보: ${stats.possibleDuplicates}개`,
    "",
    '백엔드 항목은 `Use skill: /study-pack-writer <key>`로 즉시 만들 수 있다.',
    "나머지 카테고리는 외부 reading 추천이라 별도 생성 단계 없이 그대로 학습한다."
  );

  return lines.join("\n") + "\n";
}
