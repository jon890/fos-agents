# Phase 02 — active docs와 guide coffeechat cleanup

**Model**: sonnet
**Status**: completed

---

## 목표

현재 사용 진입점, 구조 설명, 데이터 스키마 설명, 실행 흐름, 가이드에서 coffeechat을 active workflow처럼 보이게 하는 문구를 제거한다.

과거 이력은 `docs/adr.md`와 task history에 남긴다.

## 실행 원칙

Phase 01 완료 뒤에만 실행한다.
같은 plan 안의 phase는 병렬 실행하지 않는다.

HUD는 구현 시작 시 `implementation running`, 보류 시 `implementation blocked`, 실패 시 `implementation failed`로 갱신한다.

## 범위

- `AGENTS.md`
- `TOOLS.md`
- `../AGENTS.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
- `docs/flow.md`
- `docs/prd.md`
- `config/candidate-profile.md`
- `.claude/skills/interview-prep-analyzer/SKILL.md`

## 비범위

- `docs/adr.md`의 과거 ADR 본문 수정 또는 삭제.
- `tasks/plan021-*`, `tasks/plan041-*`, `tasks/plan056-*` 수정 또는 삭제.
- skill/script 디렉터리 삭제.
- `config/mvp-target.json` 또는 schema code 수정.
- 오래된 data archive/report output 정리.
- fos-career 수정.
- commit, push, PR 생성.

## 작업 항목

1. Phase 01 inventory를 기준으로 active docs와 guide cleanup 대상만 고른다.
2. native skill 진입점 목록에서 `/interview-coffeechat-prep`를 제거한다.
3. active data/schema 설명에서 `primary.interview.coffeechat`을 현행 필드처럼 설명하지 않는다.
4. flow와 architecture에서 coffeechat runner, tombstone skill, script를 current path처럼 보이게 하는 문구를 제거한다.
5. coffeechat 요청은 자동화가 아니라 상황별 수동 준비 또는 `interview-prep-analyzer`의 stage 기반 준비와 분리된 예외 상황임을 필요한 곳에 짧게 남긴다.

## 검증 명령

```bash
cd "$(git rev-parse --show-toplevel)"

rg -n "interview-coffeechat-prep|primary\\.interview\\.coffeechat|coffeechat.*active|active.*coffeechat|coffeechat.*workflow|coffeechat.*runner|coffeechat.*skill" \
  career-os/AGENTS.md \
  career-os/TOOLS.md \
  AGENTS.md \
  career-os/docs/code-architecture.md \
  career-os/docs/data-schema.md \
  career-os/docs/flow.md \
  career-os/docs/prd.md \
  career-os/config/candidate-profile.md \
  career-os/.claude/skills/interview-prep-analyzer/SKILL.md

rg -n "coffeechat|coffee chat|interview-coffeechat-prep" \
  career-os/docs/adr.md \
  career-os/tasks/plan021-* \
  career-os/tasks/plan041-* \
  career-os/tasks/plan056-*

git -C career-os diff --check
git -C career-os status --short
```

첫 번째 `rg`는 active reference가 남았는지 확인하는 정책 grep이다.
남은 결과가 있다면 history-only 또는 안전 경고인지 phase 보고에 근거를 적는다.

## 성공 기준

- active guide에서 `/interview-coffeechat-prep` 진입점이 제거됐다.
- docs와 guide가 `first_round`, `final_round`, `offer_chat`만 현행 stage로 설명한다.
- `primary.interview.coffeechat`이 active schema 필드처럼 설명되지 않는다.
- 과거 ADR/task history는 그대로 남았다.
- docs cleanup이 code/config cleanup을 대신하지 않는다.

## common-pitfalls self-check

- `docs/adr.md`의 과거 ADR 본문을 정리 대상으로 삼지 않는다.
- history-only reference를 없애려고 task 기록을 수정하지 않는다.
- docs cleanup 중 code/config/schema를 함께 고치지 않는다.
- 한 문장 안에 긴 나열을 몰아넣지 않는다.

## PHASE_BLOCKED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `PHASE_BLOCKED: Phase 01 inventory is missing`
- `PHASE_BLOCKED: active guide cleanup conflicts with ADR-067`
- `PHASE_BLOCKED: docs require a new decision beyond ADR-067`
- `PHASE_BLOCKED: conflicting dirty changes in docs cleanup target`

## PHASE_FAILED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- `docs/adr.md`의 과거 ADR 본문을 삭제했다.
- 과거 task 기록을 삭제하거나 수정했다.
- skill/script/config/schema 구현 변경을 이 phase에서 수행했다.
- apartment repo 변경을 수정, stage, revert했다.
