---
name: accountbook-weekly-import
description: 주간 inbox의 토스 소비 화면 PNG와 sidecar manifest를 비대화형으로 처리하고, weekly-safe-v1 정책을 통과한 후보만 개인 accountbook API에 등록한다. `/accountbook-weekly-import`, "토스 캡처 주간 자동 등록", "가계부 주간 가져오기"처럼 inbox 기반 자동 처리를 요청할 때 사용한다. iPhone 업로드 endpoint, scheduler 설정, 알림 연동에는 사용하지 않는다.
---

# accountbook-weekly-import

주간 inbox의 신규 토스 화면을 처리하고, 안전 정책을 통과한 항목만 accountbook에 등록한다.
이 skill은 이미지 추출과 validated plan 생성까지만 조정한다.
날짜 충돌, 정책 평가, 제출, finalize, lock 해제는 `run_weekly_import.ts`가 맡는다.

## 입력과 실행 경계

기본 호출은 다음 형태다.

```text
/accountbook-weekly-import --inbox accountbook/private/inbox/new --mode auto-safe
```

작업 전에 `accountbook/AGENTS.md`와 `accountbook/docs/data-schema.md`를 읽는다.
특정 agent CLI, scheduler, 메시지 채널, runtime API는 직접 호출하지 않는다.
실행 runtime이 이미지 vision을 지원하지 않으면 `OCR_UNAVAILABLE`로 중단하고 외부 OCR 서비스에 임의 업로드하지 않는다.

## 전체 흐름

1. `runId`를 새로 만든다.
   재시작 처리라면 기존 실행이 남긴 같은 `runId`만 재사용한다.
   같은 `runId`로 재개할 때도 `attemptId`는 새로 만든다.
2. `scan_inbox.ts`로 queue를 만든다.
   queue output은 scan이 보장하는 `accountbook/private/state/` 아래에 시도별 고유 파일로 둔다.
   기존 queue를 덮어쓰지 않는다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/scan_inbox.ts \
  --private-root accountbook/private \
  --run-id <RUN_ID> \
  --output accountbook/private/state/<RUN_ID>-<ATTEMPT_ID>-queue.json
```

queue가 비어 있으면 성공으로 종료하고 `finally`에서 lock 해제를 시도한다.

3. 각 work item의 이미지를 vision으로 읽는다.
   [토스 화면 추출 계약](../accountbook-screenshot-import/references/extraction-contract.md)을 사용한다.
   화면 행, 일별 합계, 날짜 잘림 규칙을 이 skill에 복제하지 않는다.
4. 각 queue item의 SHA-256 앞 16자로 `BATCH_ID=toss-<16 hex>`와 `RUN_DIR=accountbook/private/imports/<BATCH_ID>`를 정한다.
   `secure_private_run.ts`를 먼저 실행해 실행 경로와 권한을 만든다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/secure_private_run.ts \
  --private-root accountbook/private \
  --batch-id <BATCH_ID>
```

5. `inspect_source.ts`에는 sidecar의 원본 생성 시각을 넘긴다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/inspect_source.ts \
  --input <WORK_ITEM_IMAGE_PATH> \
  --captured-at <MANIFEST_CAPTURED_AT> \
  --output <RUN_DIR>/source-image.json
```

6. vision 추출 결과를 `<RUN_DIR>/extracted.json`에 쓴다.
   작성 직후 `secure_private_run.ts`를 다시 실행해 private 디렉터리 `0700`과 파일 `0600` 권한을 강제한다.
7. `validate_candidates.ts`로 `<RUN_DIR>/validated.json`을 만든다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/validate_candidates.ts \
  --input <RUN_DIR>/extracted.json \
  --output <RUN_DIR>/validated.json
```

8. 모든 item의 validated 결과를 모아 run plan을 만든다.
   plan은 `accountbook/private/state/<RUN_ID>-<ATTEMPT_ID>-plan.json`에 파일 mode `0600`으로 저장한다.
   `queuePath`와 각 `validatedPath`는 `accountbook/private` 아래의 절대 경로여야 한다.
   manifest 경로는 plan에 복제하지 말고 queue에서 가져온다.
   vision 또는 validation 단계에서 확정 실패한 item은 안정 코드로 `failed` finalize한 뒤 plan에서 제외할 수 있다.
   아직 `processing`인 item은 plan에서 누락하지 않는다.

