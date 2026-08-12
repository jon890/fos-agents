import type { FosStudyInventoryItem } from "../fos_study_inventory.js";
import type { TopicItem } from "./types.js";

function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackKeyFromPath(path: string): string {
  const slug = path
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9가-힣]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return `fos-study-${slug}`;
}

export function buildFosStudyFallbackCandidates(items: FosStudyInventoryItem[]): TopicItem[] {
  return items
    .filter((item) => item.path.endsWith(".md"))
    .filter((item) => !item.path.startsWith("interview/"))
    .filter((item) => item.slug.toLowerCase() !== "readme")
    .map((item) => ({
      key: fallbackKeyFromPath(item.path),
      title: item.titleCandidate ?? titleFromSlug(item.slug),
      domain: item.domainCandidate ?? "fos-study",
      outputPath: item.path,
      source: "fos-study-derived",
      tag: "deepen",
      difficulty: "중",
      estMinutes: 35,
      whyNow: [
        "sources/fos-study에 이미 있는 학습 문서라서 보강이나 복습 출발점으로 쓸 수 있다",
        "설정 후보가 부족해도 실제 파일 목록을 바탕으로 예비 후보를 구성한다",
      ],
    }));
}
