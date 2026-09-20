import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("container는 8080 port와 root가 아닌 사용자, serve 기본 명령을 사용한다", () => {
  const dockerfile = readFileSync(resolve(import.meta.dir, "Dockerfile"), "utf8");
  expect(dockerfile).toContain("API_HOST=0.0.0.0");
  expect(dockerfile).toContain("API_PORT=8080");
  expect(dockerfile).not.toContain("CAREER_RECOMMENDATION_API_HOST");
  expect(dockerfile).not.toContain("CAREER_RECOMMENDATION_API_PORT");
  expect(dockerfile).toContain("EXPOSE 8080");
  expect(dockerfile).toContain("USER bun");
  expect(dockerfile).toContain(
    'ENTRYPOINT ["bun", "career-os/services/recommendation-api/container.ts"]',
  );
  expect(dockerfile).toContain('CMD ["serve"]');
});

test("runtime은 SQL repository와 receipt store, checksum readiness를 사용한다", () => {
  const server = readFileSync(resolve(import.meta.dir, "server.ts"), "utf8");
  expect(server).toContain("new SqlPositionRepository(sql)");
  expect(server).toContain("new SqlReceiptStore(sql)");
  expect(server).toContain("migrationStatus(");
  expect(server).not.toContain("MemoryPositionRepository");
  expect(server).not.toContain("MemoryReceiptStore");
});
