# Phase 04 — build/docker/systemd timer/static verification과 task 완료

**Model**: haiku
**Status**: pending

## 목표

plan064 변경이 build, Docker runtime, request processor timer 계약, static privacy boundary를 통과하는지 검증한다.

모든 phase 결과를 task 상태에 정리하고, implementation 완료/실패/보류 HUD event를 남긴다.

## 범위

- `~/services/fos-career` TypeScript/build 검증.
- Docker rebuild와 container health 확인.
- `scripts/run-interview-request-processor.sh` 존재와 실행 가능 여부 확인.
- systemd user timer/service 상태 확인.
- pending 1건 처리 원칙이 유지되는지 static 검증.
- evaluator fallback/guard/provider disabled/mock path smoke 검증 결과 확인.
- private body leak 방지를 위한 static grep.
- task `index.json` 완료 상태와 검증 결과 정리.
- HUD implementation completed/failed/blocked 갱신.

## 비범위

- 새 evaluator 기능 구현.
- dashboard redesign.
- docs/ADR/정책 문서 수정.
- systemd timer 주기 변경.
- DB destructive migration.
- 별도 DB container 생성.
- commit, push, PR 생성.

## 중요 지침

이 phase는 verification phase다.

`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.

검증 중 계약 부족이나 운영 결정 누락이 발견되면 `PHASE_BLOCKED`로 보고한다.

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
git -C career-os status --short
git -C ~/services/fos-career status --short
```

## 관련 파일

실행 전 반드시 읽는다.

- `career-os/tasks/plan064-interview-llm-evaluator/index.json`
- `career-os/tasks/plan064-interview-llm-evaluator/phase-01.md`
- `career-os/tasks/plan064-interview-llm-evaluator/phase-02.md`
- `career-os/tasks/plan064-interview-llm-evaluator/phase-03.md`
- `~/services/fos-career/package.json`
- `~/services/fos-career/docker-compose*.yml`
- `~/services/fos-career/scripts/run-interview-request-processor.sh`
- `~/services/fos-career/scripts/process-interview-requests.ts`

## 작업 절차

1. phase 01-03의 intended files와 dirty state를 확인한다.
2. fos-career 표준 검증을 실행한다.
   - `npx tsc --noEmit`
   - `npm run build`
   - 추가된 smoke/self-test
3. Docker 검증을 실행한다.
   - 별도 DB container를 새로 만들지 않는다.
   - 기존 compose가 쓰는 app container만 rebuild/restart한다.
4. processor runner와 systemd timer 상태를 확인한다.
   - 2분 주기와 pending 1건 처리 원칙을 바꾸지 않았는지 확인한다.
5. privacy/static grep을 실행한다.
   - request result/audit/Discord/HUD에 답변 전문, 상세 피드백 전문, private context body를 저장하는 코드가 없는지 확인한다.
6. career-os task `index.json`에 verification 결과와 완료 상태를 기록한다.
7. HUD를 implementation completed로 갱신한다.
   - 실패 시 implementation failed.
   - 보류 시 implementation blocked.

## 검증 명령

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd ~/services/fos-career
git status --short

npx tsc --noEmit
npm run build

test -x scripts/run-interview-request-processor.sh
bash -n scripts/run-interview-request-processor.sh

rg -n "limit\\(1\\)|LIMIT 1|pending 1|take 1|findFirst|orderBy" \
  scripts/process-interview-requests.ts lib app \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase04-pending-one.txt
PENDING_ONE_REF_COUNT=$(wc -l </tmp/plan064-phase04-pending-one.txt)
echo "[pending one refs] $PENDING_ONE_REF_COUNT"
test "$PENDING_ONE_REF_COUNT" -gt 0

rg -n "answerText|answerBody|feedbackBody|detailed feedback|full answer|private context|Discord|HUD|audit|result" \
  scripts lib app db \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  | tee /tmp/plan064-phase04-privacy-review.txt
PRIVACY_REVIEW_COUNT=$(wc -l </tmp/plan064-phase04-privacy-review.txt)
echo "[privacy review refs] $PRIVACY_REVIEW_COUNT"

git diff --check
```

Docker 검증:

```bash
cd ~/services/fos-career
docker compose up -d --build fos-career
docker compose ps
docker compose exec -T fos-career wget --quiet --tries=1 --spider http://localhost:3000 && echo healthy
```

systemd user timer 확인:

```bash
systemctl --user list-timers '*interview*' --all
systemctl --user status fos-career-interview-processor.timer --no-pager
systemctl --user status fos-career-interview-processor.service --no-pager
```

unit 이름이 다르면 `systemctl --user list-timers '*interview*' --all` 결과에 맞춰 실제 unit을 확인하고, 대체 이유를 보고한다.

추가된 smoke/self-test가 있으면 반드시 실행한다.

```bash
cd ~/services/fos-career
npm run smoke:interview-evaluator
```

해당 script가 없으면 실제 추가된 smoke/self-test 명령을 실행하고 이름을 보고한다.

HUD 갱신 예시:

```bash
cd /home/bifos/.openclaw/workspace-career
bun scripts/task-hud/update_event.ts \
  --session discord-career-main \
  --task-label plan064-interview-llm-evaluator \
  --event complete \
  --status completed \
  --target channel:1492521172099666021
```

## 성공 기준

- TypeScript, build, Docker health 검증이 통과한다.
- runner shell syntax가 통과한다.
- systemd user timer가 존재하고 2분 주기 processor 계약이 유지된다.
- processor는 한 번에 pending 1건만 처리한다.
- guard, JSON parse failure fallback, provider disabled fallback, normal evaluator mock path smoke가 통과한다.
- static privacy grep 결과를 사람이 review했고 request result/audit/Discord/HUD에 본문 전문 저장 경로가 없다.
- `index.json`에 완료 상태, 검증 명령, HUD 결과가 기록된다.
- implementation completed/failed/blocked HUD event가 남는다.

## common-pitfalls self-check

- 검증 명령을 실행하지 않고 success를 보고하지 않는다.
- `docker compose up`은 기존 compose 서비스를 사용하고 별도 DB container를 만들지 않는다.
- systemd timer를 수정하지 않고 상태만 확인한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- task 완료 기록 외에 새 기능 구현을 하지 않는다.
- trailing working tree 변경은 intended task result인지 확인한다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- systemd timer unit 이름이나 운영 방식이 docs와 달라 추가 결정 없이 검증할 수 없다.
- Docker compose가 별도 DB container 생성을 요구해 배포 정책과 충돌한다.
- smoke/self-test contract가 없어 evaluator 정상 path를 검증할 방법을 결정해야 한다.
- privacy grep에서 본문 전문 저장 의심 경로가 나왔고 즉시 판별할 수 없다.
- docs/ADR/정책 문서 수정 없이는 완료 검증을 계속할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- TypeScript, build, Docker health 중 하나가 실패한다.
- runner shell syntax가 실패한다.
- processor가 한 번에 pending 여러 건을 처리하도록 바뀌었다.
- timer 주기를 임의 변경했다.
- request result/audit/Discord/HUD에 답변 전문, 상세 피드백 전문, private context body가 저장된다.
- 별도 DB container를 새로 만든다.
- apartment repo 변경을 수정, stage, revert한다.
