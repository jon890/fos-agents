import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** 전환 전 구현이 실제로 낸 값을 담은 포착 파일. 이 파일을 고쳐 테스트를 통과시키지 않는다. */
const capturePath = fileURLToPath(new URL("../fixtures/legacy-contract/cases.json", import.meta.url));

export type LegacyCase = {
  id: string;
  request: { method: string; path: string };
  response: {
    status: number;
    cacheControl: string;
    hasRequestId: boolean;
    body: unknown;
    volatileResponsePaths: string[];
  };
};

type Capture = { apiToken: string; maxBodyBytes: number; cases: LegacyCase[] };

const capture = JSON.parse(readFileSync(capturePath, "utf8")) as Capture;

export const legacyApiToken = capture.apiToken;
export const legacyMaxBodyBytes = capture.maxBodyBytes;

export function legacyCase(id: string): LegacyCase {
  const found = capture.cases.find((entry) => entry.id === id);
  if (!found) throw new Error(`포착 파일에 case 가 없다: ${id}`);
  return found;
}

export type LegacyErrorBody = { error: { code: string; message: string; requestId: string } };
