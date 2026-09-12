import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FIT_TAB_SECTION_TITLES,
  STRATEGY_TAB_SECTION_TITLES,
  TABS,
  TEMPLATE_DIRECTORY,
  TOP_SECTION_TITLES,
} from "./constants.ts";
import { demoteHeadings, escapeHtml, supportingSection } from "./markdown.ts";
import type { MarkdownSection, RenderAssets, TabKey } from "./types.ts";

export function readTemplate(name: string): string {
  return readFileSync(join(TEMPLATE_DIRECTORY, name), "utf8");
}

/** 치환 이름을 모두 채우고, 남은 이름이 있으면 그 이름을 담은 오류를 낸다. */
export function fillTemplate(template: string, values: Readonly<Record<string, string>>): string {
  const remaining = new Set<string>();
  // 콜백 반환값은 치환 패턴으로 해석되지 않으므로 본문의 달러 기호가 그대로 남는다.
  const filled = template.replace(/\{\{\s*([A-Z_]+)\s*\}\}/g, (match, name: string) => {
    if (Object.hasOwn(values, name)) return values[name];
    remaining.add(name);
    return match;
  });
  if (remaining.size > 0) {
    throw new Error(`템플릿에 채우지 못한 치환 이름이 남았습니다: ${[...remaining].join(", ")}`);
  }
  return filled;
}

function tabPanelBody(sections: readonly MarkdownSection[]): string {
  return sections.map((section) => supportingSection(section.title, section.body)).join("\n");
}

export function buildTabs(
  sections: readonly MarkdownSection[],
  interviewMarkdown: string,
  assets: RenderAssets,
  questionsMarkdown: string | undefined,
  postingMarkdown: string | undefined,
): { buttons: string; panels: string } {
  const byTitle = (title: string) => sections.find((section) => section.title === title);
  const fitSections = FIT_TAB_SECTION_TITLES.map(byTitle).filter((section) => section !== undefined);
  const strategySections = STRATEGY_TAB_SECTION_TITLES.map(byTitle).filter((section) => section !== undefined);
  const placed = new Set<string>([
    ...TOP_SECTION_TITLES,
    ...FIT_TAB_SECTION_TITLES,
    ...STRATEGY_TAB_SECTION_TITLES,
  ]);
  // 표에 없는 섹션은 화면에서 사라지지 않도록 지원 전략 탭 끝에 붙인다.
  const extraSections = sections.filter((section) => !placed.has(section.title));

  const bodies: Partial<Record<TabKey, string>> = {
    fit: tabPanelBody(fitSections),
    strategy: tabPanelBody([...strategySections, ...extraSections]),
    posting: postingMarkdown ? supportingSection("공고 원문", demoteHeadings(postingMarkdown)) : undefined,
    detail: detailTabBody(interviewMarkdown, assets, questionsMarkdown),
  };

  const activeTabs = TABS.filter((tab) => bodies[tab.key] !== undefined);
  const inputs = activeTabs
    .map((tab, index) =>
      `<input type="radio" name="tab" class="tab-input" id="tab-${tab.key}"${index === 0 ? " checked" : ""}>`,
    )
    .join("\n      ");
  const labels = activeTabs
    .map((tab) => `<label for="tab-${tab.key}">${escapeHtml(tab.label)}</label>`)
    .join("\n        ");
  const panels = activeTabs
    .map(
      (tab) => `<section class="tab-panel" id="panel-${tab.key}" aria-label="${escapeHtml(tab.label)}">
${bodies[tab.key]}
        </section>`,
    )
    .join("\n        ");

  return {
    buttons: `${inputs}
      <div class="tab-buttons">
        ${labels}
      </div>`,
    panels,
  };
}

function detailTabBody(
  interviewMarkdown: string,
  assets: RenderAssets,
  questionsMarkdown?: string,
): string {
  const individualPdfs = [
    assets.resumePdf ? '<a href="resume.pdf">이력서 PDF</a>' : "",
    assets.careerDescriptionPdf ? '<a href="career-description.pdf">경력기술서 PDF</a>' : "",
  ].filter(Boolean).join("");
  // 이력서 본문은 PDF 가 소유한다. 화면에 옮겨 적으면 둘이 어긋난 채 남는다.
  const sections = [
    questionsMarkdown ? supportingSection("포지션별 면접 질문", questionsMarkdown) : "",
    supportingSection("후보자 인터뷰 기록", interviewMarkdown),
  ].filter(Boolean).join("\n");

  return [
    individualPdfs ? `<nav class="secondary-files" aria-label="개별 제출 PDF">${individualPdfs}</nav>` : "",
    sections,
  ].filter(Boolean).join("\n");
}
