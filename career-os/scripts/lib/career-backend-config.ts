import { readFileSync, statSync } from "node:fs";
import { resolveAccessCredentials, type AccessCredentials } from "./access-credentials.ts";

export type CareerBackendConnection = { baseUrl: string; token: string; access?: AccessCredentials };

export function parseCareerBackendOrigin(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("CAREER_BACKEND_URL은 HTTP 또는 HTTPS origin이어야 한다.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "CAREER_BACKEND_URL은 credentials, query, hash, path 없는 HTTP 또는 HTTPS origin이어야 한다.",
    );
  }
  return url;
}

function validateToken(value: string): string {
  const token = value.trim();
  if (token.length < 32) throw new Error("커리어 Backend token은 trim 뒤 32자 이상이어야 한다.");
  return token;
}

export function resolveCareerBackendConnection(
  environment: Record<string, string | undefined> = process.env,
): CareerBackendConnection {
  const rawUrl = environment.CAREER_BACKEND_URL?.trim();
  if (!rawUrl) throw new Error("CAREER_BACKEND_URL 환경값이 필요하다.");
  const directToken = environment.CAREER_BACKEND_TOKEN;
  const tokenFile = environment.CAREER_BACKEND_TOKEN_FILE;
  if (Boolean(directToken?.trim()) === Boolean(tokenFile?.trim()))
    throw new Error("커리어 Backend token 또는 token 파일 중 정확히 하나가 필요하다.");
  const token = directToken?.trim()
    ? validateToken(directToken)
    : (() => {
        const path = tokenFile!.trim();
        if ((statSync(path).mode & 0o777) !== 0o600)
          throw new Error("커리어 Backend token 파일 권한은 0600이어야 한다.");
        return validateToken(readFileSync(path, "utf8"));
      })();
  const access = resolveAccessCredentials(environment, "CAREER_BACKEND");
  return { baseUrl: parseCareerBackendOrigin(rawUrl).toString(), token, ...(access ? { access } : {}) };
}
