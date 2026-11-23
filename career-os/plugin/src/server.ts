import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CareerError, configuredValue, type FetchLike } from "./errors.ts";
import { browserEndpoint, relayBrowser } from "./browser/cdp.ts";
import { GithubProfileRepo } from "./github.ts";
import { channelToken } from "./github-token.ts";
import { CareerTools, toolDefinitions } from "./tools.ts";
import { WantedTools } from "./wanted/tools.ts";

const profileRepoPattern = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

export function createServer(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
): McpServer {
  const profileRepo = configuredValue(env.CAREER_GITHUB_PROFILE_REPO);
  if (!profileRepo || !profileRepoPattern.test(profileRepo)) throw new CareerError("CAREER_CONFIG");
  // GitHub is optional; GitHub tools answer CAREER_GITHUB_NOT_CONFIGURED without either value.
  // A button (OAuth) connection passes the token channel address, which wins over a pasted token.
  const githubTokenUrl = configuredValue(env.CAREER_GITHUB_TOKEN_URL);
  const githubToken = githubTokenUrl ? channelToken(githubTokenUrl, fetchImpl) : configuredValue(env.CAREER_GITHUB_TOKEN);
  const github = githubToken ? new GithubProfileRepo({ token: githubToken, repo: profileRepo }, fetchImpl) : undefined;
  // fos-assistant passes the owner's browser relay; without it the Wanted tools answer unreachable.
  const endpoint = browserEndpoint(env);
  const wanted = new WantedTools(endpoint ? relayBrowser(endpoint) : undefined);
  const tools = new CareerTools(github, wanted);
  const server = new McpServer({ name: "fos-career", version: "0.13.0" });
  for (const [name, definition] of Object.entries(toolDefinitions)) {
    server.registerTool(
      name,
      {
        description: definition.description,
        inputSchema: definition.schema,
        annotations: {
          readOnlyHint: /^(check|get)_/.test(name),
          destructiveHint: /^update_/.test(name),
          // Reads repeat safely and both updates replace values with the same ones.
          idempotentHint: true,
          openWorldHint: true,
        },
      },
      (args: unknown) => tools.call(name, args),
    );
  }
  return server;
}

if (import.meta.main) {
  try {
    await createServer().connect(new StdioServerTransport());
  } catch (error) {
    // Only a fixed diagnostic; never serialize an exception or environment.
    process.stderr.write(`${error instanceof CareerError ? error.code : "CAREER_MCP_START_FAILED"}\n`);
    process.exitCode = 2;
  }
}
