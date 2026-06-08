# Phase 01 — active coffeechat inventory와 보존 경계 확정

**Model**: haiku
**Status**: completed

---

## 목표

ADR-067에 따라 제거할 active coffeechat reference를 inventory한다.

과거 ADR/task history와 오래된 archive/report output은 보존 대상으로 분리한다.

이 phase는 조사와 task 상태 정리에 한정하고 구현 파일을 수정하지 않는다.

## 실행 원칙

같은 plan 안의 phase는 순차 실행한다.
이 phase가 완료되기 전 Phase 02 이후를 병렬로 실행하지 않는다.

구현 시작 전 HUD를 `implementation running`으로 갱신한다.
HUD 갱신 실패는 phase 실패 사유가 아니지만 최종 보고에 남긴다.

## 범위

- `.claude/skills/interview-coffeechat-prep/`
- `scripts/interview-coffeechat-prep/`
- `config/mvp-target.json`의 `primary.interview.coffeechat`
- `scripts/interview-prep-analyzer/mvp_target_schema.ts`의 coffeechat compatibility
- `scripts/interview-prep-analyzer/collect_interview_sites.ts`의 active 또는 policy reference
- `AGENTS.md`, `TOOLS.md`, `../AGENTS.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/prd.md`
- `config/candidate-profile.md`
- `.claude/skills/interview-prep-analyzer/SKILL.md`

## 비범위

- 구현 코드, 설정, skill, script 삭제 또는 수정.
- `tasks/plan021-*`, `tasks/plan041-*`, `tasks/plan056-*` 삭제.
- `docs/adr.md`의 과거 ADR 본문 삭제.
- 오래된 `data/`, `private/`, `logs/` archive/report output 삭제.
- fos-career 수정.
- commit, push, PR 생성.

## 작업 항목

1. career-os와 ai-nodes root의 dirty state를 확인한다.
2. active 영역과 history 영역을 나누어 coffeechat reference를 `rg`로 수집한다.
3. 제거 대상, 보존 대상, 판단 보류 대상을 phase 보고에 정리한다.
4. `docs/adr.md`에 ADR-067이 있는지 확인하되 과거 ADR 본문은 수정하지 않는다.
5. 같은 파일의 dirty 변경 때문에 범위 구분이 어려우면 `PHASE_BLOCKED`로 중단한다.

## 검증 명령

```bash
cd "$(git rev-parse --show-toplevel)"
git -C career-os status --short

rg -n "coffeechat|coffee chat|interview-coffeechat-prep|primary\\.interview\\.coffeechat" \
  career-os/AGENTS.md \
  career-os/TOOLS.md \
  AGENTS.md \
  career-os/docs \
  career-os/config \
  career-os/scripts \
  career-os/.claude/skills \
  --glob '!career-os/docs/adr.md' \
  --glob '!career-os/tasks/**' \
  --glob '!career-os/data/**' \
  --glob '!career-os/private/**'

rg -n "ADR-067|coffeechat|coffee chat|interview-coffeechat-prep" \
  career-os/docs/adr.md \
  career-os/tasks/plan021-* \
  career-os/tasks/plan041-* \
  career-os/tasks/plan056-*
```

`rg`는 찾기 명령이다.
첫 번째 명령은 active cleanup 후보를 보여야 하고, 두 번째 명령은 history 보존 후보를 보여야 한다.

## 성공 기준

- active cleanup 후보 목록이 확인됐다.
- history 보존 후보가 별도로 확인됐다.
- `docs/adr.md`의 ADR-067 존재를 확인했다.
- 구현 파일은 수정하지 않았다.
- apartment 쪽 dirty 변경은 수정, stage, revert하지 않았다.

## common-pitfalls self-check

- phase 보고만 하고 active/history 구분 없이 넘어가지 않는다.
- 과거 ADR이나 task history를 제거 대상으로 분류하지 않는다.
- 오래된 data archive/report output을 이번 plan의 삭제 대상으로 넣지 않는다.
- 같은 plan의 phase를 병렬 실행하지 않는다.

## PHASE_BLOCKED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `PHASE_BLOCKED: ADR-067 is missing or inconsistent`
- `PHASE_BLOCKED: active and history coffeechat references cannot be separated`
- `PHASE_BLOCKED: conflicting dirty changes in coffeechat cleanup target`
- `PHASE_BLOCKED: docs contract needs update before implementation`

## PHASE_FAILED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- 구현 파일, 설정, skill, script를 수정했다.
- 과거 task 기록이나 과거 ADR 본문을 삭제했다.
- 오래된 data archive/report output을 삭제했다.
- apartment repo 변경을 수정, stage, revert했다.
