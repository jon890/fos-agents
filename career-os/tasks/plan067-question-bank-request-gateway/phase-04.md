# Phase 04 — 통합 검증과 privacy 경계 확인

**Model**: haiku
**Status**: completed

## 목표

plan067 구현이 ADR-068의 request gateway 계약, public/private 경계, 검증 기준을 지키는지 확인한다.

필요한 경우 fos-career docker rebuild/restart를 수행하되, 별도 DB 컨테이너는 만들지 않는다.

## 중요 지침

이 phase는 validation phase다.

Phase 03이 완료된 뒤 실행한다.
같은 plan의 phase는 병렬 실행하지 않는다.

새 기능을 추가하지 않는다.
career-os `docs/`, ADR, `AGENTS.md`, `TOOLS.md`, 정책 문서를 수정하지 않는다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git status --short
git -C ~/services/fos-career status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `tasks/plan067-question-bank-request-gateway/index.json`
- `tasks/plan067-question-bank-request-gateway/phase-01.md`
- `tasks/plan067-question-bank-request-gateway/phase-02.md`
- `tasks/plan067-question-bank-request-gateway/phase-03.md`
- `docs/adr.md`의 ADR-068
- `docs/data-schema.md`의 result 저장 경계
- `docs/flow.md`의 question bank request 흐름
- `~/services/fos-career`의 변경 파일

## 범위

- DB migration/schema smoke.
- API route request 생성 smoke 또는 unit 가능한 범위.
- processor dry-run, self-test, 또는 unit 가능한 범위.
- dashboard 버튼 request 생성 경로 확인.
- `npx tsc --noEmit`.
- `npm run build`.
- career-os `bun scripts/question-bank-collector/validate.ts`.
- `sources/fos-study` 변경 없음 확인.
- privacy grep.
- direct skill execution grep.
- 필요 시 fos-career docker rebuild/restart.
- plan067 `index.json`과 phase 파일 상태 정리.
- HUD 완료/실패/보류 갱신.

## 비범위

- 새 기능 추가.
- private `prep.md` 자동 반영.
- 질문 bank 내용을 fos-study로 발행.
- 범용 chat 복구.
- dashboard 직접 `claude` 실행.
- public/question-bank에 private 정보 저장.
- commit, push, PR 생성.

## 검증 명령

보고 직전 가능한 범위에서 실행하고 raw 결과를 남긴다.

```bash
cd ~/ai-nodes/career-os
python3 -m json.tool tasks/plan067-question-bank-request-gateway/index.json >/dev/null
rg -n "question_bank_refresh|question-bank-collector|질문 bank 보강|public-safe summary|validator count|command stdout|prep.md|fos-study|PHASE_BLOCKED|PHASE_FAILED|HUD" \
  tasks/plan067-question-bank-request-gateway docs/adr.md docs/data-schema.md docs/flow.md docs/code-architecture.md docs/prd.md

bun scripts/question-bank-collector/validate.ts
git status --short sources/fos-study

cd ~/services/fos-career
git status --short
rg -n "question_bank_refresh|question-bank-collector|질문 bank 보강|CLAUDE_PERMISSION_MODE|validate.ts|resultJson|stdout|errorSummary" \
  app lib scripts db

npx tsc --noEmit
npm run build
git diff --check
```

가능하면 추가로 실행한다.

```bash
cd ~/services/fos-career
npm run apply:interview-requests -- --self-test-gates
```

위 명령이 없거나 현재 repo와 맞지 않으면, 사용 가능한 API route/request 생성 smoke 또는 unit 검증으로 대체하고 이유를 보고한다.

## privacy grep

아래 grep 결과를 직접 검토한다.
금지 문구 정의나 테스트 문자열은 허용될 수 있지만, 실제 저장 payload나 UI 표시 경로에 민감 본문이 들어가면 실패다.

```bash
cd ~/services/fos-career
rg -n "private 답변|지원 전략|회사별 비공개|command stdout 전체|stdout.*resultJson|prep.md|candidate-profile|sources/fos-study|claude -p|/question-bank-collector" \
  app lib scripts db
```

## docker rebuild/restart

구현 변경이 배포 반영을 요구할 때만 수행한다.

- 기존 `private-net`의 `bifos-db` MySQL 컨테이너를 사용한다.
- 별도 DB 컨테이너를 만들지 않는다.
- rebuild/restart 명령과 결과를 보고한다.
- 필요하지 않으면 수행하지 않은 이유를 보고한다.

## 성공 기준

