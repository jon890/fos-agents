import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { contextDocumentPath, type ContextDocumentKey } from "./context.ts";
import { closeCareerStores, openCareerStore, type CareerDatabase } from "./database.ts";

const roots: string[] = [];

/** 테스트마다 쓰는 임시 작업 폴더다. `cleanupCareerWorkspaces` 가 지운다. */
export function createCareerWorkspace(
  documents: Partial<Record<ContextDocumentKey, string>> = {},
): { root: string; environment: { CAREER_WORKSPACE_ROOT: string }; db: CareerDatabase } {
  const root = mkdtempSync(join(tmpdir(), "career-workspace-test-"));
  roots.push(root);
  for (const [key, body] of Object.entries(documents)) {
    writeContextDocument(root, key as ContextDocumentKey, body);
  }
  const environment = { CAREER_WORKSPACE_ROOT: root };
  return { root, environment, db: openCareerStore(environment) };
}

export function writeContextDocument(root: string, key: ContextDocumentKey, body: string): void {
  mkdirSync(join(root, "context"), { recursive: true });
  writeFileSync(contextDocumentPath(root, key), body);
}

export function cleanupCareerWorkspaces(): void {
  closeCareerStores();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
}
