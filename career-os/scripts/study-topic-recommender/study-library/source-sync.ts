import { externalReadingSources } from "../../../config/external-reading-sources.js";
import { parseReadingSourcesConfig } from "../reading_sources.js";
import {
  studyLibrarySourcePutPayloadSchema,
  type StudyLibrarySource,
  type StudyLibrarySourcePutPayload,
} from "./contracts.js";
import type { StudyLibraryClient } from "./client.js";

export interface SourceSyncRequest {
  sourceKey: string;
  body: StudyLibrarySourcePutPayload;
}

function sourceVersionByKey(sources: StudyLibrarySource[]): Map<string, number> {
  return new Map(sources.map((source) => [source.sourceKey, source.version]));
}

export function buildSourceSyncRequests(input: {
  config?: unknown;
  serverSources: StudyLibrarySource[];
}): SourceSyncRequest[] {
  const config = parseReadingSourcesConfig(input.config ?? externalReadingSources);
  const versions = sourceVersionByKey(input.serverSources);

  return config.sources.map((source) => {
    const body = studyLibrarySourcePutPayloadSchema.parse({
      title: source.title,
      category: source.category,
      url: source.url ?? null,
      feedUrl: source.feedUrl ?? null,
      adapter: source.adapter ?? "page",
      enabled: source.enabled ?? true,
      expectedVersion: versions.get(source.key) ?? 0,
    });
    return {
      sourceKey: source.key,
      body,
    };
  });
}

export async function syncStudyLibrarySources(client: StudyLibraryClient): Promise<SourceSyncRequest[]> {
  const serverSources = await client.getSources();
  const requests = buildSourceSyncRequests({ serverSources: serverSources.sources });
  for (const request of requests) {
    await client.putSource(request.sourceKey, request.body);
  }
  return requests;
}
