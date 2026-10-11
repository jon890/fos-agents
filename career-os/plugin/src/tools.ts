import { z } from "zod";
import {
  formatBillions,
  readTokensBadge,
  renderUsageChart,
  selectUsageBars,
  type UsageTokens,
} from "../../scripts/agent-usage/chart.ts";
import { CareerBackend, CareerError, safeError } from "./backend.ts";
import type { GithubProfileRepo } from "./github.ts";
import { idempotencyKey } from "./idempotency.ts";
import { withToolDescriptions } from "./tool-metadata.ts";
import {
  attemptInputSchema,
  getInterviewQuestions,
  type AttemptInput,
  type GetInterviewQuestionsArgs,
  type ListPersonalQuestionsArgs,
  type PersonalQuestionInput,
  getInterviewQuestionsSchema,
  listPersonalQuestions,
  listPersonalQuestionsSchema,
  personalQuestionInputSchema,
  saveInterviewAttempt,
  savePersonalQuestion,
} from "./interview.ts";
import {
  checkPositionExclusions,
  checkPositionExclusionsSchema,
  getPositionResearchConstraints,
  getPositionResearchConstraintsSchema,
  type CheckPositionExclusionsArgs,
} from "./positions.ts";
import {
  getStudyCandidates,
  getStudyCandidatesSchema,
  listStudyCandidates,
  listStudyCandidatesSchema,
  saveStudyRecommendation,
  saveStudyRecommendationSchema,
  type GetStudyCandidatesArgs,
  type ListStudyCandidatesArgs,
  type SaveStudyRecommendationArgs,
} from "./study.ts";

// Same keys as the Backend schemas; contract-parity.test.ts compares them with the CLI contracts.
export const contextDocumentKeys = [
  "learning-interests",
  "position-preferences",
  "application-state",
  "career-status",
] as const;
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;

function documentSchemas<K extends readonly [string, ...string[]]>(keys: K) {
  const summary = z.object({
    documentKey: z.enum(keys),
    version: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  });
  return {
    list: z.object({ documents: z.array(summary) }),
    get: z.object({ document: summary.extend({ body: z.string(), note: z.string() }) }),
    // The Backend answers a save with the summary only, never the body.
    put: z.object({ document: summary }),
  };
}

// Same rules as the Backend's document PUT schema, so a rejected value never reaches fetch.
const maxBodyBytes = 65_536;
const nonBlankWithinLimit = z
  .string()
  .refine((value) => value.trim().length > 0)
  .refine((value) => new TextEncoder().encode(value).length <= maxBodyBytes);
function saveSchema<K extends readonly [string, ...string[]]>(keys: K) {
  return z.strictObject({
    documentKey: z.enum(keys),
    body: nonBlankWithinLimit,
    note: z.string().trim().min(1).max(500),
    expectedVersion: z.number().int().nonnegative(),
  });
}
type UpdateGithubProfileArgs = {
  readme: string;
  months: string[];
  expectedBranch: string;
  expectedHead: string;
};
type SaveArgs = { documentKey: string; body: string; note: string; expectedVersion: number };

const contextSchemas = documentSchemas(contextDocumentKeys);
const profileSchemas = documentSchemas(profileDocumentKeys);

const usageSnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  claudeTokens: z.number(),
  codexTokens: z.number(),
  claudeCostUsd: z.number().nullable(),
  codexCostUsd: z.number().nullable(),
  sessions: z.number().nullable(),
  unpricedTokens: z.number(),
  measuredOn: z.string(),
  source: z.enum(["MEASURED", "BACKFILLED"]),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const usageSnapshotListSchema = z.object({ snapshots: z.array(usageSnapshotSchema) });

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
// Numbers are never accepted: the strict object rejects total, tokens, svg and any other key,
// so the badge and chart can only come from the usage records (ADR-135).
const updateGithubProfileSchema = z.strictObject({
  readme: nonBlankWithinLimit,
  months: z
    .array(z.string().regex(monthPattern))
    .min(1)
    .max(6)
    .refine((months) => new Set(months).size === months.length),
  // The branch and head get_github_profile returned. They travel inside the stored approval args,
  // so an approval executed later still names the snapshot the user reviewed.
  expectedBranch: z.string().min(1).max(255),
  expectedHead: z.string().regex(/^[0-9a-f]{40}$/),
});

