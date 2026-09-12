export const GROWTH_HEADING = "## 이 자리에서 얻을 경험과 성장";

/** 하위 절 다섯의 순서까지 계약이다. */
export const GROWTH_SUBHEADINGS = [
  "### 서비스가 커질 여지",
  "### 경쟁 서비스와 이 서비스의 위치",
  "### 경험할 수 있는 트래픽의 성격",
  "### 여기서 얻기 쉬운 것",
  "### 여기서 얻기 어려운 것",
] as const;

export const GROWTH_TRAFFIC_SUBHEADING = "### 경험할 수 있는 트래픽의 성격";
/** 트래픽 절은 쓰기와 읽기를 나눠 적는다. 두 값의 성격과 얻는 경험이 다르다. */
export const GROWTH_TRAFFIC_PARTS = ["쓰기", "읽기"] as const;

export type GrowthSection = {
  /** 하위 절 제목을 계약 순서대로 담는다. */
  subheadings: string[];
};

/** 절 본문만 잘라 낸다. 다음 `##` 제목이 경계다. */
function sectionLines(markdown: string): string[] | undefined {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim());
  const start = lines.indexOf(GROWTH_HEADING);
  if (start < 0) return undefined;
  const nextHeading = lines.findIndex((line, index) => index > start && /^#{1,2} /.test(line));
  return lines.slice(start + 1, nextHeading < 0 ? undefined : nextHeading);
}

/** 한 하위 절의 본문을 모은다. 다음 `###` 제목 앞까지다. */
function subsectionBody(section: readonly string[], subheading: string): string {
  const start = section.indexOf(subheading);
  const next = section.findIndex((line, index) => index > start && line.startsWith("### "));
  return section.slice(start + 1, next < 0 ? undefined : next).join("\n");
}

/**
 * 절이 없으면 `undefined`를 돌려준다.
 * 이 절이 생기기 전에 만든 지원 건을 소급해 고치지 않으려는 것이며, 절이 있으면 하위 절과 순서를 검사한다.
 */
export function parseGrowthSection(markdown: string): GrowthSection | undefined {
  const section = sectionLines(markdown);
  if (section === undefined) return undefined;

  const missing = GROWTH_SUBHEADINGS.filter((subheading) => !section.includes(subheading));
  if (missing.length > 0) {
    throw new Error(`${GROWTH_HEADING} 절에 하위 절이 빠졌습니다: ${missing.join(", ")}`);
  }

  const found = section.filter((line) => line.startsWith("### "));
  const unknown = found.filter((line) => !GROWTH_SUBHEADINGS.includes(line as (typeof GROWTH_SUBHEADINGS)[number]));
  if (unknown.length > 0) {
    throw new Error(`${GROWTH_HEADING} 절의 하위 절은 계약에 있는 다섯뿐입니다: ${unknown.join(", ")}`);
  }
  if (found.length !== GROWTH_SUBHEADINGS.length || found.some((line, index) => line !== GROWTH_SUBHEADINGS[index])) {
    throw new Error(`${GROWTH_HEADING} 절의 하위 절은 ${GROWTH_SUBHEADINGS.join(", ")} 순서여야 합니다: ${found.join(", ")}`);
  }

  for (const subheading of GROWTH_SUBHEADINGS) {
    if (!subsectionBody(section, subheading).trim()) {
      throw new Error(`${GROWTH_HEADING} 절의 하위 절이 비어 있습니다: ${subheading}`);
    }
  }

  const traffic = subsectionBody(section, GROWTH_TRAFFIC_SUBHEADING);
  const missingParts = GROWTH_TRAFFIC_PARTS.filter((part) => !traffic.includes(part));
  if (missingParts.length > 0) {
    throw new Error(
      `${GROWTH_TRAFFIC_SUBHEADING} 절은 쓰기와 읽기를 나눠 적어야 합니다: ${missingParts.join(", ")}가 없습니다.`,
    );
  }

  return { subheadings: found };
}
