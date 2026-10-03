import { createHash } from "node:crypto";

// Same calculation as the laptop CLI (scripts/candidate-context/client.ts). It is rewritten here
// instead of imported because that module pulls in the token-file reader. Both sides must yield
// the same key so a save sent from either path replays the Backend's stored response;
// contract-parity.test.ts compares the headers.

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

export function idempotencyKey(prefix: string, value: unknown): string {
  return `${prefix}:${createHash("sha256").update(canonicalJson(value), "utf8").digest("hex")}`;
}
