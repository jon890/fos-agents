import { escapeHtml, renderMarkdown } from "./markdown.ts";
import type { MarkdownSection, RenderAssets } from "./types.ts";

/**
 * 할 일은 모델이 `status.md` 의 「다음 행동」에 쓴 것을 그대로 보여준다.
 * 화면이 문장을 지어내면 모델이 판단한 것과 다른 말이 상단에 남는다.
 * 검사기가 막은 것은 그 검사기의 문장을 덧붙인다.
 */
export function actionPanel(sections: readonly MarkdownSection[], assets: RenderAssets): string {
  const nextAction = sections.find((section) => section.title === "다음 행동");
  const blockers = [...new Set(assets.submissionBlockers ?? [])];
  if (!nextAction && blockers.length === 0) return "";

  const blockerList = blockers.length
    ? `<ul class="action-blockers">${blockers.map((blocker) => `<li>${escapeHtml(blocker)}</li>`).join("")}</ul>`
    : "";
  return `<section class="action-panel" aria-labelledby="action-panel-title">
    <div>
      <p class="eyebrow">NEXT ACTION</p>
      <h2 id="action-panel-title">다음 행동</h2>
    </div>
    <div>${nextAction ? renderMarkdown(nextAction.body) : ""}${blockerList}</div>
  </section>`;
}