export const toolDefinitions: Record<string, { description: string; schema: z.ZodType }> =
  withToolDescriptions({
    check_connection: {
      schema: z.strictObject({}),
    },
    list_context_documents: {
      schema: z.strictObject({}),
    },
    get_context_document: {
      schema: z.strictObject({ documentKey: z.enum(contextDocumentKeys) }),
    },
    list_profile_documents: {
      schema: z.strictObject({}),
    },
    get_profile_document: {
      schema: z.strictObject({ documentKey: z.enum(profileDocumentKeys) }),
    },
    list_usage_snapshots: {
      schema: z.strictObject({}),
    },
    save_context_document: {
      schema: saveSchema(contextDocumentKeys),
    },
    save_profile_document: {
      schema: saveSchema(profileDocumentKeys),
    },
    get_github_profile: {
      schema: z.strictObject({}),
    },
    update_github_profile: {
      schema: updateGithubProfileSchema,
    },
    get_interview_questions: {
      schema: getInterviewQuestionsSchema,
    },
    list_personal_questions: {
      schema: listPersonalQuestionsSchema,
    },
    save_interview_attempt: {
      schema: attemptInputSchema,
    },
    save_personal_question: {
      schema: personalQuestionInputSchema,
    },
    get_study_candidates: {
      schema: getStudyCandidatesSchema,
    },
    save_study_recommendation: {
      schema: saveStudyRecommendationSchema,
    },
    list_study_candidates: {
      schema: listStudyCandidatesSchema,
    },
    get_position_research_constraints: {
      schema: getPositionResearchConstraintsSchema,
    },
    check_position_exclusions: {
      schema: checkPositionExclusionsSchema,
    },
  });

type ToolResult = {
  content: [{ type: "text"; text: string }];
  isError?: true;
  structuredContent?: Record<string, unknown>;
};