- task `index.json`이 JSON 검증을 통과한다.
- DB migration/schema smoke가 통과하거나 실행 불가 사유가 명확하다.
- API route/request 생성 smoke 또는 unit 검증이 통과한다.
- processor가 `question_bank_refresh`를 `question-bank-collector`로만 매핑한다.
- dashboard 버튼은 request 생성만 하고 `claude`를 직접 실행하지 않는다.
- resultJson에는 public-safe summary, path, count만 저장된다.
- command stdout 전체, private 본문, 답변 전문, 회사별 비공개 맥락이 저장되지 않는다.
- `bun scripts/question-bank-collector/validate.ts`가 통과한다.
- `sources/fos-study` 변경이 없다.
- `npx tsc --noEmit`이 통과한다.
- `npm run build`가 통과한다.
- `git diff --check`가 통과한다.
- 필요 시 docker rebuild/restart 결과가 확인된다.
- HUD가 completed, failed, blocked 중 실제 결과에 맞게 갱신된다.

## HUD 갱신

성공 시:

```bash
bun /home/bifos/.openclaw/workspace-career/scripts/task-hud/update_event.ts \
  --session discord-career-main \
  --task-label plan067-question-bank-request-gateway \
  --event complete \
  --status "implementation completed" \
  --target channel:1492521172099666021
```

실패 시:

```bash
bun /home/bifos/.openclaw/workspace-career/scripts/task-hud/update_event.ts \
  --session discord-career-main \
  --task-label plan067-question-bank-request-gateway \
  --event fail \
  --status "implementation failed" \
  --target channel:1492521172099666021
```

보류 시:

```bash
bun /home/bifos/.openclaw/workspace-career/scripts/task-hud/update_event.ts \
  --session discord-career-main \
  --task-label plan067-question-bank-request-gateway \
  --event block \
  --status "implementation blocked" \
  --target channel:1492521172099666021
```

## common-pitfalls self-check

- Phase 03이 완료됐는지 확인했다.
- 검증만 수행했고 새 기능을 추가하지 않았다.
- fos-study 변경 없음 확인을 실행했다.
- privacy grep 결과를 사람이 검토했다.
- docker 작업이 필요할 때 기존 `bifos-db`를 재사용했다.
- career-os docs/ADR/정책 문서를 수정하지 않았다.
- commit/push하지 않았다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- DB migration/schema smoke를 실행할 방법을 찾을 수 없고 대체 검증도 없다.
- API request 생성 smoke 또는 unit 검증을 구성할 수 없다.
- processor 검증에 실제 민감 stdout 저장이 필요하다.
- docker rebuild/restart가 필요한데 기존 DB 컨테이너 연결 방식을 확인할 수 없다.
- 구현이 docs-first 계약과 충돌해 문서 변경 없이는 해결할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 검증 명령을 실행하지 않고 success로 보고한다.
- `npx tsc --noEmit` 또는 `npm run build` 실패를 success로 보고한다.
- dashboard direct `claude` 실행 경로가 남아 있다.
- resultJson, audit log, Discord 알림에 command stdout 전체나 민감 본문이 저장된다.
- `sources/fos-study`가 변경됐다.
- 별도 DB 컨테이너를 만든다.
- career-os docs/ADR/정책 문서를 임의 수정한다.

## 실행 결과

- Completed at: 2026-06-08T19:08:22+09:00
- fos-career 검증: `npx tsc --noEmit`, `npm run build`, `git diff --check` 통과.
- career-os 검증: `python3 -m json.tool tasks/plan067-question-bank-request-gateway/index.json`, `bun scripts/question-bank-collector/validate.ts`, `git status --short sources/fos-study`, `git diff --check -- tasks/plan067-question-bank-request-gateway` 통과.
- DB migration: `npx drizzle-kit migrate`는 기존 DB의 `__drizzle_migrations`가 비어 있어 0000부터 재적용하려다 실패했다. 이번 0006 enum ALTER만 기존 `bifos-db`에 직접 적용했고 `SHOW COLUMNS`로 `question_bank_refresh`와 `question-bank-collector` 반영을 확인했다.
- pending request smoke: transaction rollback insert로 `question_bank_refresh`/`question-bank-collector` pending row 생성 가능을 확인했다.
- docker: `docker compose up -d --build fos-career`로 앱 컨테이너만 rebuild/restart했고 `fos-career-app` healthy 및 `/dashboard/interview` 307 login redirect를 확인했다.
- privacy grep: dashboard/API direct `claude` 실행 없음, `/question-bank-collector`는 processor 허용 경로에만 있음, question bank resultJson은 path/count/summary 중심임을 확인했다.
- HUD complete event를 기록했다.
- apartment repo 변경을 수정, stage, revert한다.
