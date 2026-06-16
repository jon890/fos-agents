## ADR-031 — command-router 디렉터리 일괄 폐기 + invoke_claude_skills.ts + format_cost_summary.ts 폐기

**Status**: Accepted
**Date**: 2026-05-16

### 맥락

plan013~022 ([[ADR-002]]/026/027/028/029/030)로 모든 dispatcher case가 native skill로 흡수되어 폐기됐다. plan022 완료 시점에 `career-os/scripts/command-router/run_now.sh`의 case는 0개 도달. dispatcher 디렉터리 + SKILL.md 존재 의미 사라짐.

또 plan021/022 완료로 다음 ts lib들의 caller가 0건이 됨:
- `_shared/lib/invoke_claude_skills.ts` — 옛 caller (study_pack_publish.ts + run_position_recommendation.sh + run_foodville_coffeechat_prep.sh) 모두 폐기.
- `_shared/lib/format_cost_summary.ts` — command-router/run_now.sh가 유일 caller.

사용자 명시 흐름 ("command-router 폐기 후 불필요한 ts lib 제거")에 맞춰 둘을 한 plan으로 묶음.

### 결정

세 묶음 변경:

1. **command-router 디렉터리 일괄 폐기**:
   - `career-os/scripts/command-router/` (run_now.sh + setup_env.sh)
   - `career-os/.claude/skills/command-router/SKILL.md`
2. **_shared/lib ts 2개 폐기** (caller 0 도달):
   - `_shared/lib/invoke_claude_skills.ts`
   - `_shared/lib/format_cost_summary.ts`
   - `_shared/types/index.ts`에서 관련 타입 정리
3. **`career-os/scripts/_lib/` 5 파일 일괄 폐기** (plan013/021/022 cleanup 잔재):
   - `build_prompt.ts` — 옛 prompt 조립 (foodville runner가 마지막 caller, plan021 phase-03 폐기로 caller 0)
   - `extract_and_validate_study_pack.ts` — caller 0 (plan013 정리 누락)
   - `fos_study_git.ts` — `publish_job_analysis.sh`가 유일 caller (plan022 phase-03 폐기로 caller 0)
   - `resolve_study_pack_topic.ts` — caller 0
   - `study_pack_publish.ts` — caller 0
4. **5문서 + AGENTS.md 갱신**:
   - dispatcher 진입점 0 → native skill 진입점 단일화 표기
   - 외부 의존성 섹션에서 invoke_claude_skills + format_cost_summary 제거
   - track_task.sh는 *career-os에서 사용 0*이지만 apartment에서 사용 중 → ai-nodes 모노레포 레벨에서 유지 (워크스페이스 격리 원칙)

거절한 대안:
- command-router 빈 dispatcher 유지: case 0 도달 후 존재 가치 0. 폐기가 자연.
- ts lib 폐기를 plan024로 분리: 사용자 명시로 한 plan에 묶음 — 의존 caller 모두 동일 plan021/022에서 폐기됐기에 정합성 ↑.
- track_task.sh도 폐기: apartment에서 사용 중 — 워크스페이스 격리 위반. 유지.

### 결과

- career-os dispatcher 완전 폐기 → native skill 7개가 단일 진입점.
- _shared/lib 정리 (2 ts 폐기, 잔여 자산 — notify_discord.ts + extract_claude_result.ts + mvp_target_schema.ts).
- AGENTS.md "외부 의존성" 섹션 간소화.
- 단점: extract_claude_result.ts는 *apartment + stock-investment 5 caller*가 여전히 사용 — career-os 외부 워크스페이스라 본 plan 범위 외 (사용자 명시: 별도 워크스페이스 세션 + GitHub issue).

### 적용

`tasks/plan023-command-router-and-ts-lib-cleanup/`. depends_on: plan021 + plan022 (caller 폐기 선행). common-pitfalls 6-6 회피: 폐기 작업이라 draft 별도 파일 불필요 (Write 위장 위험 낮음).
