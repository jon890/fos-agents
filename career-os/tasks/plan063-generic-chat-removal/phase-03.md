# Phase 03 — build/docker health/static grep 검증 및 task 완료 정리

## 목표

chat 제거가 build, docker health, static reference 검증을 통과하는지 확인하고 plan063 task 상태를 정리한다.

## 범위

- fos-career lint, TypeScript, build 검증.
- docker compose 또는 배포 health check가 있으면 앱 컨테이너 관점 smoke 검증.
- chat route/API/static reference grep 검증.
- legacy table 비사용 여부 grep 검증.
- task `index.json` 상태, phase 실행 결과, 검증 결과 기록.
- HUD implementation completed/failed/blocked 갱신 지점 실행 또는 실패 기록.

## 비범위

- 새 feature 구현.
- career-os docs/ADR/정책 문서 수정.
- DB destructive migration.
- commit, push, PR 생성.
- apartment repo 변경 처리.

## 작업 절차

1. Phase 01-02 변경만 대상으로 `git diff --stat`과 `git diff --check`를 확인한다.
2. fos-career lint, TypeScript, build를 실행한다.
3. docker compose health check 또는 local app smoke 검증이 가능한지 확인하고, 가능하면 실행한다.
4. static grep으로 chat route/API/floating UI가 사라졌고 legacy table은 runtime path에서 쓰이지 않는지 확인한다.
5. 성공하면 task `index.json`을 completed로 갱신하고 각 phase 실행 결과를 짧게 기록한다.
6. 실패 또는 보류면 task `index.json`의 `status`, `error_message`, `blocked_reason`을 정확히 갱신한다.

## 검증 명령

```bash
cd ~/services/fos-career
git diff --check
npm run lint
npx tsc --noEmit
npm run build
rg -n "FloatingChat|/dashboard/chat|app/api/chat|/api/chat|generic chat|범용 채팅" app lib db/schema.ts README.md docs scripts package.json proxy.ts --glob '!db/data/**'
rg -n "llm_chat_sessions|llm_chat_messages" app lib db/schema.ts README.md docs scripts package.json proxy.ts --glob '!db/data/**'
```

docker 검증은 repo의 기존 명령을 우선한다.
예를 들어 `docker compose ps`, `docker compose up --build`, `curl` health check가 이미 문서화되어 있으면 그 명령을 사용한다.
새 DB 컨테이너는 만들지 않는다.

## 성공 기준

- lint, TypeScript, build가 통과한다.
- docker 또는 local health check가 가능한 환경에서는 정상 응답을 확인한다.
- `/dashboard/chat`, `/api/chat`, floating chat reference가 runtime code에 남지 않는다.
- `llm_chat_sessions`, `llm_chat_messages`는 legacy/deprecated 문맥 외 runtime 참조가 없다.
- task 상태와 phase 결과가 실제 검증 결과와 일치한다.

## PHASE_BLOCKED

- build나 docker 검증에 필요한 비밀/env가 없어 로컬에서 판단할 수 없으면 `PHASE_BLOCKED: missing local environment for final verification`을 출력한다.
- chat 제거는 끝났지만 legacy table 비사용 여부를 schema만으로 판별할 수 없으면 `PHASE_BLOCKED: unable to verify legacy table runtime references`를 출력한다.
- docs/ADR 정책을 새로 결정해야만 완료할 수 있으면 `PHASE_BLOCKED: docs contract needs update before completion`을 출력한다.

## PHASE_FAILED

- build 실패를 무시하고 completed로 표시하면 실패로 본다.
- HUD나 Discord 완료 보고에 private 본문, 면접 답변 전문, 상세 피드백 전문을 넣으면 실패로 본다.
- unrelated dirty 변경을 stage, revert, rewrite하면 실패로 본다.

## 완료 보고 형식

완료 보고는 한글로 짧게 작성한다.

- 변경 파일 목록.
- 통과한 검증 명령.
- 실패하거나 건너뛴 검증과 이유.
- 남은 legacy/deprecated reference가 있다면 허용 사유.
