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

test(".mcp.json env 는 변수 참조만 담고 선택값은 빈 기본값을 둔다", () => {
  expect(config.mcpServers.career.env).toEqual({
    CAREER_BACKEND_URL: "${CAREER_BACKEND_URL}",
    CAREER_BACKEND_TOKEN: "${CAREER_BACKEND_TOKEN}",
    CAREER_GITHUB_TOKEN: "${CAREER_GITHUB_TOKEN:-}",
    CAREER_GITHUB_PROFILE_REPO: "${CAREER_GITHUB_PROFILE_REPO}",
  });
});

// fos-assistant drops a connector whose operator_env has no value in the operator list, and the home server
// reaches the Backend without Cloudflare Access. Claude Code passes its own environment to the server, so the
// laptop still gets the Access values without declaring them here (ADR-144).
test("Access service token 변수는 .mcp.json 에도 operator_env 에도 선언하지 않는다", () => {
  const connector = JSON.parse(readFileSync(join(import.meta.dir, "../connector.json"), "utf8"));
  for (const name of ["CAREER_BACKEND_ACCESS_CLIENT_ID", "CAREER_BACKEND_ACCESS_CLIENT_SECRET"]) {
    expect(Object.keys(config.mcpServers.career.env)).not.toContain(name);
    expect(connector.operator_env).not.toContain(name);
  }
});
