import { createHash } from "node:crypto";
import { ApiError } from "./errors.ts";

export type StoredResponse = { status: number; body: unknown };
export type RequestReceipt = {
  requestHash: string;
  state: "processing" | "completed";
  response?: StoredResponse;
};

export interface ReceiptStore {
  getReceipt(key: string): Promise<RequestReceipt | undefined>;
  startReceipt(key: string, requestHash: string): Promise<boolean>;
  completeReceipt(key: string, requestHash: string, response: StoredResponse): Promise<void>;
  abandonReceipt(key: string, requestHash: string): Promise<void>;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function canonicalRequestHash(value: unknown): string {
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex")}`;
}

export async function idempotent<T extends StoredResponse>(
  store: ReceiptStore,
  key: string,
  body: unknown,
  action: () => Promise<T>,
): Promise<T> {
  const requestHash = canonicalRequestHash(body);
  const existing = await store.getReceipt(key);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "같은 멱등 키에 다른 요청 본문이 왔습니다.");
    }
    if (existing.state === "completed" && existing.response) return existing.response as T;
    throw new ApiError(409, "VERSION_CONFLICT", "같은 요청이 처리 중입니다.");
  }
  if (!(await store.startReceipt(key, requestHash))) {
    throw new ApiError(409, "VERSION_CONFLICT", "같은 요청이 처리 중입니다.");
  }
  try {
    const response = await action();
    await store.completeReceipt(key, requestHash, response);
    return response;
  } catch (error) {
    await store.abandonReceipt(key, requestHash);
    throw error;
  }
}

export class MemoryReceiptStore implements ReceiptStore {
  private readonly receipts = new Map<string, RequestReceipt>();

  async getReceipt(key: string): Promise<RequestReceipt | undefined> {
    return structuredClone(this.receipts.get(key));
  }

  async startReceipt(key: string, requestHash: string): Promise<boolean> {
    if (this.receipts.has(key)) return false;
    this.receipts.set(key, { requestHash, state: "processing" });
    return true;
  }

  async completeReceipt(key: string, requestHash: string, response: StoredResponse): Promise<void> {
    this.receipts.set(key, {
      requestHash,
      state: "completed",
      response: structuredClone(response),
    });
  }

  async abandonReceipt(key: string, requestHash: string): Promise<void> {
    if (this.receipts.get(key)?.requestHash === requestHash) this.receipts.delete(key);
  }
}