export class CareerTools {
  constructor(
    private readonly backend: CareerBackend,
    private readonly github?: GithubProfileRepo,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async call(name: string, raw: unknown): Promise<ToolResult> {
    try {
      if (!Object.hasOwn(toolDefinitions, name)) throw new CareerError("CAREER_UNKNOWN_TOOL");
      const parsed = toolDefinitions[name]!.schema.safeParse(raw);
      if (!parsed.success) throw new CareerError("CAREER_INVALID_INPUT");
      const args = parsed.data as { documentKey?: string };
      switch (name) {
        case "check_connection": {
          const backendCheck = this.backend.request(
            "GET",
            "/api/profile/v1/documents",
            profileSchemas.list,
          );
          await Promise.all([backendCheck, this.github?.check()]);
          const result = { backend: "ok", github: this.github ? "ok" : "not_configured" };
          return { ...this.success(result), structuredContent: result };
        }
        case "list_context_documents":
          return this.success(
            await this.backend.request(
              "GET",
              "/api/candidate-context/v1/documents",
              contextSchemas.list,
            ),
          );
        case "get_context_document":
          return this.success(
            await this.backend.request(
              "GET",
              `/api/candidate-context/v1/documents/${args.documentKey}`,
              contextSchemas.get,
            ),
          );
        case "list_profile_documents":
          return this.success(
            await this.backend.request("GET", "/api/profile/v1/documents", profileSchemas.list),
          );
        case "get_profile_document":
          return this.success(
            await this.backend.request(
              "GET",
              `/api/profile/v1/documents/${args.documentKey}`,
              profileSchemas.get,
            ),
          );
        case "list_usage_snapshots":
          return this.success(
            await this.backend.request(
              "GET",
              "/api/profile/v1/usage-snapshots",
              usageSnapshotListSchema,
            ),
          );
        case "save_context_document":
          return this.success(
            await this.save(
              "/api/candidate-context/v1",
              "candidate-context",
              contextSchemas.put,
              args as SaveArgs,
            ),
          );
        case "save_profile_document":
          return this.success(
            await this.save(
              "/api/profile/v1",
              "profile-document",
              profileSchemas.put,
              args as SaveArgs,
            ),
          );
        case "get_github_profile":
          return this.success(await this.requireGithub().read());
        case "update_github_profile":
          return this.success(await this.updateGithubProfile(args as UpdateGithubProfileArgs));
        case "get_interview_questions":
          return this.success(
            await getInterviewQuestions(
              this.backend,
              parsed.data as GetInterviewQuestionsArgs,
              this.now,
            ),
          );
        case "list_personal_questions":
          return this.success(
            await listPersonalQuestions(this.backend, parsed.data as ListPersonalQuestionsArgs),
          );
        case "save_interview_attempt":
          return this.success(
            await saveInterviewAttempt(this.backend, parsed.data as AttemptInput),
          );
        case "save_personal_question":
          return this.success(
            await savePersonalQuestion(this.backend, parsed.data as PersonalQuestionInput),
          );
        case "get_study_candidates":
          return this.success(
            await getStudyCandidates(this.backend, parsed.data as GetStudyCandidatesArgs),
          );
        case "save_study_recommendation":
          return this.success(
            await saveStudyRecommendation(
              this.backend,
              parsed.data as SaveStudyRecommendationArgs,
              this.now,
            ),
          );
        case "list_study_candidates":
          return this.success(
            await listStudyCandidates(this.backend, parsed.data as ListStudyCandidatesArgs),
          );
        case "get_position_research_constraints":
          return this.success(await getPositionResearchConstraints(this.backend));
        case "check_position_exclusions":
          return this.success(
            await checkPositionExclusions(
              this.backend,
              parsed.data as CheckPositionExclusionsArgs,
              this.now(),
            ),
          );
      }
      throw new CareerError("CAREER_UNKNOWN_TOOL");
    } catch (error) {
      const extra = error instanceof CareerError ? (error.details ?? {}) : {};
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: safeError(error), ...extra }) }],
      };
    }
  }

  private requireGithub(): GithubProfileRepo {
    if (!this.github) throw new CareerError("CAREER_GITHUB_NOT_CONFIGURED");
    return this.github;
  }

  // Every check runs before the first GitHub request, so a failed check writes nothing.
  private async updateGithubProfile({
    readme,
    months,
    expectedBranch,
    expectedHead,
  }: UpdateGithubProfileArgs) {
    const github = this.requireGithub();
    const { snapshots } = await this.backend.request(
      "GET",
      "/api/profile/v1/usage-snapshots",
      usageSnapshotListSchema,
    );
    const records: UsageTokens[] = snapshots.map(({ month, claudeTokens, codexTokens }) => ({
      month,
      claudeTokens,
      codexTokens,
    }));
    const { bars, totalTenths, missing } = selectUsageBars(records, months);
    if (missing.length > 0) throw new CareerError("CAREER_USAGE_MONTH_MISSING", { missing });
    if (Math.max(...bars.map((bar) => bar.claudeTenths + bar.codexTenths)) <= 0)
      throw new CareerError("CAREER_INVALID_INPUT");
    const expected = formatBillions(totalTenths);
    const found = readTokensBadge(readme);
    if (found !== expected) throw new CareerError("CAREER_BADGE_MISMATCH", { expected, found });
    const chart = renderUsageChart(bars);
    const barMonths = bars.map((bar) => bar.month);
    const first = barMonths[0]!;
    const last = barMonths[barMonths.length - 1]!;
    const range = first === last ? first : `${first}~${last}`;
    const commit = await github.commitProfile(
      { readme, chart },
      `docs: 프로필과 에이전트 사용량 차트를 갱신한다 (${range})`,
      { branch: expectedBranch, head: expectedHead },
    );
    return { ...commit, months: barMonths, total: expected };
  }

  // Sent once. When the outcome is unknown the caller gets CAREER_NETWORK and rereads the document.
  private save<T>(
    basePath: string,
    keyPrefix: string,
    schema: z.ZodType<T>,
    args: SaveArgs,
  ): Promise<T> {
    const { documentKey, body, note, expectedVersion } = args;
    return this.backend.request(
      "PUT",
      `${basePath}/documents/${documentKey}`,
      schema,
      { body, note, expectedVersion },
      idempotencyKey(keyPrefix, { documentKey, body, note, expectedVersion }),
    );
  }

  private success(value: unknown): ToolResult {
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
}
