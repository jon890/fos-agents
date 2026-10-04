import { createHash } from "node:crypto";

export function normalizeClaimText(value: string): string {
  return value.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function claimKey(value: string): string {
  return createHash("sha256").update(normalizeClaimText(value)).digest("hex");
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
