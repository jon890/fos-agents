import { z } from "zod";
import { CareerBackend, CareerError, safeError } from "./backend.ts";

// Same keys as the Backend schemas; contract-parity.test.ts compares them with the CLI contracts.
export const contextDocumentKeys = [
  "learning-interests",
  "position-preferences",
  "application-state",
  "career-status",
] as const;
export const profileDocumentKeys = ["wanted", "linkedin", "github"] as const;

function documentSchemas<K extends readonly [string, ...string[]]>(keys: K) {
  const summary = z.object({
    documentKey: z.enum(keys),
    version: z.number().int().nonnegative(),
    updatedAt: z.string().min(1),
  });
  return {
    list: z.object({ documents: z.array(summary) }),
    get: z.object({ document: summary.extend({ body: z.string(), note: z.string() }) }),
  };
}

const contextSchemas = documentSchemas(contextDocumentKeys);
const profileSchemas = documentSchemas(profileDocumentKeys);

const usageSnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  claudeTokens: z.number(),
  codexTokens: z.number(),
  claudeCostUsd: z.number().nullable(),
  codexCostUsd: z.number().nullable(),
  sessions: z.number().nullable(),
  unpricedTokens: z.number(),
  measuredOn: z.string(),
  source: z.enum(["MEASURED", "BACKFILLED"]),
  note: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
const usageSnapshotListSchema = z.object({ snapshots: z.array(usageSnapshotSchema) });

export const toolDefinitions: Record<string, { description: string; schema: z.ZodType }> = {
  check_connection: {
    description: "커리어 Backend 에 연결되고 token 이 받아들여지는지 확인",
    schema: z.strictObject({}),
  },
  list_context_documents: {
    description: "후보자 맥락 문서의 키와 판, 수정 시각 목록",
    schema: z.strictObject({}),
  },
  get_context_document: {
    description: "후보자 맥락 문서 하나의 본문과 판 조회",
    schema: z.strictObject({ documentKey: z.enum(contextDocumentKeys) }),
  },
  list_profile_documents: {
    description: "프로필 원고(wanted, linkedin, github)의 키와 판, 수정 시각 목록",
    schema: z.strictObject({}),
  },
  get_profile_document: {
    description: "프로필 원고 하나의 본문과 판 조회",
    schema: z.strictObject({ documentKey: z.enum(profileDocumentKeys) }),
  },
  list_usage_snapshots: {
    description: "달별 에이전트 사용량 기록을 달 오름차순으로 조회",
    schema: z.strictObject({}),
  },
};

type ToolResult = {
  content: [{ type: "text"; text: string }];
  isError?: true;
  structuredContent?: Record<string, unknown>;
};

export class CareerTools {
  constructor(private readonly backend: CareerBackend) {}

  async call(name: string, raw: unknown): Promise<ToolResult> {
    try {
      if (!Object.hasOwn(toolDefinitions, name)) throw new CareerError("CAREER_UNKNOWN_TOOL");
      const parsed = toolDefinitions[name]!.schema.safeParse(raw);
      if (!parsed.success) throw new CareerError("CAREER_INVALID_INPUT");
      const args = parsed.data as { documentKey?: string };
      switch (name) {
        case "check_connection": {
          await this.backend.request("GET", "/api/profile/v1/documents", profileSchemas.list);
          const result = { backend: "ok" };
          return { ...this.success(result), structuredContent: result };
        }
        case "list_context_documents":
          return this.success(
            await this.backend.request("GET", "/api/candidate-context/v1/documents", contextSchemas.list),
          );
        case "get_context_document":
          return this.success(
            await this.backend.request(
              "GET",
              `/api/candidate-context/v1/documents/${args.documentKey}`,
              contextSchemas.get,
            ),
          );
        case "list_profile_documents":
          return this.success(
            await this.backend.request("GET", "/api/profile/v1/documents", profileSchemas.list),
          );
        case "get_profile_document":
          return this.success(
            await this.backend.request(
              "GET",
              `/api/profile/v1/documents/${args.documentKey}`,
              profileSchemas.get,
            ),
          );
        case "list_usage_snapshots":
          return this.success(
            await this.backend.request("GET", "/api/profile/v1/usage-snapshots", usageSnapshotListSchema),
          );
      }
      throw new CareerError("CAREER_UNKNOWN_TOOL");
    } catch (error) {
      const extra = error instanceof CareerError ? (error.details ?? {}) : {};
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ error: safeError(error), ...extra }) }],
      };
    }
  }

  private success(value: unknown): ToolResult {
    return { content: [{ type: "text", text: JSON.stringify(value) }] };
  }
}
