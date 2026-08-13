import { existsSync, readFileSync } from "node:fs";
import { z } from "zod";

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "소문자, 숫자, 하이픈만 사용할 수 있다.");

const date = z.iso.date();

const sourceSite = z.object({
  key: z.string().min(1),
  url: z.url().startsWith("https://"),
  label: z.string().min(1),
});

const interviewStage = z.looseObject({
  date: date.optional(),
  status: z.string().min(1).optional(),
  sites: z.array(sourceSite).optional(),
  source_dir: z.string().min(1).optional(),
  report_slug: slug.optional(),
});

export const currentTarget = z.object({
  company: z.string().min(1),
  team: z.string().min(1).optional(),
  role: z.string().min(1),
  company_slug: slug,
  position_slug: slug,
  data_root: z.string().regex(
    /^private\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "data_root는 private/<회사 식별자>/<포지션 식별자> 형식이어야 한다.",
  ),
  interview_date: date.optional(),
  position_focus: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  interview: z
    .object({
      first_round: interviewStage.nullable().optional(),
      final_round: interviewStage.nullable().optional(),
      offer_chat: interviewStage.nullable().optional(),
    })
    .optional(),
});

export const currentTargetFile = z.strictObject({
  primary: currentTarget,
});

export type CurrentTarget = z.infer<typeof currentTarget>;

export function loadCurrentTarget(filePath: string): CurrentTarget | null {
  if (!existsSync(filePath)) return null;

  const parsed = currentTargetFile.safeParse(JSON.parse(readFileSync(filePath, "utf8")));
  if (!parsed.success) {
    const details = z.prettifyError(parsed.error);
    throw new Error(`current-target.json 형식이 올바르지 않다.\n${details}`);
  }
  return parsed.data.primary;
}
