# Phase 01: Discord 첨부 파일 적재와 날짜 안전 규칙 구현

**Execution profile**: standard

---

## 목표

Hermes가 로컬 캐시에 저장한 Discord PNG 첨부 파일을 비공개 입력함에 원자적으로 적재한다.
Discord 수신 시각으로 연도를 보완할 때는 최근 14일의 거래 날짜만 `weekly-safe-v1` 자동 등록 대상으로 허용한다.

이 phase는 `plan002-weekly-safe-import`가 만드는 주간 입력 계약과 안전 정책 구현을 전제로 한다.
필요한 경로가 현재 branch에 없으면 구현을 시작하지 말고 `PHASE_BLOCKED: plan002-weekly-safe-import 선행 변경이 없습니다`를 출력한 뒤 1이 아닌 종료 코드로 끝낸다.

**범위 외**: Hermes 스킬 작성, 기존 스킬 문체 교정과 Discord 메시지 회신 형식은 Phase 02가 담당한다.

## 작업 항목

### 1. Discord 입력 출처 계약 확장

`accountbook/scripts/accountbook-weekly-import/contracts.ts`의 보조 정보 파일 `source`에 `hermes-discord`를 추가한다.
기존 `ios-shortcut` 입력은 그대로 허용한다.
공개 문서에 적힌 실제 필드명과 enum 값을 바꾸지 않는다.

### 2. 첨부 파일 적재 스크립트 구현

`accountbook/scripts/accountbook-discord-import/stage_attachment.ts`에 다음 함수를 구현한다.

```ts
type StageDiscordAttachmentOptions = {
  inputPath: string;
  privateRoot: string;
  receivedAt?: Date;
};

type StageDiscordAttachmentResult = {
  status: "staged" | "already_staged";
  imageSha256: string;
  imagePath: string;
  manifestPath: string;
};

function stageDiscordAttachment(
  options: StageDiscordAttachmentOptions,
): StageDiscordAttachmentResult;
```

스크립트는 다음 조건을 결정적으로 강제한다.

- 일반 파일인 PNG 한 장만 받으며 확장자와 PNG 서명을 함께 확인한다.
- 파일 크기는 Hermes 기본 첨부 제한과 같은 32 MiB 이하로 제한한다.
- SHA-256 앞 16자를 사용해 `discord-<16 hex>.png`와 같은 이름의 JSON을 만든다.
- `capturedAt`과 `receivedAt`에는 같은 Discord 수신 시각을 기록하고 `source`는 `hermes-discord`로 쓴다.
- 대상 디렉터리와 임시 파일은 각각 `0700`, `0600` 권한을 사용한다.
- 이미지는 임시 이름으로 복사하고 보조 정보 파일을 마지막에 rename해 완성된 pair만 scanner가 보게 한다.
- 같은 해시의 완성된 pair가 있으면 `already_staged`로 끝낸다.
- 한쪽 파일만 있거나 기존 내용이 다르면 덮어쓰지 않고 안정된 오류 코드로 중단한다.
- stdout에는 상태, 해시와 private 경로만 JSON으로 출력하고 원본 파일명과 금융 본문은 출력하지 않는다.

CLI는 `--input`, `--private-root`, 선택적인 `--received-at`을 받는다.
`--received-at`은 테스트와 복구용이며, 생략하면 현재 시각을 사용한다.

### 3. Discord 날짜 허용 범위 추가

`accountbook/scripts/accountbook-weekly-import/evaluate_policy.ts`에서 `source: hermes-discord` 입력에 다음 조건을 추가한다.

- 선택된 거래 날짜가 `capturedAt`의 날짜보다 미래면 `DISCORD_DATE_IN_FUTURE`로 차단한다.
- 선택된 거래 날짜가 `capturedAt`의 날짜보다 14일을 초과해 오래됐으면 `DISCORD_DATE_OUTSIDE_AUTO_WINDOW`로 차단한다.
- 경계일은 허용하고 `ios-shortcut`의 기존 판정은 바꾸지 않는다.

차단 사유에는 날짜나 거래 원문을 넣지 않는다.

### 4. 단위 테스트 추가

`stage_attachment.test.ts`에서 정상 적재, 권한, 마지막 줄바꿈, 같은 이미지 재적재, PNG가 아닌 파일, 32 MiB 초과, 부분 pair 충돌을 검증한다.
`evaluate_policy.test.ts`에서 Discord 입력의 당일, 14일 경계, 15일 경과와 미래 날짜를 검증한다.

## Critical Files

| 파일 | 변경 |
|---|---|
| `accountbook/scripts/accountbook-discord-import/stage_attachment.ts` | 신규 |
| `accountbook/scripts/accountbook-discord-import/stage_attachment.test.ts` | 신규 |
| `accountbook/scripts/accountbook-weekly-import/contracts.ts` | 수정 |
| `accountbook/scripts/accountbook-weekly-import/evaluate_policy.ts` | 수정 |
| `accountbook/scripts/accountbook-weekly-import/evaluate_policy.test.ts` | 수정 |

## 검증

보고 직전 반드시 다음 명령을 실행하고 원시 종료 상태를 출력한다.

```bash
# cwd: fos-agents 저장소 루트
cd "$(git rev-parse --show-toplevel)"
pwd
bun test accountbook/scripts/accountbook-discord-import accountbook/scripts/accountbook-weekly-import
test_status=$?
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext \
  --moduleResolution bundler --allowImportingTsExtensions --types bun-types \
  accountbook/scripts/accountbook-discord-import/*.ts \
  accountbook/scripts/accountbook-screenshot-import/*.ts \
  accountbook/scripts/accountbook-weekly-import/*.ts
type_status=$?
echo "[test_status] $test_status"
echo "[type_status] $type_status"
test "$test_status" -eq 0
test "$type_status" -eq 0
```

## 의도 메모

- Hermes 캐시는 장기 저장소가 아니므로 수신 실행 안에서 비공개 입력함으로 옮긴다.
- 파일 적재까지만 새로 구현하고 금융 판정과 API 등록은 기존 코드를 재사용한다.
- Discord는 원본 생성 시각을 보장하지 않으므로 거래 날짜 범위를 별도로 제한한다.

## 커밋

변경 파일만 stage한 뒤 다음 형식으로 커밋한다.

```text
feat(accountbook): Discord 첨부 이미지를 안전 입력함에 적재한다
```
