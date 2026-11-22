import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CareerStoreError } from "./errors.ts";

/** 실행기가 읽는 맥락 문서의 키다. 파일 이름은 `<키>.md` 다. */
export type ContextDocumentKey = "position-preferences" | "application-state" | "learning-interests";

/** 에이전트가 실행 직전에 맥락 문서를 옮겨 쓰는 자리다. 실행기의 입력일 뿐 원본이 아니다. */
export function contextDocumentPath(root: string, key: ContextDocumentKey): string {
  return join(root, "context", `${key}.md`);
}

/** 옮겨 쓰며 생기는 차이(줄바꿈 종류, 줄끝 공백, 앞뒤 빈 줄)를 없앤다. */
export function normalizeContextBody(body: string): string {
  return body
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/**
 * 맥락 문서 본문에서 기준 버전을 낸다. 본문이 같으면 같은 값이라 분석과 판정을 다시 하지 않는다.
 * ADR-146 을 따른다.
 */
export function contextVersion(key: ContextDocumentKey, body: string): string {
  const digest = createHash("sha256").update(normalizeContextBody(body), "utf8").digest("hex");
  return `${key}:sha256:${digest}`;
}

export type ContextDocument = { key: ContextDocumentKey; body: string; version: string };

/** 문서가 없거나 비었으면 `409 CANDIDATE_CONTEXT_MISSING` 이다. 빈 기준으로 이어 가지 않는다. */
export function readContextDocument(root: string, key: ContextDocumentKey): ContextDocument {
  const file = contextDocumentPath(root, key);
  const body = existsSync(file) ? normalizeContextBody(readFileSync(file, "utf8")) : "";
  if (!body) {
    throw new CareerStoreError(
      409,
      "CANDIDATE_CONTEXT_MISSING",
      `${key} 후보자 맥락 문서가 없습니다. 본문을 작업 폴더의 context/${key}.md 에 쓴 뒤 다시 실행합니다.`,
    );
  }
  return { key, body, version: contextVersion(key, body) };
}
