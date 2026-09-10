export interface RenderAssets {
  templates: Record<string, string>;
  css: string;
  script: string;
}

type TextSlots = Record<string, string | number>;
type RawSlots = Record<string, string>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** raw에는 저장소 템플릿으로 조립한 HTML과 전용 CSS·JS만 전달한다. */
export function fillTemplate(template: string, text: TextSlots = {}, raw: RawSlots = {}): string {
  for (const key of Object.keys(text)) {
    if (Object.hasOwn(raw, key)) throw new Error(`Duplicate template placeholder: {{${key}}}`);
  }
  return template.replace(/\{\{([^{}]+)\}\}/g, (_match, key: string) => {
    if (Object.hasOwn(text, key) && text[key] !== undefined) return escapeHtml(String(text[key]));
    if (Object.hasOwn(raw, key) && typeof raw[key] === "string") return raw[key];
    throw new Error(`Unknown template placeholder or missing value: {{${key}}}`);
  });
}

export function fragment(
  assets: RenderAssets,
  name: string,
  text: TextSlots = {},
  raw: RawSlots = {},
): string {
  if (!Object.hasOwn(assets.templates, name) || typeof assets.templates[name] !== "string") {
    throw new Error(`Missing template: ${name}`);
  }
  return fillTemplate(assets.templates[name], text, raw);
}
