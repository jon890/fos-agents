import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = JSON.parse(readFileSync(join(import.meta.dir, "../.mcp.json"), "utf8"));

test(".mcp.json 은 mcpServers 래퍼 아래에 accountbook 서버를 둔다", () => {
  expect(Object.keys(config)).toEqual(["mcpServers"]);
  expect(config.mcpServers.accountbook.command).toBe("bun");
  expect(config.mcpServers.accountbook.args).toEqual([
    "${CLAUDE_PLUGIN_ROOT}/dist/accountbook-mcp.js",
  ]);
});

test(".mcp.json env 는 변수 참조 네 개만 담는다", () => {
  expect(config.mcpServers.accountbook.env).toEqual({
    ACCOUNTBOOK_API_BASE_URL: "${ACCOUNTBOOK_API_BASE_URL}",
    ACCOUNTBOOK_API_TOKEN: "${ACCOUNTBOOK_API_TOKEN}",
    ACCOUNTBOOK_OUTPUT_DIR: "${ACCOUNTBOOK_OUTPUT_DIR}",
    ACCOUNTBOOK_FAMILY_UUID: "${ACCOUNTBOOK_FAMILY_UUID:-}",
  });
});
