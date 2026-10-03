import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const config = JSON.parse(readFileSync(join(import.meta.dir, "../.mcp.json"), "utf8"));

test(".mcp.json 은 mcpServers 래퍼 아래에 career 서버 하나를 둔다", () => {
  expect(Object.keys(config)).toEqual(["mcpServers"]);
  expect(Object.keys(config.mcpServers)).toEqual(["career"]);
  expect(config.mcpServers.career.command).toBe("bun");
  expect(config.mcpServers.career.args).toEqual(["${CLAUDE_PLUGIN_ROOT}/dist/career-mcp.js"]);
});

test(".mcp.json env 는 변수 참조 네 개만 담는다", () => {
  expect(config.mcpServers.career.env).toEqual({
    CAREER_BACKEND_URL: "${CAREER_BACKEND_URL}",
    CAREER_BACKEND_TOKEN: "${CAREER_BACKEND_TOKEN}",
    CAREER_GITHUB_TOKEN: "${CAREER_GITHUB_TOKEN:-}",
    CAREER_GITHUB_PROFILE_REPO: "${CAREER_GITHUB_PROFILE_REPO}",
  });
});
