# Phase 01. cron 이 스킬 문서를 저장소 루트에서 읽게 한다

**Execution profile**: standard

## 목표

홈서버 hermes cron 이 `position-recommender` 와 `study-topic-recommender` 를 돌릴 때
옛 파일 동기화를 밟지 않고, 스킬의 참고 문서를 찾게 한다.

**범위 외**: 이관이 끝난 옛 파일의 삭제. 운영 이관을 확인한 뒤 따로 한다.
`config/external-reading-sources.ts` 와 `state/` 의 이력과 회사 조사와 제외 규칙이 그것이다.
지금 지우면 홈서버 작업본이 main 을 따라 갱신되면서 이관 원본이 사라진다.

## 컨텍스트

2026-09-25 07:30 의 두 cron 이 실패했다. hermes 로그의 `cron_cc35fce3b8c3_20260925` 가 공부 추천이다.

- 모델이 `references/execution.md`, `references/source-management.md`, `docs/flow.md` 를 그 경로 그대로 읽으려다 `File not found` 를 받았다
- 이어서 옛 `career-workspace prepare` 를 돌려 `WORKSPACE_DIRTY` 로 멈췄다

hermes 는 `/opt/data/config.yaml` 의 `cwd: /home/bifos/fos-agents` 에서 돈다. 저장소 루트다.
스킬 문서의 링크는 `SKILL.md` 가 있는 디렉터리 기준 상대 경로라, 저장소 루트에서 그대로 읽으면 없다.
career-os 스킬 여섯의 `SKILL.md` 에 이런 링크가 42곳 있다.

옛 동기화를 공부 추천의 절차로 적은 곳이 하나 남아 있다.
`career-os/docs/flow.md` 의 「비공개 작업본 동기화」 절 첫 문장이
`application-package-writer`, `resume-preparer`, `interview-practice` 와 `study-topic-recommender` 가
공통 CLI 로 준비와 반영 절차를 실행한다고 적는다.
공부 추천의 장기 추천 상태는 이제 Backend 에서 읽고 쓴다.

**근거 문서**: `docs/flow.md` 의 「비공개 작업본 동기화」 절과 「study-topic-recommender」 절,
`docs/adr/ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md`

## 의도 메모

**링크 42곳을 모두 바꾸지 않는다.**
Claude Code 는 링크를 `SKILL.md` 기준으로 풀어서 지금 형식이 맞다.
cron 을 도는 두 스킬에 스킬 폴더의 저장소 루트 기준 위치를 한 줄 적는 것으로 둘 다 풀린다.

**다른 네 스킬은 손대지 않는다.** 홈서버 cron 이 부르지 않는다.
hermes 의 cron 목록에 career-os 스킬은 `position-recommender` 와 `study-topic-recommender` 둘뿐이다.

## 작업 항목

### 1. 두 `SKILL.md` 에 스킬 폴더의 위치를 적는다

`career-os/.claude/skills/position-recommender/SKILL.md` 와
`career-os/.claude/skills/study-topic-recommender/SKILL.md` 의 첫 절 앞에 넣는다.

- 이 스킬의 파일은 저장소 루트 기준 `career-os/.claude/skills/<스킬 이름>/` 아래에 있다
- 이 문서가 `references/…` 라고 적으면 그 아래 경로다
- 명령은 저장소 루트에서 실행한다
- `docs/…` 는 `career-os/docs/…` 다

`study-topic-recommender` 에는 한 줄을 더한다.
「`career-workspace` 파일 동기화 명령을 실행하지 않는다. 추천 상태는 Backend 에서 읽고 쓴다.」

### 2. `docs/flow.md` 의 「비공개 작업본 동기화」 절에서 공부 추천을 뺀다

첫 문장의 스킬 목록에서 `study-topic-recommender` 를 지운다.
포지션 추천과 공부 추천의 장기 추천 상태는 Backend 에서 읽고 쓴다는 문장을 절 끝에 한 줄 더한다.

### 3. 이 phase 를 검증하는 검사

`career-os/scripts/position-recommender/skill_doc.test.ts` 와
`career-os/scripts/study-topic-recommender/skill_doc.test.ts` 에 항목을 더한다.

- `SKILL.md` 에 `career-os/.claude/skills/<스킬 이름>/` 문자열이 있다
- 두 `SKILL.md` 가 저장소 루트에서 명령을 실행하고 `docs/…` 는 `career-os/docs/…` 로 읽도록 안내한다
- 두 스킬의 `references/…` 링크 네 개와 `docs/flow.md` 경로가 저장소 루트에서 실제 파일로 풀린다
- 공부 추천 `SKILL.md` 에 `career-workspace` 를 실행하지 않는다는 문장이 있다. 이 안내를 제거하면 검사가 실패한다
- `career-os/docs/flow.md` 의 「비공개 작업본 동기화」 절 첫 문장에 `study-topic-recommender` 가 없다

## 검증

```bash
# cwd: 저장소 루트
export PATH="$HOME/.bun/bin:$PATH"
bun test career-os/scripts/position-recommender career-os/scripts/study-topic-recommender
bun test ./career-os/.claude/skills/
bunx tsc --noEmit
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" career-os/.claude/skills/position-recommender
python3 "$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py" career-os/.claude/skills/study-topic-recommender
```

```bash
# cwd: 저장소 루트
"$HOME/.claude/skills/korean-check/scripts/check.sh" \
  career-os/.claude/skills/position-recommender/SKILL.md \
  career-os/.claude/skills/study-topic-recommender/SKILL.md \
  career-os/docs/flow.md
```

기대값이다.

- 모두 종료 코드 0
- 더한 검사 항목이 통과
- 출력에 `skipped` 가 없다

**저장소 루트에서 경로가 실제로 풀리는지 본다.**

```bash
# cwd: 저장소 루트
ls career-os/.claude/skills/study-topic-recommender/references/execution.md \
   career-os/.claude/skills/position-recommender/references/judgment.md
```

둘 다 있어야 한다.

## 이 plan 을 마감한다

위 검증이 모두 통과하면 `career-os/tasks/plan130-hermes-skill-paths/index.json` 의
`status` 를 `completed` 로 바꾸고 `current_phase` 를 1 로 둔다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/SKILL.md` | 수정 |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | 수정 |
| `career-os/docs/flow.md` | 수정 |
| `career-os/scripts/position-recommender/skill_doc.test.ts` | 수정 |
| `career-os/scripts/study-topic-recommender/skill_doc.test.ts` | 수정 |
| `career-os/tasks/plan130-hermes-skill-paths/index.json` | 수정 |
