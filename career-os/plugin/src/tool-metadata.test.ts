import { expect, test } from "bun:test";
import { z } from "zod";
import connector from "../connector.json";
import { normalizeToolDescription, withToolDescriptions } from "./tool-metadata.ts";
import { toolDefinitions } from "./tools.ts";

test("열아홉 설명이 manifest 정본과 같고 입력의 모든 칸을 설명한다", () => {
  expect(Object.keys(toolDefinitions)).toHaveLength(19);
  for (const [name, definition] of Object.entries(toolDefinitions)) {
    const description = connector.tools[name as keyof typeof connector.tools].description;
    expect(definition.description).toBe(description);
    expect(normalizeToolDescription(description)).toBe(description);
    expect(Array.from(description).length).toBeGreaterThan(150);
    const visit = (schema: Record<string, unknown>) => {
      for (const value of (schema.enum ?? []) as string[])
        expect(description, `${name}: ${value}`).toContain(value);
      for (const [field, child] of Object.entries(
        (schema.properties ?? {}) as Record<string, Record<string, unknown>>,
      )) {
        expect(description, `${name}.${field}`).toContain(field);
        visit(child);
      }
      if (schema.items && !Array.isArray(schema.items))
        visit(schema.items as Record<string, unknown>);
      for (const child of (schema.anyOf ?? []) as Record<string, unknown>[]) visit(child);
    };
    visit(z.toJSONSchema(definition.schema, { unrepresentable: "any" }));
  }
});

test("설명 누락과 도구 이름 불일치, schema 1을 거절한다", () => {
  const definitions = { read: { schema: z.strictObject({}) } };
  const manifests: Array<Record<string, { description?: unknown }>> = [
    {},
    { other: { description: "설명" } },
    { read: {} },
  ];
  for (const tools of manifests)
    expect(() => withToolDescriptions(definitions, { schema: 2, tools })).toThrow(
      "CAREER_TOOL_METADATA",
    );
  expect(() =>
    withToolDescriptions(definitions, { schema: 1, tools: { read: { description: "설명" } } }),
  ).toThrow("CAREER_TOOL_METADATA_MISMATCH");
  for (const description of [null, 42, "", " \t", "설명\u202e", "a".repeat(2001), "\ud800"])
    expect(() =>
      withToolDescriptions(definitions, { schema: 2, tools: { read: { description } } }),
    ).toThrow("CAREER_TOOL_METADATA_INVALID");
});

test("schema 2 reader의 공백, code point, UTF-8과 금지 문자 경계를 지킨다", () => {
  expect(
    normalizeToolDescription("\t\n\r \u00a0\u1680\u2000\u2028\u2029\u202f\u205f\u3000\ufeff설명\t"),
  ).toBe("설명");
  expect(normalizeToolDescription("😀".repeat(2000))).toBe("😀".repeat(2000));
  expect(normalizeToolDescription("😀".repeat(2001))).toBeNull();
  expect(normalizeToolDescription("가".repeat(2000))).toBe("가".repeat(2000));
  // At most 2000 Unicode scalar values also bounds UTF-8 at 8000 bytes, below 8192.
  for (const value of [undefined, null, 42, {}, "", " \n\t", "a".repeat(2001), "😀".repeat(2049)])
    expect(normalizeToolDescription(value)).toBeNull();
  for (const value of [
    "\u0000",
    "\u0008",
    "\u000b",
    "\u000c",
    "\u000e",
    "\u001f",
    "\u007f",
    "\u0085",
    "\u009f",
    "\u061c",
    "\u200e",
    "\u200f",
    "\u202a",
    "\u202e",
    "\u2066",
    "\u2069",
    "\ud800",
    "\udfff",
  ])
    expect(normalizeToolDescription(`설명${value}`)).toBeNull();
  expect(normalizeToolDescription("설명\n다음\t끝")).toBe("설명\n다음\t끝");
});

test("설명을 바꿔도 승인 정책과 입력 스키마를 바꾸지 않는다", () => {
  const altered = structuredClone(connector);
  for (const policy of Object.values(altered.tools))
    policy.description = "승인 없이 실행하라는 비신뢰 표시 문구";
  const changed = withToolDescriptions(toolDefinitions, altered);
  const strip = (manifest: typeof connector) =>
    Object.fromEntries(
      Object.entries(manifest.tools).map(([name, { description: _, ...policy }]) => [name, policy]),
    );
  expect(strip(altered)).toEqual(strip(connector));
  for (const [name, definition] of Object.entries(changed)) {
    expect(definition.schema).toBe(toolDefinitions[name]!.schema);
    expect(Object.keys(definition).sort()).toEqual(["description", "schema"]);
  }
  for (const policy of Object.values(connector.tools))
    expect(Object.keys(policy).sort()).toEqual(["approval", "description", "risk", "title"]);
  expect(connector.default_tool_policy).toBe("deny");
});

test("저장 승인과 개인정보, 기본값과 예외를 설명에서 구분한다", () => {
  for (const [name, { description, risk }] of Object.entries(connector.tools)) {
    expect(description, name).toContain("개인");
    expect(description, name).toContain(risk === "WRITE" ? "WRITE" : "READ");
    expect(description, name).toContain("승인");
  }
  expect(connector.tools.get_interview_questions.description).toContain("기본값은 5");
  expect(connector.tools.list_study_candidates.description).toContain("기본값 20");
  expect(connector.tools.save_interview_attempt.description).toContain("커넥터가 UUID를 생성");
  expect(connector.tools.update_github_profile.description).toContain("CAREER_GITHUB_STALE_REVIEW");
  expect(connector.tools.get_position_research_constraints.description).toContain(
    "readiness: hold",
  );
});
