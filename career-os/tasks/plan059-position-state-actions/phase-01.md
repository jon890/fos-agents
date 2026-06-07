# Phase 01 — 요청 계약과 DB 상태 모델

## 목표

fos-career에서 `보류`, `제외`, `지원 준비` 요청을 안전하게 저장할 수 있는 request contract와 DB 상태 모델을 만든다.

## 범위

- `user_position_action_requests` schema 또는 동등한 request table 추가.
- action enum: `hold`, `exclude`, `prepare_application`.
- status enum: `pending`, `running`, `done`, `failed`, `stale`.
- `reason` optional, `effectiveReason` required.
- 요청 당시 career-os snapshot 저장.
- audit log event 이름과 payload 경계 정의.

## 범위 밖

- career-os 파일 mutation.
- resume package 실제 생성.
- dashboard 버튼 UI.
- 외부 제출, 로그인, 업로드, 공개 발행.

## 구현 힌트

- fos-career DB migration과 `db/schema.ts`를 먼저 맞춘다.
- 기존 `priority_action_requests`와 `action_history` 패턴을 재사용한다.
- reason이 비어 있으면 action별 기본값을 만든다.
  - `hold`: 사용자가 dashboard에서 보류로 표시함.
  - `exclude`: 사용자가 dashboard에서 제외로 표시함.
  - `prepare_application`: 사용자가 dashboard에서 지원 준비를 요청함.

## 성공 기준

- 새 request contract가 docs/data-schema.md와 코드 schema에 일치한다.
- JSON payload에 private document body나 resume body를 저장하지 않는다.
- `python3 -m json.tool tasks/plan059-position-state-actions/index.json >/dev/null` 통과.
- fos-career TypeScript 검증이 통과한다.

## PHASE_BLOCKED

- 기존 fos-career DB 상태 모델로 stale guard와 prepare chaining을 표현할 수 없고 새 table도 만들 수 없다면 `PHASE_BLOCKED: no safe request storage`를 출력한다.

## PHASE_FAILED

- dashboard가 career-os 파일을 직접 쓰는 구현이 필요해지면 실패로 본다.

## 실행 결과

- 완료 커밋: fos-career `5f4534f`.
- `user_position_action_requests` DB migration, drizzle schema, 요청 생성 API, 타입 계약을 확인했다.
- `reason` optional과 `effectiveReason` required 계약을 확인했다.
- request/result payload는 문서 본문, resume body, command stdout 전체를 저장하지 않는다.
