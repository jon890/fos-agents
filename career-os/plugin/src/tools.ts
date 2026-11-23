import { z } from "zod";
import { CareerError, safeError } from "./errors.ts";
import type { GithubProfileRepo } from "./github.ts";
import { withToolDescriptions } from "./tool-metadata.ts";
import {
  getWantedResumeSchema,
  updateWantedResumeSchema,
  type GetWantedResumeArgs,
  type UpdateWantedResumeArgs,
} from "./wanted/fields.ts";
import { WantedTools } from "./wanted/tools.ts";

const maxBodyBytes = 65_536;
const nonBlankWithinLimit = z
  .string()
  .refine((value) => value.trim().length > 0)
  .refine((value) => new TextEncoder().encode(value).length <= maxBodyBytes);

type UpdateGithubProfileArgs = { readme: string; expectedBranch: string; expectedHead: string };

// README only. The strict object rejects months, chart and any other key: the usage chart and the
// Tokens badge left the profile when the usage records moved to a laptop file (ADR-147).
const updateGithubProfileSchema = z.strictObject({
  readme: nonBlankWithinLimit,
  // The branch and head get_github_profile returned. They travel inside the stored approval args,
  // so an approval executed later still names the snapshot the user reviewed.
  expectedBranch: z.string().min(1).max(255),
  expectedHead: z.string().regex(/^[0-9a-f]{40}$/),
});

// Every tool here reaches an outside site (GitHub, Wanted). Career data lives in the agent's work
// folder, which this server cannot reach, so those jobs are skills and the local runner (ADR-146).
export const toolDefinitions: Record<string, { description: string; schema: z.ZodType }> =
  withToolDescriptions({
    check_connection: {
      schema: z.strictObject({}),
    },
    get_github_profile: {
      schema: z.strictObject({}),
    },
    update_github_profile: {
      schema: updateGithubProfileSchema,
    },
    get_wanted_resume: {
      schema: getWantedResumeSchema,
    },
    update_wanted_resume: {
      schema: updateWantedResumeSchema,
    },
  });

type ToolResult = {
  content: [{ type: "text"; text: string }];
  isError?: true;
  structuredContent?: Record<string, unknown>;
};

export class CareerTools {
  constructor(
    private readonly github?: GithubProfileRepo,
    // Without a relay address both Wanted tools answer CAREER_BROWSER_UNREACHABLE.
    private readonly wanted: WantedTools = new WantedTools(undefined),
  ) {}

  async call(name: string, raw: unknown): Promise<ToolResult> {
    try {
      if (!Object.hasOwn(toolDefinitions, name)) throw new CareerError("CAREER_UNKNOWN_TOOL");
      const parsed = toolDefinitions[name]!.schema.safeParse(raw);
      if (!parsed.success) throw new CareerError("CAREER_INVALID_INPUT");
      switch (name) {
        case "check_connection": {
          // GitHub is optional, so a server without a token is still a working connection.
          await this.github?.check();
          const result = { github: this.github ? "ok" : "not_configured" };
          return { ...this.success(result), structuredContent: result };
        }
        case "get_github_profile":
          return this.success(await this.requireGithub().read());
        case "update_github_profile": {
          const { readme, expectedBranch, expectedHead } = parsed.data as UpdateGithubProfileArgs;
          return this.success(
            await this.requireGithub().commitProfile(readme, "docs: 프로필 README 를 갱신한다", {
              branch: expectedBranch,
              head: expectedHead,
            }),
          );
        }
        // A handoff or a stopped run is a normal result, never isError (fos-assistant ADR-20261111, ADR-092).
        case "get_wanted_resume":
          return this.success(await this.wanted.getResume(parsed.data as GetWantedResumeArgs));
        case "update_wanted_resume":
          return this.success(await this.wanted.updateResume(parsed.data as UpdateWantedResumeArgs));
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

  private success(value: unknown): ToolResult {
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
}
