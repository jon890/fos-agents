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
  const lines = [
    `${idx}. **${label} 추천 — ${item.title}**`,
    `   - 분야: ${item.domain ?? "unknown"}`,
    `   - 난이도: ${item.difficulty ?? "중"}`,
    `   - 예상 학습 시간: ${item.estMinutes ?? 45}분`,
    "   - 왜 지금 추천하는지",
  ];
  for (const reason of item.whyNow ?? []) {
    lines.push(`     - ${reason}`);
  }
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
    // ADR-013: 실 글 제목/URL을 1순위로 노출하고, 원본 reservoir 카드는 fallback 컨텍스트로만 둔다.
    const title = article.title || item.title || item.key || "제목 없음";
    const lines = [`${idx}. **${title}**`];
    if (source) lines.push(`   - ${sourceLabel}: ${source}`);
    lines.push(`   - 링크: ${article.url}`);
    if (article.published) lines.push(`   - 게시: ${article.published}`);
    if (item.tags && Array.isArray(item.tags))
      lines.push(`   - 태그: ${(item.tags as string[]).join(", ")}`);
    if (item.estMinutes) lines.push(`   - 예상 시간: ${item.estMinutes}분`);
    if (item.whyNow && Array.isArray(item.whyNow)) {
      lines.push("   - 왜 지금 보면 좋은지");
      for (const reason of item.whyNow as string[]) {
        lines.push(`     - ${reason}`);
      }
    }
    return lines;
  }

  const lines = [`${idx}. **${item.title ?? item.key ?? "제목 없음"}**`];
  if (source) lines.push(`   - ${sourceLabel}: ${source}`);
  if (item.url) lines.push(`   - 링크: ${item.url}`);
  if (item.feedUrl)
    lines.push(
      "   - (피드 fetch 실패 또는 매칭 글 없음 — reservoir 카드로 표시)"
    );
  if (item.tags && Array.isArray(item.tags))
    lines.push(`   - 태그: ${(item.tags as string[]).join(", ")}`);
  if (item.estMinutes) lines.push(`   - 예상 시간: ${item.estMinutes}분`);
  if (item.whyNow && Array.isArray(item.whyNow)) {
    lines.push("   - 왜 지금 보면 좋은지");
    for (const reason of item.whyNow as string[]) {
      lines.push(`     - ${reason}`);
    }
  }
  return lines;
}

export function buildMorningMarkdown(
  backendRecommendations: BackendItem[],
  techBlogRecommendations: Recommendation[],
  aiRecommendations: Recommendation[],
  geekRecommendations: Recommendation[],
  todayPick: { backend: BackendItem | null; techBlog: Recommendation | null; ai: Recommendation | null },
  updateExisting: UpdateExistingItem[],
  reviewStatus: string,
  stats: MorningMarkdownStats
): string {
  const lines: string[] = [
    "# 오늘의 학습/리딩 추천 (10픽 + 오늘의 3선)",
    "",
  ];

  if (reviewStatus === "failed") {
    lines.push("> ⚠️ LLM duplicate review 실패 — 추천은 deterministic dedupe 기준입니다.", "");
  }

  lines.push("## 백엔드 스터디 주제 (3)", "");
  if (backendRecommendations.length > 0) {
    for (let i = 0; i < backendRecommendations.length; i++) {
      lines.push(...renderBackendItem(i + 1, backendRecommendations[i] as Recommendation), "");
    }
  } else {
    lines.push(
      '- (reservoir 비어 있음 — `Use skill: /study-topic-recommender` 로 보충)',
      ""
    );
  }

  lines.push("## 회사·엔지니어링 기술 블로그 (3)", "");
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

  lines.push("## AI 관련 (3)", "");
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

  lines.push("## Geek/뉴스/산업 흐름 (1)", "");
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

  lines.push("## 오늘의 3선 (각 카테고리에서 1개씩)", "");
  const pickLabels: [string, BackendItem | Recommendation | null][] = [
    ["백엔드", todayPick.backend],
    ["기술 블로그", todayPick.techBlog],
    ["AI", todayPick.ai],
  ];
  for (const [label, pick] of pickLabels) {
    if (!pick) {
      lines.push(`- ${label}: (없음)`);
      continue;
    }
    const article = (pick as Recommendation).discoveredArticle;
    if (article?.url) {
      const title = article.title || pick.title || pick.key || "제목 없음";
      lines.push(`- **${label}**: ${title}`);
      lines.push(`  - ${article.url}`);
    } else {
      const title = pick.title || pick.key || "제목 없음";
      lines.push(`- **${label}**: ${title}`);
    }
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
    `- tech-blog reservoir: ${stats.techBlogItems}개 / AI reservoir: ${stats.aiTopicItems}개 / geek reservoir: ${stats.geekNewsItems}개`,
    `- fos-study 스캔: ${stats.scannedMarkdownCount}개 .md 파일`,
    `- deterministic 중복 후보: ${stats.possibleDuplicates}개`,
    "",
    '백엔드 항목은 `Use skill: /study-pack-writer <key>`로 즉시 만들 수 있다.',
    "나머지 카테고리는 외부 reading 추천이라 별도 생성 단계 없이 그대로 학습한다."
  );

  return lines.join("\n") + "\n";
}
