import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { CAREER_WORKSPACE_MANAGED_ROOTS, CareerWorkspaceReleaseManifestSchema, type CareerWorkspaceProducer } from "../contracts.ts";
import { buildWorkspaceDraft } from "../manifest.ts";
import { switchCurrentSymlink } from "../local-transport.ts";

export async function createManagedRoots(root: string): Promise<void> {
  for (const managedRoot of CAREER_WORKSPACE_MANAGED_ROOTS) {
    await mkdir(path.join(root, managedRoot), { recursive: true });
  }
}

export async function writeFixtureRelease(
  storageRoot: string,
  revision: string,
  producer: CareerWorkspaceProducer,
  files: Record<string, string>,
): Promise<void> {
  const releaseRoot = path.join(storageRoot, "releases", revision);
  await createManagedRoots(releaseRoot);
  for (const [relativePath, body] of Object.entries(files)) {
    const target = path.join(releaseRoot, relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }
  const draft = await buildWorkspaceDraft(releaseRoot, producer, { parentRevision: null });
  const manifest = CareerWorkspaceReleaseManifestSchema.parse({
    ...draft.manifest,
    revision,
    createdAt: "2026-08-28T00:00:00.000Z",
  });
  await writeFile(path.join(releaseRoot, "workspace-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await mkdir(storageRoot, { recursive: true });
  await switchCurrentSymlink(storageRoot, revision);
}
