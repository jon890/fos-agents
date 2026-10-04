import type { PackageStatus } from "./types.ts";

export function statusFrom(markdown: string): PackageStatus {
  return {
    readiness: (markdown.match(/^- readiness:\s*(ready|needs_user_input|revise|do_not_apply)\s*$/m)?.[1] ??
      null) as PackageStatus["readiness"],
    evidence: (markdown.match(/^- evidence:\s*(safe|revise|blocked)\s*$/m)?.[1] ??
      null) as PackageStatus["evidence"],
    humanConfirmation: (markdown.match(/^- human-confirmation:\s*(complete|needs_input)\s*$/m)?.[1] ??
      null) as PackageStatus["humanConfirmation"],
  };
}

export function documentTitle(markdown: string): string {
  return markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "지원 준비";
}
