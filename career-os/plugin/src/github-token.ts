import { z } from "zod";
import { CareerError, type CareerErrorCode, type FetchLike } from "./backend.ts";

const tokenSchema = z.object({ access_token: z.string().min(1) });

// The fos-assistant token channel (connector-oauth): 401 is a wrong or rotated marker, 404 a
// connection that is gone, 409 a connection that needs reconnecting, 503 a refresh that cannot run now.
function channelCode(status: number): CareerErrorCode {
  if (status === 401 || status === 409) return "CAREER_GITHUB_UNAUTHORIZED";
  if (status === 404) return "CAREER_GITHUB_NOT_CONFIGURED";
  return "CAREER_GITHUB_UNAVAILABLE";
}

/**
 * Returns a function that asks the token channel for the current GitHub token. A button connection
 * passes the channel address instead of a pasted token, and the token is fetched for every tool call
 * because fos-assistant refreshes it on its own schedule. The token and the address stay in memory:
 * they never reach a file, a log, a result, or an error message.
 */
export function channelToken(url: string, fetchImpl: FetchLike = fetch): () => Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new CareerError("CAREER_CONFIG");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new CareerError("CAREER_CONFIG");
  const address = parsed.toString();
  return async () => {
    let response: Response;
    try {
      response = await fetchImpl(address, {
        method: "GET",
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new CareerError("CAREER_GITHUB_UNAVAILABLE");
    }
    if (!response.ok) throw new CareerError(channelCode(response.status));
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new CareerError("CAREER_INVALID_RESPONSE");
    }
    const token = tokenSchema.safeParse(body);
    if (!token.success || !token.data.access_token.trim()) throw new CareerError("CAREER_INVALID_RESPONSE");
    return token.data.access_token.trim();
  };
}
