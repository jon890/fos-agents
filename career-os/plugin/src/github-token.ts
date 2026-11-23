import { z } from "zod";
import { CareerError, type CareerErrorCode, type FetchLike } from "./errors.ts";

const tokenSchema = z.object({ access_token: z.string().min(1) });

// The fos-assistant token channel (connector-oauth): 401 is a wrong or rotated marker, 404 a
// connection that is gone, 409 a connection that needs reconnecting, 503 a refresh that cannot run now.
function channelCode(status: number): CareerErrorCode {
  if (status === 401 || status === 409) return "CAREER_GITHUB_UNAUTHORIZED";
  if (status === 404) return "CAREER_GITHUB_NOT_CONFIGURED";
  return "CAREER_GITHUB_UNAVAILABLE";
}

function channelAddress(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns a function that asks the token channel for the current GitHub token. A button connection
 * passes the channel address instead of a pasted token, and the token is fetched for every tool call
 * because fos-assistant refreshes it on its own schedule. The token and the address stay in memory:
 * they never reach a file, a log, a result, or an error message.
 */
export function channelToken(url: string, fetchImpl: FetchLike = fetch): () => Promise<string> {
  const address = channelAddress(url);
  // GitHub is optional: a malformed address must not stop the Wanted tools, so only
  // the GitHub tools answer that GitHub is not set up.
  if (!address)
    return async () => {
      throw new CareerError("CAREER_GITHUB_NOT_CONFIGURED");
    };
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
    if (!response.ok) {
      // Release the connection without reading a body that might echo the marker.
      await response.body?.cancel().catch(() => undefined);
      throw new CareerError(channelCode(response.status));
    }
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
