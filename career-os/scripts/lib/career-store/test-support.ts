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

let savedWorkspaceRoot: string | undefined | null = null;

/**
 * 임시 작업 폴더를 만들고 `process.env.CAREER_WORKSPACE_ROOT` 로 건다.
 * 환경에서 작업 폴더를 읽는 CLI 를 같은 프로세스에서 부르는 테스트가 쓴다.
 * `restoreCareerWorkspaceEnv` 가 원래 값으로 되돌리고 폴더를 지운다.
 */
export function useCareerWorkspaceEnv(
  documents: Partial<Record<ContextDocumentKey, string>> = {},
): string {
  if (savedWorkspaceRoot === null) savedWorkspaceRoot = process.env.CAREER_WORKSPACE_ROOT;
  const { root } = createCareerWorkspace(documents);
  process.env.CAREER_WORKSPACE_ROOT = root;
  return root;
}

export function restoreCareerWorkspaceEnv(): void {
  if (savedWorkspaceRoot !== null) {
    if (savedWorkspaceRoot === undefined) delete process.env.CAREER_WORKSPACE_ROOT;
    else process.env.CAREER_WORKSPACE_ROOT = savedWorkspaceRoot;
    savedWorkspaceRoot = null;
  }
  cleanupCareerWorkspaces();
}
