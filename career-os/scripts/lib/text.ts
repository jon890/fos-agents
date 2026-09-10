/** 여러 수집기가 공유하는 공백 정규화다. `null`과 `undefined`는 빈 문자열로 다룬다. */
export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 대소문자를 구분하지 않고 부분 문자열 키워드가 하나라도 있는지 확인한다. */
export function containsKeyword(text: string, keywords: readonly string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

/** 외부 HTML 조각을 사람이 읽을 짧은 평문으로 바꾼다. */
export function cleanMarkupText(value: unknown, limit = 420): string {
  const decoded = normalizeText(value)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ");
  const cleaned = normalizeText(decoded);
  return cleaned.length > limit ? `${cleaned.slice(0, limit)}…` : cleaned;
}
