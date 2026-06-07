# Phase 04 — 검증, 감사 이력, plan 완료

## 목표

plan059 전체 흐름을 end-to-end로 검증하고, plan 상태를 완료로 정리한다.

## 범위

- hold/exclude/prepare 요청 생성 fixture 또는 smoke test.
- processor dry-run과 실제 적용 검증.
- stale guard 검증.
- audit log와 request status 확인.
- docs와 task status 정리.
- plan 단위 PR 생성 준비.

## 범위 밖

- 외부 제출 자동화.
- 별도 DB 컨테이너 생성.
- plan060 성격의 dashboard-to-agent freeform request gateway.

## 검증 명령 후보

```bash
python3 -m json.tool tasks/plan059-position-state-actions/index.json >/dev/null
rg -n "보류|제외|지원 준비|user_position_action_requests|prepare_application|effectiveReason" docs tasks/plan059-position-state-actions
```

fos-career 쪽에서는 구현 내용에 맞춰 다음 중 가능한 검증을 수행한다.

```bash
npx tsc --noEmit
npm run build
```

## 성공 기준

- 모든 phase status가 `completed`다.
- plan059 `index.json` status가 `completed`다.
- open decision이 남아 있으면 후속 plan으로 분리되어 있다.
- PR은 phase 단위가 아니라 plan 단위로 만든다.

## PHASE_BLOCKED

- prepare action이 resume package flow와 안전하게 연결되지 않으면 `PHASE_BLOCKED: prepare flow integration unresolved`를 출력한다.

## PHASE_FAILED

- 검증 없이 plan status만 completed로 바꾸면 실패로 본다.

## 실행 결과

- phase-01 산출물을 검토했다.
- phase-02~03 구현을 완료했다.
- `index.json`의 모든 phase status와 plan status를 `completed`로 정리했다.
- 남은 open decision은 없다.

## 검증 결과

- `python3 -m json.tool tasks/plan059-position-state-actions/index.json >/dev/null` 통과.
- `rg -n "보류|제외|지원 준비|user_position_action_requests|prepare_application|effectiveReason" docs tasks/plan059-position-state-actions scripts/application-agent/apply_position_action_request.ts scripts/application-agent/position_action_request_schema.ts` 실행.
- `bun --check scripts/application-agent/apply_position_action_request.ts` 통과.
- `bun --check scripts/application-agent/position_action_request_schema.ts` 통과.
- fos-career `npx tsc --noEmit` 통과.
- fos-career `DATABASE_URL=... SESSION_SECRET=... npm run build` 통과.
- `/tmp` fixture smoke:
  - `hold=done:hold`
  - `exclude=done:excluded`
  - `prepare=done:prepare-now:<ledgerId>`
  - stale snapshot은 exit 2와 `status=stale`을 반환했다.
