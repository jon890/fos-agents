import { readFileSync, statSync } from "node:fs";

export type RecommendationApiConnection = { baseUrl: string; token: string };

export function parseRecommendationApiOrigin(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("CAREER_RECOMMENDATION_API_URL은 HTTP 또는 HTTPS origin이어야 한다."); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error("CAREER_RECOMMENDATION_API_URL은 credentials, query, hash, path 없는 HTTP 또는 HTTPS origin이어야 한다.");
  }
  return url;
}

function validateToken(value: string): string {
  const token = value.trim();
  if (token.length < 32) throw new Error("추천 API token은 trim 뒤 32자 이상이어야 한다.");
  return token;
}

export function resolveRecommendationApiConnection(environment: Record<string, string | undefined> = process.env): RecommendationApiConnection {
  const rawUrl = environment.CAREER_RECOMMENDATION_API_URL?.trim();
  if (!rawUrl) throw new Error("CAREER_RECOMMENDATION_API_URL 환경값이 필요하다.");
  const directToken = environment.CAREER_RECOMMENDATION_API_TOKEN;
  const tokenFile = environment.CAREER_RECOMMENDATION_API_TOKEN_FILE;
  if (Boolean(directToken?.trim()) === Boolean(tokenFile?.trim())) throw new Error("추천 API token 또는 token 파일 중 정확히 하나가 필요하다.");
  const token = directToken?.trim()
    ? validateToken(directToken)
    : (() => {
      const path = tokenFile!.trim();
      if ((statSync(path).mode & 0o777) !== 0o600) throw new Error("추천 API token 파일 권한은 0600이어야 한다.");
      return validateToken(readFileSync(path, "utf8"));
    })();
  return { baseUrl: parseRecommendationApiOrigin(rawUrl).toString(), token };
}
