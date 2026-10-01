import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AccountbookClient, AccountbookError, configuredValue, type FetchLike } from "./client.ts";
import { AccountbookTools, toolDefinitions } from "./tools.ts";

export function createServer(
  env: Record<string, string | undefined> = process.env,
  fetchImpl: FetchLike = fetch,
) {
  const tools = new AccountbookTools(
    new AccountbookClient(
      {
        apiBaseUrl: configuredValue(env.ACCOUNTBOOK_API_BASE_URL) ?? "",
        apiToken: configuredValue(env.ACCOUNTBOOK_API_TOKEN) ?? "",
      },
      fetchImpl,
    ),
    configuredValue(env.ACCOUNTBOOK_FAMILY_UUID),
  );
  const server = new McpServer({ name: "fos-accountbook", version: "0.2.0" });
  for (const [name, definition] of Object.entries(toolDefinitions)) {
    server.registerTool(
      name,
      {
        description: definition.description,
        inputSchema: definition.schema,
        annotations: {
          readOnlyHint: /^(list|get|summarize|preview)_/.test(name),
          destructiveHint: /^(update|delete)_/.test(name),
          idempotentHint: /^(list|get|delete|summarize|preview)_/.test(name),
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
    process.stderr.write(
      `${error instanceof AccountbookError ? error.code : "ACCOUNTBOOK_MCP_START_FAILED"}\n`,
    );
    process.exitCode = 2;
  }
}
