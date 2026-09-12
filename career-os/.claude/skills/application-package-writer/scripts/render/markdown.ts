import { BARE_URL } from "./constants.ts";
import type { MarkdownSection } from "./types.ts";

export function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 표 셀 안의 줄바꿈은 `<br>` 로 적는다. 셀 안 개행이 먹히지 않는 렌더러가 있기 때문이다.
 * escape 뒤에 이 태그만 되살린다. 다른 태그는 이스케이프된 채로 둔다.
 */
function restoreLineBreaks(escaped: string): string {
  return escaped.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
}

/**
 * 이미 링크나 코드로 만들어진 구간은 건드리지 않고, 남은 맨 주소만 링크로 만든다.
 * `split` 의 캡처 그룹이 결과에 포함되므로 홀수 자리가 보호 구간이다.
 */
function autoLink(html: string): string {
  return html
    .split(/(<a\s[^>]*>[\s\S]*?<\/a>|<code>[\s\S]*?<\/code>)/g)
    .map((part, index) => (index % 2 === 1 ? part : part.replace(BARE_URL, '<a href="$&">$&</a>')))
    .join("");
}

function inlineMarkdown(text: string): string {
  const linked = restoreLineBreaks(escapeHtml(text))
    .replace(
      /\[([^\]]+)]\(((?:https?:\/\/|mailto:|(?:\.\.?\/)+|\/|#)[^\s)]+)\)/g,
      '<a href="$2">$1</a>',
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  return autoLink(linked);
}

function slug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "");
}

/**
 * 세 파일을 이어 붙여 읽으므로 다음 파일의 `h1` 도 절 경계다.
 * `h2` 만 경계로 보면 마지막 절이 다음 파일의 제목과 머리말을 함께 삼킨다.
 */
export function splitSections(markdown: string): MarkdownSection[] {
  const boundaries = [...markdown.matchAll(/^(#{1,2})\s+(.+)$/gm)];
  return boundaries.flatMap((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = boundaries[index + 1]?.index ?? markdown.length;
    if (match[1] !== "##") return [];
    return [{ title: match[2].trim(), body: markdown.slice(start, end).trim() }];
  });
}

function isTableDivider(line: string): boolean {
  const cells = line.trim().replace(/^\||\|$/g, "").split("|");
  return cells.length > 1 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
}

function tableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * `- ` 로 시작하는 항목을 `<br>` 로 이은 칸은 목록으로 그린다.
 * 근거가 여럿인 칸이 한 문단으로 붙어 있으면 어디까지가 한 근거인지 읽히지 않는다.
 */
function tableCell(cell: string): string {
  const items = cell.split(/<br\s*\/?>/i).map((part) => part.trim()).filter(Boolean);
  if (items.length < 2 || !items.every((item) => item.startsWith("- "))) return inlineMarkdown(cell);
  const rendered = items.map((item) => `<li>${inlineMarkdown(item.slice(2))}</li>`).join("");
  return `<ul class="cell-list">${rendered}</ul>`;
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const output: string[] = [];
  let list: "ul" | "ol" | null = null;

  const closeList = () => {
    if (list) output.push(`</${list}>`);
    list = null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].trimEnd();
    if (!line.trim()) {
      closeList();
      continue;
    }

    if (line.includes("|") && isTableDivider(lines[index + 1] ?? "")) {
      closeList();
      const headers = tableCells(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(tableCells(lines[index]));
        index += 1;
      }
      index -= 1;

      output.push("<div class=\"table-scroll\"><table><thead><tr>");
      for (const header of headers) output.push(`<th>${inlineMarkdown(header)}</th>`);
      output.push("</tr></thead><tbody>");
      for (const cells of rows) {
        output.push("<tr>");
        for (const cell of cells) output.push(`<td>${tableCell(cell)}</td>`);
        output.push("</tr>");
      }
      output.push("</tbody></table></div>");
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (list !== "ul") {
        closeList();
        list = "ul";
        output.push("<ul>");
      }
      output.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (list !== "ol") {
        closeList();
        list = "ol";
        output.push("<ol>");
      }
      output.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    closeList();
    if (line.startsWith("> ")) output.push(`<blockquote>${inlineMarkdown(line.slice(2))}</blockquote>`);
    else output.push(`<p>${inlineMarkdown(line.trim())}</p>`);
  }

  closeList();
  return output.join("\n");
}

/** 섹션 제목이 `h2`이므로 본문 제목을 한 단계 낮춰 단계가 뒤집히지 않게 한다. */
export function demoteHeadings(markdown: string): string {
  return markdown.replace(/^(#{1,3})(\s+)/gm, "#$1$2");
}

export function supportingSection(title: string, markdown: string): string {
  return `<section class="supporting-section" id="${slug(title)}">
    <h2>${escapeHtml(title)}</h2>
    ${renderMarkdown(markdown)}
  </section>`;
}
