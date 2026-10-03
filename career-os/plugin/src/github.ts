import { z } from "zod";
import { CareerError, type CareerErrorCode, type FetchLike } from "./backend.ts";

const apiBase = "https://api.github.com";
const readmePath = "README.md";
const chartPath = "agent-usage.svg";

const repoSchema = z.object({ default_branch: z.string().min(1) });
const refSchema = z.object({ object: z.object({ sha: z.string().min(1) }) });
const commitSchema = z.object({ tree: z.object({ sha: z.string().min(1) }) });
const shaSchema = z.object({ sha: z.string().min(1) });
const contentSchema = z.object({ content: z.string(), encoding: z.literal("base64") });

type Step = {
  method: "GET" | "POST" | "PATCH";
  path: string;
  body?: unknown;
  // Moving the branch is the only step where 409 and 422 mean another commit landed first.
  movesBranch?: boolean;
  // Reading a file treats 404 as "the file is not there", not as a missing permission.
  missingIsAbsent?: boolean;
};

function statusCode(status: number, movesBranch: boolean): CareerErrorCode {
  if (status === 401) return "CAREER_GITHUB_UNAUTHORIZED";
  if (status === 409 || status === 422) return movesBranch ? "CAREER_GITHUB_CONFLICT" : "CAREER_GITHUB_UNAVAILABLE";
  if (status === 429 || status >= 500) return "CAREER_GITHUB_UNAVAILABLE";
  return "CAREER_GITHUB_FORBIDDEN";
}

function decodeBase64Utf8(content: string): string {
  try {
    const binary = atob(content.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CareerError("CAREER_INVALID_RESPONSE");
  }
}

/** The GitHub profile repository: reads README and chart, and writes both in one commit. */
export class GithubProfileRepo {
  private readonly token: string;
  private readonly repoPath: string;

  constructor(
    private readonly config: { token: string; repo: string },
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    this.token = config.token.trim();
    const [owner = "", name = ""] = config.repo.split("/");
    this.repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  }

  async check(): Promise<void> {
    await this.defaultBranch();
  }

  async read(): Promise<{ repo: string; branch: string; readme: string | null; chartExists: boolean }> {
    const branch = await this.defaultBranch();
    const readme = await this.send(this.contentsStep(readmePath, branch));
    const chart = await this.send(this.contentsStep(chartPath, branch));
    return {
      repo: this.config.repo,
      branch,
      readme: readme === null ? null : decodeBase64Utf8(this.parse(contentSchema, readme).content),
      chartExists: chart !== null,
    };
  }

  /**
   * Writes README and chart as one commit through the Git Data API, so the profile never shows one
   * file updated without the other. Each request is sent once and the branch moves without force.
   */
  async commitProfile(
    files: { readme: string; chart: string },
    message: string,
  ): Promise<{ changed: boolean; commitSha: string; branch: string }> {
    const branch = await this.defaultBranch();
    const ref = `heads/${branch.split("/").map(encodeURIComponent).join("/")}`;
    const head = this.parse(refSchema, await this.send({ method: "GET", path: `/git/ref/${ref}` })).object.sha;
    const baseTree = this.parse(commitSchema, await this.send({ method: "GET", path: `/git/commits/${head}` }))
      .tree.sha;
    const readmeBlob = await this.createSha("/git/blobs", { content: files.readme, encoding: "utf-8" });
    const chartBlob = await this.createSha("/git/blobs", { content: files.chart, encoding: "utf-8" });
    const tree = await this.createSha("/git/trees", {
      base_tree: baseTree,
      tree: [
        { path: readmePath, mode: "100644", type: "blob", sha: readmeBlob },
        { path: chartPath, mode: "100644", type: "blob", sha: chartBlob },
      ],
    });
    // Same tree as the branch head: the repository already holds this content, so no empty commit.
    if (tree === baseTree) return { changed: false, commitSha: head, branch };
    const commit = await this.createSha("/git/commits", { message, tree, parents: [head] });
    await this.send({ method: "PATCH", path: `/git/refs/${ref}`, body: { sha: commit, force: false }, movesBranch: true });
    return { changed: true, commitSha: commit, branch };
  }

  private async defaultBranch(): Promise<string> {
    return this.parse(repoSchema, await this.send({ method: "GET", path: "" })).default_branch;
  }

  private contentsStep(file: string, branch: string): Step {
    return { method: "GET", path: `/contents/${file}?ref=${encodeURIComponent(branch)}`, missingIsAbsent: true };
  }

  private async createSha(path: string, body: unknown): Promise<string> {
    return this.parse(shaSchema, await this.send({ method: "POST", path, body })).sha;
  }

  private parse<T>(schema: z.ZodType<T>, value: unknown): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) throw new CareerError("CAREER_INVALID_RESPONSE");
    return parsed.data;
  }

  /** Returns the JSON body, or null when a file read answered 404. */
  private async send(step: Step): Promise<unknown> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "fos-career-connector",
    };
    if (step.body !== undefined) headers["Content-Type"] = "application/json";
    // No retries and no redirects: a write must not be resent blindly, and the token belongs to
    // api.github.com only. Five seconds per request keeps a full update inside the 60 second budget.
    let response: Response;
    try {
      response = await this.fetchImpl(`${apiBase}${this.repoPath}${step.path}`, {
        method: step.method,
        headers,
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
        ...(step.body === undefined ? {} : { body: JSON.stringify(step.body) }),
      });
    } catch {
      throw new CareerError("CAREER_GITHUB_UNAVAILABLE");
    }
    if (step.missingIsAbsent && response.status === 404) return null;
    if (!response.ok) throw new CareerError(statusCode(response.status, step.movesBranch === true));
    if (step.method === "PATCH") return undefined;
    try {
      return await response.json();
    } catch {
      throw new CareerError("CAREER_INVALID_RESPONSE");
    }
  }
}
