## ADR-031 — command-router 디렉터리 일괄 폐기 + invoke_claude_skills.ts + format_cost_summary.ts 폐기

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

plan013~022([[ADR-002]]/026~030)로 모든 dispatcher case가 native skill로 흡수되어 폐기됐다.
plan022 완료 시점에 `career-os/scripts/command-router/run_now.sh`의 case가 0개에 도달해 dispatcher 디렉터리의 존재 의미가 사라졌다.
같은 시점에 `_shared/lib/invoke_claude_skills.ts`와 `_shared/lib/format_cost_summary.ts`의 caller도 0건이 됐다.

### 결정

- command-router 디렉터리(`run_now.sh` + `setup_env.sh`)와 `command-router/SKILL.md`를 폐기한다.
- caller가 0건이 된 `_shared/lib/invoke_claude_skills.ts`, `_shared/lib/format_cost_summary.ts`를 폐기한다.
- plan013/021/022 cleanup 잔재인 `career-os/scripts/_lib/` 5개 파일을 함께 폐기한다.
- 5문서와 AGENTS.md에서 dispatcher 진입점과 폐기된 ts lib 참조를 제거한다.

거절한 대안:

- command-router 빈 dispatcher 유지: case 0 도달 후 존재 가치가 없어 폐기가 자연스럽다.
- ts lib 폐기를 별도 plan으로 분리: 의존 caller 모두 동일 plan에서 폐기됐으므로 한 plan으로 묶는 것이 정합성이 높다.
- track_task.sh도 폐기: apartment에서 사용 중이라 워크스페이스 격리 위반이 된다. 유지.

### 결과

- career-os dispatcher 완전 폐기 → native skill 7개가 단일 진입점이 됐다.
- `_shared/lib`에는 `notify_discord.ts`, `extract_claude_result.ts`, `mvp_target_schema.ts`만 남는다.
- 단점: `extract_claude_result.ts`는 apartment + stock-investment에서 여전히 사용 중이라 본 plan 범위 밖으로 별도 처리가 필요하다.
