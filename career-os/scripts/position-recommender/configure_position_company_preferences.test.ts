import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { companyPreferenceUpdateSchema } from "../../services/recommendation-api/src/positions/schema.ts";
import { configurePositionCompanyPreferences } from "./configure_position_company_preferences.ts";

function temporaryInput(value: string): { directory: string; path: string } {
  const directory = mkdtempSync(join(tmpdir(), "position-company-preferences-"));
  const path = join(directory, "preferences.json");
  writeFileSync(path, value);
  return { directory, path };
}

test("회사 정책을 입력 순서대로 반영하고 같은 입력에는 같은 멱등 키를 쓴다", async () => {
  const temporary = temporaryInput(
    JSON.stringify({
      schemaVersion: 1,
      preferences: [
        { companyName: "  Acme   Labs ", tier: 1, disposition: "analyze" },
        { companyName: "제외 회사", tier: 3, disposition: "exclude" },
      ],
    }),
  );
  const calls: Array<{ companyKey: string; idempotencyKey: string }> = [];
  const createClient = () => ({
    async updateCompanyPreference(key: string, value: unknown, idempotencyKey: string) {
      const parsed = companyPreferenceUpdateSchema.parse(value);
      calls.push({ companyKey: key, idempotencyKey });
      return { ...parsed, updatedAt: "2026-09-17T00:00:00.000Z" };
    },
  });

  try {
    const first = await configurePositionCompanyPreferences(temporary.path, createClient);
    const second = await configurePositionCompanyPreferences(temporary.path, createClient);
    expect(first).toEqual({
      passed: true,
      appliedCount: 2,
      analyzedCount: 1,
      excludedCount: 1,
      tierCounts: { "1": 1, "2": 0, "3": 1 },
    });
    expect(second).toEqual(first);
    expect(calls.map((call) => call.companyKey)).toEqual([
      "acme labs",
      "제외 회사",
      "acme labs",
      "제외 회사",
    ]);
    expect(calls[2].idempotencyKey).toBe(calls[0].idempotencyKey);
    expect(calls[3].idempotencyKey).toBe(calls[1].idempotencyKey);
    expect(JSON.stringify(first)).not.toContain("Acme");
    expect(JSON.stringify(first)).not.toContain("제외 회사");
  } finally {
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test("잘못된 JSON과 정책 값은 client 생성과 네트워크 호출 전에 실패한다", async () => {
  const malformed = temporaryInput("{");
  const invalidTier = temporaryInput(
    JSON.stringify({
      schemaVersion: 1,
      preferences: [{ companyName: "회사", tier: 4, disposition: "analyze" }],
    }),
  );
  let clientCreations = 0;
  const createClient = () => {
    clientCreations += 1;
    return {
      async updateCompanyPreference() {
        throw new Error("호출되면 안 됩니다.");
      },
    };
  };

  try {
    await expect(
      configurePositionCompanyPreferences(malformed.path, createClient),
    ).rejects.toThrow();
    await expect(
      configurePositionCompanyPreferences(invalidTier.path, createClient),
    ).rejects.toThrow();
    expect(clientCreations).toBe(0);
  } finally {
    rmSync(malformed.directory, { recursive: true, force: true });
    rmSync(invalidTier.directory, { recursive: true, force: true });
  }
});
