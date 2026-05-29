// _shared/types/index.ts
// ai-nodes 워크스페이스 공용 TS 타입 (ADR-019)

/**
 * study-pack-topics.json / question-bank-topics.json 의 단일 토픽 entry (ADR-027 분리 후).
 * namespace 별로 같은 형태.
 */
export interface TopicEntry {
  domain?: string;
  outputPath?: string;
  title?: string;
  promptAppend?: string;
  inputFiles?: string[];
  // 미래 확장 필드는 unknown
  [key: string]: unknown;
}
