import { readFileSync, statSync } from "node:fs";
import { z } from "zod";

const environmentSchema = z
  .object({
    CAREER_RECOMMENDATION_DATABASE_URL: z.string().trim().min(1).optional(),
    DB_HOST: z.string().trim().min(1).optional(),
    DB_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    DB_NAME: z.string().trim().min(1).optional(),
    DB_USERNAME: z.string().trim().min(1).optional(),
    DB_PASSWORD: z.string().min(1).optional(),
    CAREER_RECOMMENDATION_API_TOKEN: z.string().min(32).optional(),
    CAREER_RECOMMENDATION_API_TOKEN_FILE: z.string().trim().min(1).optional(),
    API_HOST: z.string().trim().min(1).default("127.0.0.1"),
    API_PORT: z.coerce.number().int().min(1).max(65_535).default(4318),
    CAREER_RECOMMENDATION_MAX_BODY_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(16 * 1_024 * 1_024)
      .default(2 * 1_024 * 1_024),
  })
  .loose();

export type RecommendationApiConfig = {
  databaseUrl: string;
  apiToken: string;
  host: string;
  port: number;
  maxBodyBytes: number;
};

function tokenFromFile(path: string): string {
  const mode = statSync(path).mode & 0o777;
  if (mode !== 0o600) throw new Error("API token 파일 권한은 600이어야 합니다.");
  return readFileSync(path, "utf8").trim();
}

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): RecommendationApiConfig {
  const normalized = Object.fromEntries(
    Object.entries(environment).map(([key, value]) => [key, value === "" ? undefined : value]),
  );
  const parsed = environmentSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new Error("추천 API 환경 설정을 읽거나 검증할 수 없습니다.");
  }
  const values = parsed.data;
  const operationFields = [values.DB_HOST, values.DB_NAME, values.DB_USERNAME, values.DB_PASSWORD];
  const hasOperationalDatabase = operationFields.some(Boolean) || values.DB_PORT !== undefined;
  if (Boolean(values.CAREER_RECOMMENDATION_DATABASE_URL) === hasOperationalDatabase) {
    throw new Error("추천 API database 설정 형식을 하나만 사용해야 합니다.");
  }
  if (hasOperationalDatabase && operationFields.some((value) => !value)) {
    throw new Error("추천 API 운영 database 설정이 완전하지 않습니다.");
  }
  if (
    Boolean(values.CAREER_RECOMMENDATION_API_TOKEN) ===
    Boolean(values.CAREER_RECOMMENDATION_API_TOKEN_FILE)
  ) {
    throw new Error("추천 API token 설정 형식을 하나만 사용해야 합니다.");
  }
  let apiToken: string;
  try {
    apiToken =
      values.CAREER_RECOMMENDATION_API_TOKEN ??
      tokenFromFile(values.CAREER_RECOMMENDATION_API_TOKEN_FILE!);
  } catch {
    throw new Error("추천 API token 파일을 읽거나 검증할 수 없습니다.");
  }
  if (apiToken.length < 32) throw new Error("추천 API token을 읽거나 검증할 수 없습니다.");
  const databaseUrl =
    values.CAREER_RECOMMENDATION_DATABASE_URL ??
    `mysql://${encodeURIComponent(values.DB_USERNAME!)}:${encodeURIComponent(values.DB_PASSWORD!)}@${values.DB_HOST}:${values.DB_PORT ?? 3306}/${encodeURIComponent(values.DB_NAME!)}`;
  return {
    databaseUrl,
    apiToken,
    host: values.API_HOST,
    port: values.API_PORT,
    maxBodyBytes: values.CAREER_RECOMMENDATION_MAX_BODY_BYTES,
  };
}
