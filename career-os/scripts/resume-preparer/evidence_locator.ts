/**
 * 근거 locator 는 근거 파일 안에서 인용한 자리를 가리키는 값이다.
 *
 * 경로만 검사하면 파일은 있고 인용한 내용은 없는 원장도 통과한다.
 * 실측으로 한 원장이 후보자 인터뷰 파일을 138회 인용했는데 117건이 그 파일에 없었다.
 * 그래서 기계가 파일에서 찾을 수 있는 네 가지 형태로 좁힌다.
 *
 * | 형태 | 예 | 찾는 방법 |
 * | --- | --- | --- |
 * | `heading:<제목>` | `heading:경력 기간 계산 기준` | 마크다운 제목 줄의 글자에 그 문자열이 있는지 |
 * | `line:<번호>` | `line:42` | 그 줄이 있고 비어 있지 않은지 |
 * | `lines:<시작>-<끝>` | `lines:42-58` | 그 범위가 파일 안이고 비어 있지 않은지 |
 * | `quote:<문구>` | `quote:워커 RSS 가 누적됐다` | 본문에 그 문구가 그대로 있는지 |
 *
 * 제목과 문구는 공백을 하나로 줄여 비교하고 `*`, `` ` ``, `_` 는 지운 뒤 비교한다.
 */

export const EVIDENCE_LOCATOR_FORMS = ["heading", "line", "lines", "quote"] as const;

export const EVIDENCE_LOCATOR_FORMAT_HINT =
  "locator 는 `heading:<제목>`, `line:<번호>`, `lines:<시작>-<끝>`, `quote:<문구>` 중 하나여야 합니다.";

export type EvidenceLocator =
  | { form: "heading"; heading: string }
  | { form: "line"; start: number; end: number }
  | { form: "lines"; start: number; end: number }
  | { form: "quote"; quote: string };

export type EvidenceLocatorResolution =
  | { resolved: true }
  | { resolved: false; reason: string };

function normalizeText(value: string): string {
  return value.replace(/[*`_]/g, "").replace(/\s+/g, " ").trim();
}

export function parseEvidenceLocator(locator: string): EvidenceLocator | undefined {
  const separator = locator.indexOf(":");
  if (separator < 0) return undefined;
  const form = locator.slice(0, separator).trim();
  const value = locator.slice(separator + 1).trim();
  if (!value) return undefined;

  if (form === "heading") return { form: "heading", heading: value };
  if (form === "quote") return { form: "quote", quote: value };
  if (form === "line") {
    const line = Number(value);
    if (!Number.isInteger(line) || line < 1) return undefined;
    return { form: "line", start: line, end: line };
  }
  if (form === "lines") {
    const range = value.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!range) return undefined;
    const start = Number(range[1]);
    const end = Number(range[2]);
    if (start < 1 || end < start) return undefined;
    return { form: "lines", start, end };
  }
  return undefined;
}

export function resolveEvidenceLocator(source: string, locator: EvidenceLocator): EvidenceLocatorResolution {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  if (locator.form === "heading") {
    const wanted = normalizeText(locator.heading);
    const found = lines.some((line) => {
      const heading = line.match(/^\s{0,3}#{1,6}\s+(.+)$/);
      return heading ? normalizeText(heading[1]).includes(wanted) : false;
    });
    return found ? { resolved: true } : { resolved: false, reason: `근거 파일에 그 제목이 없습니다: ${locator.heading}` };
  }

  if (locator.form === "quote") {
    const found = normalizeText(source).includes(normalizeText(locator.quote));
    return found ? { resolved: true } : { resolved: false, reason: `근거 파일에 그 문구가 없습니다: ${locator.quote}` };
  }

  if (locator.end > lines.length) {
    return { resolved: false, reason: `근거 파일은 ${lines.length}줄인데 ${locator.end}줄을 가리킵니다.` };
  }
  const hasContent = lines.slice(locator.start - 1, locator.end).some((line) => line.trim());
  return hasContent
    ? { resolved: true }
    : { resolved: false, reason: `근거 파일의 ${locator.start}-${locator.end}줄이 비어 있습니다.` };
}
