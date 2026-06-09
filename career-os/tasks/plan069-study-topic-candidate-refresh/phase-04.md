# Phase 04 — cron과 실행 검증

**Model**: sonnet
**Status**: pending

## 목표

candidate refresh가 cron과 on-demand 추천 실행에서 안전하게 동작하는지 검증한다.

cron 자동 refresh는 하루 1회로 제한하고, 실제 추천 smoke 실행에서 민감 정보 출력과 Discord routing 경계를 확인한다.

## 중요 지침

이 phase는 implementation phase다.

docs-first 반영은 이미 완료됐다.
`docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 임의 수정하지 않는다.
문서 계약이 부족하면 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

같은 plan의 phase는 병렬 실행하지 않는다.
Phase 01-03 산출물을 정확한 파일 경로로 다시 읽고 시작한다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
pwd
git status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `docs/adr.md`의 ADR-070
- `docs/flow.md`의 `study-topic-recommender` 내부 흐름
- `docs/code-architecture.md`의 runtime/scripts 구조
- `tasks/plan069-study-topic-candidate-refresh/index.json`
- `tasks/plan069-study-topic-candidate-refresh/phase-01.md`
- `tasks/plan069-study-topic-candidate-refresh/phase-02.md`
- `tasks/plan069-study-topic-candidate-refresh/phase-03.md`
- `.claude/skills/study-topic-recommender/SKILL.md`
- `scripts/study-topic-recommender/refresh_candidate_pool.ts`
- `scripts/study-topic-recommender/refresh_topic_inventory.ts`
- `.env.example`
- 현재 cron 또는 OpenClaw task 설정을 가리키는 repo-local 파일이 있으면 해당 파일

## 범위

- cron 또는 정기 실행 경로에서 candidate refresh 하루 1회 제한 구현.
- on-demand 자연어 context가 refresh trigger로 들어가는지 확인.
- `self-check`, render-only, 실제 추천 smoke 실행 검증.
- Discord routing 기준 확인.
- 민감 정보 출력 금지 grep과 runtime 산출물 검토.

## 비범위

- 새 공개 study pack 작성 또는 `sources/fos-study/` 발행.
- docs/ADR/정책 문서 수정.
- dashboard UI 수정.
- 외부 Discord 메시지 직접 발송 테스트.
- private 본문을 포함한 fixture 생성.
- commit, push, PR 생성.

## 작업 절차

1. 현재 정기 실행 경로와 env/channel 설정을 확인한다.
2. cron 자동 refresh 하루 1회 제한 상태 파일 또는 runtime marker를 구현한다.
3. on-demand context가 refresh trigger로 들어가고 render-only가 config를 바꾸지 않는지 확인한다.
4. 실제 `study-topic-recommender` 추천 smoke 또는 동등한 native skill 실행을 수행한다.
5. runtime JSON/Markdown, recommendation markdown, stdout에 민감 정보가 없는지 검토한다.

## 검증 명령

보고 직전 반드시 실행하고 raw 결과를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)/career-os"
git status --short

rg -n "study-topic-candidate-refresh|refresh_candidate_pool|once|daily|24|1513678786552660158|1492521172099666021|DISCORD_CHANNEL_ID|render-only|self-check" \
  .claude/skills/study-topic-recommender scripts config .env.example tasks/plan069-study-topic-candidate-refresh

bun --check scripts/study-topic-recommender/*.ts

bun scripts/study-topic-recommender/refresh_topic_inventory.ts --render-only >/tmp/plan069-final-render-only.txt
test -s /tmp/plan069-final-render-only.txt

test -f data/runtime/study-topic-candidate-refresh.json
test -f data/runtime/study-topic-candidate-refresh.md
test -f data/runtime/morning-topic-recommendation.md

python3 -m json.tool data/runtime/study-topic-candidate-refresh.json >/tmp/plan069-candidate-refresh-json.txt

rg -n "candidate-profile|data/private|data/applications|private/|지원 전략|답변 전문|GITHUB_TOKEN|DISCORD" \
  data/runtime/study-topic-candidate-refresh.md data/runtime/morning-topic-recommendation.md && exit 1 || true

git diff --check
git diff --name-only -- docs AGENTS.md TOOLS.md
```

실제 추천 smoke는 가능한 경우 아래 중 하나로 수행한다.

```bash
claude -p "/study-topic-recommender candidate refresh smoke"
```

`claude` 인증, 비용, 외부 실행 제한 때문에 수행하지 못하면 이유와 대체 검증 명령을 phase 결과에 남긴다.

## 성공 기준

- cron 또는 정기 실행 경로에서 자동 candidate refresh가 하루 1회로 제한된다.
- on-demand context가 refresh trigger로 반영된다.
- render-only 실행은 config를 변경하지 않는다.
- runtime JSON과 Markdown이 생성되고 JSON이 parse된다.
- 실제 추천 smoke 또는 대체 검증이 수행된다.
- 추천 요약 routing은 이직준비방 기준이고, 오류 분석 routing은 개발공부방 기준이다.
- runtime markdown과 recommendation markdown에 민감 정보가 없다.

## 민감 정보 경계

- 실제 Discord 메시지를 직접 발송하지 않는다.
- 검증 출력에 `.env` 값, token, webhook, private 지원 전략을 노출하지 않는다.
- runtime markdown을 채널에 보낼 수 있는 수준으로 유지한다.

## common-pitfalls self-check

- 마지막 phase이므로 trailing working tree 변경을 확인한다.
- docs/ADR/정책 문서를 수정하지 않는다.
- `git diff --cached --name-only`를 확인하고 intended files만 stage 대상인지 보고한다.
- 검증 명령을 실행하지 않고 성공 보고하지 않는다.
- PHASE_FAILED/PHASE_BLOCKED는 반드시 Bash 도구로 직접 실행하고 exit code를 남긴다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- repo-local cron 또는 정기 실행 경로를 찾을 수 없고 연결 책임을 판단할 수 없다.
- 하루 1회 제한 상태 파일 위치가 docs/data-schema.md 계약과 충돌한다.
- 실제 추천 실행이 비용 또는 인증 문제로 불가능하고 대체 검증만으로 성공 기준을 만족할 수 없다.
- Discord routing 기준이 `.env.example` 또는 실행 경로와 충돌한다.
- docs/ADR/정책 문서 수정 없이는 진행할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- cron 자동 refresh가 하루 여러 번 config를 변경할 수 있다.
- render-only 실행이 config를 변경한다.
- runtime JSON이 parse되지 않는다.
- runtime markdown 또는 recommendation markdown에 민감 정보, token, private path, 답변 전문이 남는다.
- 추천 결과와 오류 분석 routing을 같은 채널로 고정한다.
- docs/ADR/AGENTS/TOOLS/정책 문서를 임의 수정한다.
- unrelated dirty 변경을 revert, stage, commit, push한다.
