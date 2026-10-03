import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CareerBackend, CareerError, configuredValue, type FetchLike } from "./backend.ts";
import { CareerTools, toolDefinitions } from "./tools.ts";

const profileRepoPattern = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

export function createServer(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
): McpServer {
  const baseUrl = configuredValue(env.CAREER_BACKEND_URL);
  const token = configuredValue(env.CAREER_BACKEND_TOKEN);
  const profileRepo = configuredValue(env.CAREER_GITHUB_PROFILE_REPO);
  if (!baseUrl || !token || !profileRepo || !profileRepoPattern.test(profileRepo))
    throw new CareerError("CAREER_CONFIG");
  // The GitHub token is optional; GitHub tools answer CAREER_GITHUB_NOT_CONFIGURED without it.
  const tools = new CareerTools(new CareerBackend({ baseUrl, token }, fetchImpl));
  const server = new McpServer({ name: "fos-career", version: "0.1.0" });
  for (const [name, definition] of Object.entries(toolDefinitions)) {
    server.registerTool(
      name,
      {
        description: definition.description,
        inputSchema: definition.schema,
        annotations: {
          readOnlyHint: /^(check|list|get)_/.test(name),
          destructiveHint: /^(save|update)_/.test(name),
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
