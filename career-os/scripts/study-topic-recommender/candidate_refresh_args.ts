import { TRIGGER_KINDS, type TriggerKind } from "./candidate_refresh_schema.js";

export interface CandidateRefreshArgs {
  help: boolean;
  renderOnly: boolean;
  dryRun: boolean;
  proposalsPath: string | null;
  triggerKind: TriggerKind;
  triggerReason: string;
  context: string;
}

function requiredValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${option} 값이 필요하다.`);
  return value;
}

export function parseCandidateRefreshArgs(argv: string[]): CandidateRefreshArgs {
  const args = argv.slice(2);
  const result: CandidateRefreshArgs = {
    help: false,
    renderOnly: false,
    dryRun: false,
    proposalsPath: null,
    triggerKind: "on-demand",
    triggerReason: "manual invocation",
    context: "",
  };

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--render-only") result.renderOnly = true;
    else if (arg === "--dry-run") result.dryRun = true;
    else if (arg === "--proposals") result.proposalsPath = requiredValue(args, index++, arg);
    else if (arg === "--trigger-reason") result.triggerReason = requiredValue(args, index++, arg);
    else if (arg === "--context") result.context = requiredValue(args, index++, arg);
    else if (arg === "--trigger-kind") {
      const value = requiredValue(args, index++, arg);
      if (!TRIGGER_KINDS.includes(value as TriggerKind)) {
        throw new Error(`--trigger-kind는 ${TRIGGER_KINDS.join(", ")} 중 하나여야 한다.`);
      }
      result.triggerKind = value as TriggerKind;
    } else {
      throw new Error(`알 수 없는 옵션이다: ${arg}`);
    }
  }
  return result;
}

export function candidateRefreshHelp(): string {
  return [
    "사용법: bun scripts/study-topic-recommender/refresh_candidate_pool.ts [옵션]",
    "",
    "옵션:",
    "  --help                    도움말 출력",
    "  --render-only             기존 JSON에서 Markdown만 재생성",
    "  --dry-run                 설정 반영 없이 검증과 리포트 생성",
    "  --proposals <path|->      모델 proposal JSON 경로 또는 표준 입력",
    `  --trigger-kind <값>       ${TRIGGER_KINDS.join(" | ")}`,
    "  --trigger-reason <문장>   실행 사유",
    "  --context <문장>          공개 가능한 관심사 요약",
  ].join("\n");
}