```json
{
  "schemaVersion": 1,
  "runId": "<RUN_ID>",
  "queuePath": "<ABSOLUTE_PRIVATE_ROOT>/state/<RUN_ID>-<ATTEMPT_ID>-queue.json",
  "items": [
    {
      "imageSha256": "<64 hex>",
      "validatedPath": "<ABSOLUTE_PRIVATE_ROOT>/imports/<BATCH_ID>/validated.json"
    }
  ]
}
```

9. plan을 `run_weekly_import.ts`에 넘긴다.
   이 script가 다음 작업을 순서대로 처리한다.

- plan 경로가 privateRoot 밖이면 API 호출 전에 중단한다.
- queue와 plan의 `runId`가 다르면 API 호출 전에 중단한다.
- 현재 `processing`인 queue item과 plan의 hash 집합이 다르거나 중복 hash가 있으면 API 호출 전에 중단한다.
- state가 `processing`인 item만 처리한다.
- 모든 `validated.json`을 먼저 parse한다.
- 모든 이미지의 선택 날짜를 state에 기록한다.
- 이미지 간 날짜 충돌을 사전 점검한다.
- 날짜 충돌 item은 `needs_review`로 finalize하고 POST하지 않는다.
- `weekly-safe-v1` 정책을 통과한 item만 `approved.json`으로 submit한다.
- submit 결과를 안정 코드로 분류해 finalize한다.
- `finally`에서 같은 `runId` lock 해제를 시도한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/run_weekly_import.ts \
  --private-root accountbook/private \
  --plan accountbook/private/state/<RUN_ID>-<ATTEMPT_ID>-plan.json \
  --env accountbook/.env
```

- submit 성공: `submitted`
- 정책 차단: `needs_review`, `lastErrorCode=WEEKLY_POLICY_REJECTED`
- 기존 동일 거래: `needs_review`, `lastErrorCode=EXISTING_TRANSACTION_REQUIRES_REVIEW`
- 명확한 API 4xx 같은 확정 실패: `failed`, `lastErrorCode=ACCOUNTBOOK_API_4XX`
- 네트워크 단절, timeout, 연결 종료처럼 POST 결과가 불명확한 실패: finalize하지 않고 `processing`을 유지한다.
  재실행은 private submission state와 기존 거래 조회로만 복구한다.

## POST 안전 규칙

- 이미지 간 날짜 충돌이 있으면 관련 item은 모두 POST하지 않는다.
- `weekly-policy.json`을 submit 입력으로 쓰지 않는다.
- `submit_import.ts`가 기존 동일 거래를 발견하면 다시 POST하지 않는다.
- POST 결과가 불명확했던 후보는 재실행에서 기존 거래 조회로만 복구한다.
  복구가 모호하면 재POST하지 않고 검토 대상으로 둔다.
- POST 결과가 불명확한 직후에는 inbox 상태를 임의로 terminal 상태로 바꾸지 않는다.
  다음 실행에서 private 전송 상태와 기존 거래 조회 결과를 기준으로 처리한다.
- `lastErrorCode`에는 OCR 원문, API 응답 본문, 계좌 식별자, 거래 설명을 넣지 않는다.
  `WEEKLY_POLICY_REJECTED`, `EXISTING_TRANSACTION_REQUIRES_REVIEW`, `ACCOUNTBOOK_API_4XX` 같은 안정 코드만 사용한다.

## 완료 조건

- 모든 work item이 `submitted`, `needs_review`, `failed` 중 하나로 finalize됐거나, 불명확한 POST 때문에 `processing` 상태로 남긴 이유가 있다.
- 자동 등록된 item은 `weekly-safe-v1` 정책을 통과한 `approved.json`만 submit에 사용했다.
- 날짜 충돌 item과 정책 차단 item은 POST 0회로 끝났다.
- 같은 `runId`로 weekly lease lock 해제를 시도했다.
