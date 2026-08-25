---
name: accountbook-discord-import
description: Hermes가 Discord에서 받은 토스 소비 내역 PNG 한 장을 비공개 입력함에 안전하게 옮기고, 기존 주간 가계부 스킬로 즉시 처리한다. "Discord 가계부 등록", "토스 캡처 전송", "이 가계부 이미지를 등록해 줘", `/accountbook-discord-import`처럼 Discord 첨부 화면을 가계부로 보내려는 요청에 사용한다. 일반 파일 보관, 여러 이미지 일괄 처리와 Discord 메시지 삭제에는 사용하지 않는다.
---

# Discord 가계부 이미지 가져오기

Hermes가 받은 Discord PNG 한 장을 비공개 입력함에 옮긴 뒤 기존 안전 등록 흐름을 즉시 실행한다.
이 스킬은 Discord 첨부 접수만 담당하며 화면 추출, 안전 판정과 accountbook API 등록 로직을 복제하지 않는다.

## 입력 확인

1. `accountbook/AGENTS.md`와 `accountbook/docs/data-schema.md`를 읽는다.
2. 현재 대화의 전송 경로가 Discord인지 실행 정보로 확인한다.
   Discord가 아니면 이 스킬을 실행하지 않는다.
3. 사용자와 채널의 허용 여부는 Hermes 운영 설정이 이미 검사했다고 전제한다.
   저장소 문서나 응답에 사용자 ID와 채널 ID를 기록하지 않는다.
4. 현재 메시지에 연결된 첨부 파일만 센다.
   첨부 파일이 없거나 두 개 이상이면 파일을 옮기거나 accountbook API를 호출하지 않는다.
5. 첨부 파일이 한 개여도 확장자가 `.png`가 아니면 중단하고 PNG 화면 한 장을 보내도록 안내한다.

## 비공개 입력함 적재

Hermes가 현재 메시지의 첨부 파일에 부여한 로컬 경로를 `<ATTACHMENT_PATH>`로 사용한다.
원본 파일명과 금융 내용을 로그나 응답에 쓰지 않는다.

```bash
<TS_RUNTIME> accountbook/scripts/accountbook-discord-import/stage_attachment.ts \
  --input <ATTACHMENT_PATH> \
  --private-root accountbook/private
```

`<TS_RUNTIME>`은 `bun`이 있으면 `bun`, 없으면 TypeScript를 직접 실행할 수 있는 Node.js 22.18 이상을 사용한다.
스크립트가 형식, 크기, 파일 권한과 중복 여부를 결정적으로 검사하므로 에이전트가 이를 추측하거나 우회하지 않는다.

- `staged`: 비공개 입력함에 새로 적재됐다.
- `already_staged`: 같은 바이트의 이미지가 이미 적재돼 있으므로 새 파일을 만들지 않는다.
- `DISCORD_ATTACHMENT_NOT_PNG`: PNG 화면 한 장을 다시 보내도록 안내한다.
- `DISCORD_ATTACHMENT_TOO_LARGE`: 32 MiB 이하 PNG 화면을 보내도록 안내한다.
- `DISCORD_INBOX_PAIR_CONFLICT`: 덮어쓰거나 자동 복구하지 않고 검토가 필요하다고 알린다.

## 기존 안전 등록 흐름에 위임

적재 결과가 `staged` 또는 `already_staged`이면 `accountbook-weekly-import` 스킬에 다음 의도로 즉시 위임한다.

```text
/accountbook-weekly-import --inbox accountbook/private/inbox/new --mode auto-safe
```

위 문자열을 별도 명령줄 도구 호출로 조립하지 않는다.
현재 에이전트가 제공하는 스킬 호출 방식으로 `accountbook-weekly-import`를 실행한다.
이미지 인식이나 accountbook API 호출을 이 스킬에서 직접 구현하지 않는다.

## 회신과 중단 조건

성공 회신에는 처리 날짜와 등록·검토·실패 건수만 적는다.
거래 설명, 가맹점, 계좌·카드 식별자, 원본 파일명, 로컬 경로, 인증 값과 API 응답 본문은 넣지 않는다.

- `needs_review`는 자동 재시도하지 않는다.
- POST 결과를 확정할 수 없는 실패도 자동 재시도하지 않는다.
- Discord 원본 메시지를 삭제하지 않는다.
- 입력 오류로 적재하지 못했으면 주간 가져오기 스킬을 호출하지 않는다.
- 거래가 없거나 모두 이미 처리된 경우에도 정상적인 0건 결과로 회신한다.

## 완료 조건

- 현재 Discord 메시지의 PNG 한 장만 비공개 입력함에 적재했다.
- 기존 `accountbook-weekly-import` 스킬이 안전 정책과 API 등록을 담당했다.
- 자동 재시도 없이 등록·검토·실패 건수만 회신했다.
- Discord 메시지와 Hermes 운영 설정을 변경하지 않았다.
