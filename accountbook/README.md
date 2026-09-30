# accountbook

토스 소비 화면 같은 금융 스크린샷을 가계부 거래 후보로 변환하고 검증한 뒤 등록하는 워크스페이스다.

## 현재 범위

- 이미지 인식을 지원하는 에이전트가 토스 소비 화면을 읽는다.
- TypeScript 검증기가 날짜, 금액, 행 구조와 일별 합계를 검사한다.
- 대화형 후보는 사용자가 확정한 뒤 기존 accountbook 수입·지출 API에 등록한다.
- 주간 실행은 `weekly-safe-v1` 정책을 통과한 후보만 자동 등록한다.
- Hermes가 Discord에서 받은 이미지는 비공개 입력함으로 옮긴 뒤 같은 안전 정책으로 즉시 처리한다.
- 이미지 해시와 비공개 등록 상태로 같은 실행의 중복 전송을 막는다.

OCR 엔진 자체를 제공하지 않으며 이미지 입력을 지원하지 않는 실행 환경에서는 실행을 중단한다.
LangGraph나 별도 작업 대기열은 사용하지 않는다.

## 준비

`accountbook/.env.example`을 참고해 `accountbook/.env`를 만든다.
원본 이미지와 실행 산출물은 사용자별 비공개 루트 아래에 두며 git에 커밋하지 않는다.
환경 변수와 사용자 격리 계약은 [데이터 계약](docs/data-schema.md#환경-변수)을 따른다.

## MCP plugin

배포 단위는 `accountbook/plugin/`, plugin 이름은 `fos-accountbook` 0.1.0이다.
에이전트는 단일 `accountbook-api` 스킬을 통해 MCP 도구로 조회·등록·수정·삭제한다.
fos-assistant 설치기는 [plugin 설치 계약](docs/code-architecture.md#plugin-설치-계약)을 읽고 Hermes profile마다 `accountbook` 서버를 설치한다.
사용자는 가계부 설정에서 발급한 연동 토큰을 fos-assistant에 등록한다.
런타임에는 Bun만 필요하며, 패키지 설치는 빌드하는 개발 환경에서만 수행한다.

## 실행

에이전트에서 다음 의도로 스킬을 호출한다.
`<PRIVATE_ROOT>`는 `resolve_private_root.ts`가 현재 profile 설정에서 반환한 절대 경로다.

```text
/accountbook-screenshot-import <이미지 경로>
/accountbook-weekly-import --inbox <PRIVATE_ROOT>/inbox/new --mode auto-safe
/accountbook-discord-import <Hermes가 제공한 첨부 이미지 경로>
```

처음 실행은 후보 미리보기에서 멈춘다.
후보를 확인한 뒤 등록을 명시하면 기존 accountbook API를 호출한다.
주간 실행 시점과 Hermes의 Discord 사용자·채널 권한은 저장소 밖 실행 환경에서 설정한다.
권장 실행 시각은 매주 월요일 04:00 `Asia/Seoul`이다.

## 검증

```bash
bun test ./accountbook/plugin ./accountbook/scripts/accountbook-discord-import \
  ./accountbook/scripts/accountbook-screenshot-import \
  ./accountbook/scripts/accountbook-weekly-import
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext \
  --moduleResolution bundler --allowImportingTsExtensions --types bun-types \
  accountbook/scripts/accountbook-discord-import/*.ts \
  accountbook/scripts/accountbook-screenshot-import/*.ts \
  accountbook/scripts/accountbook-weekly-import/*.ts
bun run --cwd accountbook/plugin typecheck
bun run --cwd accountbook/plugin build
claude plugin validate accountbook/plugin
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  accountbook/.claude/skills/accountbook-discord-import
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  accountbook/.claude/skills/accountbook-screenshot-import
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  accountbook/.claude/skills/accountbook-weekly-import
```

새 MCP 스킬도 같은 검증기로 검사한다.

```bash
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  accountbook/.claude/skills/accountbook-api
```

plugin 테스트에는 원본과 배포 번들의 일치 검사와 설치 없는 stdio 초기화 검사가 포함된다.
실제 운영 API를 호출하지 않으며 모든 HTTP 호출은 fetch 대역으로 검증한다.
