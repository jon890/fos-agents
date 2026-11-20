import { createHash } from "node:crypto";
import { z } from "zod";

// Pure logic for the Wanted resume: field ids, normalization and fingerprints, and tool input checks.
// Field ids follow the API order `careers[c].projects[p]`; the page is searched by title, never by index.

export const textParts = ["title", "description"] as const;
export const periodParts = ["start", "end"] as const;
export type ProjectPart = (typeof textParts)[number] | (typeof periodParts)[number];
export type ParsedField = { kind: "about" } | { kind: "project"; c: number; p: number; part: ProjectPart };

/** CRLF to LF and outer whitespace trimmed; the only normalization before comparing. */
export function normalizeText(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim();
}

/** "2026.1", "2026.01" or "2026-01" to "2026-01". Anything else is null. */
export function normalizeMonth(value: string): string | null {
  const match = /^(\d{4})[.-](\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${String(month).padStart(2, "0")}`;
}

/** First 16 hex digits of SHA-256 over the normalized value. */
export function fingerprint(value: string): string {
  return createHash("sha256").update(normalizeText(value)).digest("hex").slice(0, 16);
}

export function parseField(field: string): ParsedField | null {
  if (field === "about") return { kind: "about" };
  const match = /^project:(\d{1,3}):(\d{1,3}):(title|description|start|end)$/.exec(field);
  if (!match) return null;
  return { kind: "project", c: Number(match[1]), p: Number(match[2]), part: match[3] as ProjectPart };
}

export type WantedField = { field: string; label: string; value: string; fingerprint: string };
export type ProjectPeriod = { c: number; p: number; start: string; end: string } | null;

type ApiProject = { title?: unknown; description?: unknown };
type ApiCareer = { company_name?: unknown; company?: { name?: unknown }; projects?: unknown };
export type ResumeApi = { resume?: { about?: unknown; title?: unknown }; careers?: unknown; skills?: unknown; links?: unknown };

const text = (value: unknown) => (typeof value === "string" ? value : "");

export function careersOf(api: ResumeApi): { company: string; projects: { title: string; description: string }[] }[] {
  const careers = Array.isArray(api.careers) ? (api.careers as ApiCareer[]) : [];
  return careers.map((career, c) => ({
    // The company key is not documented; fall back to the career's position when neither candidate is there.
    company: text(career?.company_name) || text(career?.company?.name) || `경력 ${c + 1}`,
    projects: (Array.isArray(career?.projects) ? (career.projects as ApiProject[]) : []).map((project) => ({
      title: text(project?.title),
      description: text(project?.description),
    })),
  }));
}

const partLabel: Record<ProjectPart, string> = { title: "제목", description: "본문", start: "시작월", end: "종료월" };

export function projectLabel(company: string, title: string, part: ProjectPart): string {
  return `${company} / ${normalizeText(title) || "빈 항목"} / ${partLabel[part]}`;
}

function entry(field: string, label: string, value: string): WantedField {
  return { field, label, value, fingerprint: fingerprint(value) };
}

/**
 * The editable fields. `periods` is what the page showed per project, in API order;
 * a null entry means the project box was not found, so its months are reported as unreadable instead of empty.
 */
export function fieldsFromResume(
  api: ResumeApi,
  periods: ProjectPeriod[],
): { fields: WantedField[]; unreadable: string[] } {
  const fields = [entry("about", "간단 소개", text(api.resume?.about))];
  const unreadable: string[] = [];
  let index = 0;
  careersOf(api).forEach((career, c) =>
    career.projects.forEach((project, p) => {
      const period = periods[index++] ?? null;
      for (const part of textParts)
        fields.push(entry(`project:${c}:${p}:${part}`, projectLabel(career.company, project.title, part), project[part]));
      for (const part of periodParts) {
        const label = projectLabel(career.company, project.title, part);
        if (period) fields.push(entry(`project:${c}:${p}:${part}`, label, period[part]));
        else unreadable.push(label);
      }
    }),
  );
  return { fields, unreadable };
}

/** Skills, links and AI experience are read only; shape them as plain strings and skip what is not understood. */
export function outOfScopeFromResume(
  api: ResumeApi,
  ai: unknown,
): { skills: string[]; links: string[]; aiCompetencies: string[] } {
  const names = (list: unknown, keys: string[]) =>
    (Array.isArray(list) ? list : [])
      .map((item) => {
        if (typeof item === "string") return item;
        for (const key of keys) if (item && typeof item[key] === "string") return item[key] as string;
        return "";
      })
      .filter((value) => value.trim());
  return {
    skills: names(api.skills, ["name", "title", "text"]),
    links: names(api.links, ["url", "link", "title"]),
    aiCompetencies: names(ai, ["content", "description", "text", "title"]),
  };
}

export const getWantedResumeSchema = z.strictObject({
  resumeKey: z.string().trim().min(1).max(200).optional(),
});

const ARGUMENT_BYTE_LIMIT = 16_000;

const changeSchema = z
  .strictObject({
    field: z.string().refine((field) => parseField(field) !== null),
    label: z.string().trim().min(1).max(200),
    before: z.string().regex(/^[0-9a-f]{16}$/),
    value: z.string().max(16_000),
  })
  .superRefine((change, context) => {
    const parsed = parseField(change.field);
    if (!parsed) return;
    const period = parsed.kind === "project" && (parsed.part === "start" || parsed.part === "end");
    if (period ? normalizeMonth(change.value) === null : !normalizeText(change.value))
      context.addIssue({ code: "custom", path: ["value"], message: "invalid value" });
  });

export const updateWantedResumeSchema = z
  .strictObject({
    resumeKey: z.string().trim().min(1).max(200),
    resumeTitle: z.string().trim().min(1).max(100),
    changes: z.array(changeSchema).min(1).max(30),
  })
  .superRefine((args, context) => {
    const fields = args.changes.map((change) => change.field);
    if (new Set(fields).size !== fields.length)
      context.addIssue({ code: "custom", path: ["changes"], message: "duplicate field" });
    if (new TextEncoder().encode(JSON.stringify(args)).length > ARGUMENT_BYTE_LIMIT)
      context.addIssue({ code: "custom", path: ["changes"], message: "too large" });
  });

export type UpdateWantedResumeArgs = z.infer<typeof updateWantedResumeSchema>;
export type GetWantedResumeArgs = z.infer<typeof getWantedResumeSchema>;
