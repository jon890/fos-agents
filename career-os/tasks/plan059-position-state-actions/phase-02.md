# Phase 02 — processor와 career-os 적용 경로

## 목표

pending request를 읽어 career-os 상태에 안전하게 반영하는 processor와 applier 경로를 만든다.

## 범위

- fos-career host-side processor 추가 또는 기존 application action processor 확장.
- career-os applier script 추가 또는 기존 priority/request helper 확장.
- stale guard: 요청 당시 snapshot과 현재 frontdoor/ledger record 비교.
- `hold`: action stage를 `hold`로 반영.
- `exclude`: action stage를 `excluded`로 반영.
- `prepare_application`: frontdoor 후보면 ledger 승격 후 application request를 생성하거나 resume package flow로 연결.
- 처리 결과를 `done`, `failed`, `stale`로 저장.

## 범위 밖

- dashboard UI.
- 사용자의 승인 없는 외부 제출.
- candidate-profile 자동 수정.

## 구현 힌트

- plan053 `apply_priority_request.ts`와 plan055 application request processor를 먼저 읽는다.
- `prepare_application`은 long-running skill 실행과 상태 전이를 분리하는 기본값을 따른다.
  가능하면 application request row를 생성하고 후속 processor가 resume package 생성을 맡게 한다.
- result snapshot에는 ledgerId, effective stage, readiness count, material path 요약만 저장한다.
  문서 본문과 command stdout 전체를 저장하지 않는다.

## 성공 기준

- hold/exclude/prepare 세 action이 dry-run 또는 fixture로 검증된다.
- stale snapshot이면 career-os 파일을 쓰지 않는다.
- prepare action은 외부 제출을 수행하지 않는다.
- 관련 schema와 processor TypeScript 검증이 통과한다.

## PHASE_BLOCKED

- frontdoor 후보를 ledger로 승격한 뒤 application request와 연결할 안정적인 id가 없으면 `PHASE_BLOCKED: missing prepare id bridge`를 출력한다.

## PHASE_FAILED

- request snapshot 비교 없이 career-os mutation이 발생하면 실패로 본다.
