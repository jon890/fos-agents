---
name: accountbook-screenshot-import
description: 토스 소비 내역 스크린샷을 읽어 날짜별 수입·지출 후보를 만들고, 화면 일별 합계와 결정적 검증을 통과한 후보를 사용자 확인 뒤 개인 accountbook API에 등록한다. "토스 가계부 등록", "스크린샷 거래 가져오기", "가계부 OCR", "소비 내역 이미지 처리", `/accountbook-screenshot-import`처럼 금융 스크린샷에서 거래를 추출하거나 등록할 때 사용한다. 영수증 OCR이나 accountbook 앱 기능 개발에는 사용하지 않는다.
---

# 가계부 스크린샷 가져오기

토스 화면에서 거래 후보를 추출하고 검증한 뒤, 승인된 후보만 accountbook에 등록한다.

## 입력과 사전 확인

1. `accountbook/AGENTS.md`와 `accountbook/docs/data-schema.md`를 읽는다.
2. 사용자가 지정한 PNG 경로를 절대 경로로 확인한다.
3. 실행 환경이 이미지를 원본 해상도로 검사할 수 있는지 확인한다.
   지원하지 않으면 `OCR_UNAVAILABLE`로 중단하며 외부 OCR 서비스에 임의로 업로드하지 않는다.
4. 다음 스크립트로 파일명, 해시, 생성 시각과 크기를 얻는다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/inspect_source.ts \
  --input <IMAGE_PATH> \
  --output <RUN_DIR>/source-image.json
```

`<TS_RUNTIME>`은 `bun`이 있으면 `bun`, 없으면 TypeScript를 직접 실행할 수 있는 Node.js 22.18 이상을 사용한다.

## 추출

[토스 화면 추출 계약](references/extraction-contract.md)을 읽고 이미지를 검사한다.
화면 전체에서 날짜와 일별 합계를 먼저 읽고, 거래 영역을 다시 확인해 각 행을 추출한다.

`source-image.json`의 SHA-256 앞 16자를 사용해 `accountbook/private/imports/toss-<hash>/`를 실행 경로로 삼는다.
절대 이미지 경로를 JSON에 저장하지 않는다.

실행 경로를 만들기 전과 비공개 JSON을 쓴 직후 다음 스크립트를 실행한다.
이 스크립트는 `private` 전체 디렉터리를 `0700`, 파일을 `0600`으로 강제한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/secure_private_run.ts \
  --private-root accountbook/private \
  --batch-id <BATCH_ID>
```

추출 결과를 해당 경로의 `extracted.json`에 쓴다.
실제 이름, 계좌, 가맹점과 금액이 있으므로 이 파일을 응답 본문이나 공개 경로에 복사하지 않는다.
작성 직후 위 script를 다시 실행하고 파일 권한이 `0600`인지 확인한다.

## 결정적 검증

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/validate_candidates.ts \
  --input <RUN_DIR>/extracted.json \
  --output <RUN_DIR>/validated.json
```

`validation.submissionReady`가 `false`이면 등록을 시도하지 않는다.
오류 코드와 원본의 해당 행을 다시 비교하고, OCR로 확정할 수 없는 필드는 사용자가 수정하도록 표시한다.

## 미리보기와 정지 조건

사용자에게 다음 항목만 간결하게 보여준다.

- 묶음 ID와 대상 날짜
- 날짜별 지출 건수·합계와 수입 건수·합계
- 날짜나 필드의 추론·중간 신뢰도
- 합계 불일치, 잘린 화면과 기존 동일 거래 같은 차단 사유

계좌 식별자와 불필요한 상대방 실명은 가린다.
첫 실행은 미리보기에서 끝낸다.
사용자가 후보를 확인하고 등록을 명시하기 전에는 승인 파일을 만들거나 API를 호출하지 않는다.

## 승인과 등록

사용자가 묶음 내용을 확인하고 등록을 명시한 다음 턴에만 실행한다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/approve_import.ts \
  --input <RUN_DIR>/validated.json \
  --output <RUN_DIR>/approved.json \
  --confirm <BATCH_ID>

<TS_RUNTIME> accountbook/scripts/accountbook-screenshot-import/submit_import.ts \
  --input <RUN_DIR>/approved.json \
  --state-dir accountbook/private/state \
  --env accountbook/.env \
  --confirm <BATCH_ID>
```

등록 스크립트가 `needs_review`를 반환하면 자동으로 다시 POST하지 않는다.
성공한 수입·지출 수, 복구된 수와 검토가 필요한 수를 보고한다.

## 완료 조건

- 선택한 날짜의 상세 합계와 화면 일별 합계가 일치한다.
- 사용자가 확인한 묶음 ID와 승인 파일의 `batchId`가 같다.
- API가 반환한 원격 UUID가 비공개 전송 상태에 기록됐다.
- 스킬이 새로 만든 이미지 사본과 거래 후보는 `accountbook/private/` 밖에 남지 않는다.
- `accountbook/private/` 하위 디렉터리는 `0700`, 파일은 `0600`이다.
