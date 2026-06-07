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
