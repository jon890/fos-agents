---
name: accountbook-weekly-import
description: 주간 inbox의 토스 소비 화면 PNG와 sidecar manifest를 비대화형으로 처리하고, weekly-safe-v1 정책을 통과한 후보만 개인 accountbook API에 등록한다. `/accountbook-weekly-import`, "토스 캡처 주간 자동 등록", "가계부 주간 가져오기"처럼 inbox 기반 자동 처리를 요청할 때 사용한다. iPhone 업로드 endpoint, scheduler 설정, 알림 연동에는 사용하지 않는다.
---

# accountbook-weekly-import

주간 inbox의 신규 토스 화면을 처리하고, 안전 정책을 통과한 항목만 accountbook에 등록한다.
이 skill은 여러 이미지를 조정하는 역할만 맡고, OCR 판정과 API 전송 안전성은 결정적 script에 맡긴다.

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

8. 각 item마다 validator가 선택한 날짜를 `finalize_inbox.ts record-dates`로 기록한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts record-dates \
  --private-root accountbook/private \
  --image-sha256 <IMAGE_SHA256> \
  --selected-dates <YYYY-MM-DD[,YYYY-MM-DD...]>
```

9. 모든 item의 `selectedDates`를 모은다.
   같은 날짜가 둘 이상의 이미지에 있으면 관련 item은 모두 `needs_review`로 finalize하고, 해당 item은 POST하지 않는다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts finalize \
  --private-root accountbook/private \
  --image-sha256 <IMAGE_SHA256> \
  --status needs_review \
  --last-error-code WEEKLY_DATE_CONFLICT
```

10. 날짜 충돌이 없는 item만 `evaluate_policy.ts`로 평가한다.
   `weekly-policy.json`은 감사용이고, `submit_import.ts`에는 전달하지 않는다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/evaluate_policy.ts \
  --validated <RUN_DIR>/validated.json \
  --manifest <WORK_ITEM_MANIFEST_PATH> \
  --policy-output <RUN_DIR>/weekly-policy.json \
  --approved-output <RUN_DIR>/approved.json
```

`evaluate_policy.ts`가 exit `3`이면 정책 차단이다.
이 경우 `needs_review`로 finalize하고 POST하지 않는다.
exit `2`이면 입력 오류나 형식 오류이므로 `failed`로 finalize한다.

11. `eligible`이 `true`인 item만 `approved.json`을 `submit_import.ts`에 전달한다.
   `eligible`이 `false`이면 `needs_review`로 finalize한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/submit_import.ts \
  --input <RUN_DIR>/approved.json \
  --state-dir accountbook/private/state \
  --env accountbook/.env \
  --confirm <BATCH_ID>
```

12. submit 결과를 안정 코드로 분류해 finalize한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts finalize \
  --private-root accountbook/private \
  --image-sha256 <IMAGE_SHA256> \
  --status submitted \
  --batch-id <BATCH_ID>
```

- submit 성공: `submitted`
- 정책 차단 exit `3`: `needs_review`, `lastErrorCode=WEEKLY_POLICY_REJECTED`
- 기존 동일 거래: `needs_review`, `lastErrorCode=EXISTING_TRANSACTION_REQUIRES_REVIEW`
- 명확한 API 4xx 같은 확정 실패: `failed`, `lastErrorCode=ACCOUNTBOOK_API_4XX`
- 네트워크 단절, timeout, 연결 종료처럼 POST 결과가 불명확한 실패: finalize하지 않고 `processing`을 유지한다.
  재실행은 private submission state와 기존 거래 조회로만 복구한다.

13. 어떤 중간 오류가 있어도 `finally`에서 같은 `runId`로 `release-lock`을 시도한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-weekly-import/finalize_inbox.ts release-lock \
  --private-root accountbook/private \
  --run-id <RUN_ID>
```

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
