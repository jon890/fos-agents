# accountbook

토스 소비 화면 스크린샷을 가계부 거래 후보로 변환하고 검증한 뒤 등록하는 워크스페이스다.

## 현재 범위

- 이미지 인식을 지원하는 에이전트가 토스 소비 화면을 읽는다.
- MCP 도구가 날짜, 금액, 행 구조와 일별 합계를 검사하고 기존 기록과 대조한다.
- 사용자가 미리보기를 확인한 뒤 기존 accountbook 수입·지출 API에 등록한다.
- 같은 에이전트가 대화로 수입과 지출을 조회·등록·수정·삭제한다.

OCR 엔진 자체를 제공하지 않으며 이미지 입력을 지원하지 않는 실행 환경에서는 실행을 중단한다.
이미지와 거래 후보를 파일로 저장하지 않는다.

## MCP plugin

배포 단위는 `accountbook/plugin/`, plugin 이름은 `fos-accountbook` 0.2.0이다.
에이전트는 단일 `accountbook-api` 스킬을 통해 MCP 도구로 화면 가져오기와 조회·등록·수정·삭제를 한다.
fos-assistant는 [plugin 설치 계약](docs/code-architecture.md#plugin-설치-계약)과 `connector.json`을 읽고 사용자별 profile에 `accountbook` 서버를 설치한다.
사용자는 가계부 설정에서 발급한 연동 토큰을 fos-assistant에 등록한다.
런타임에는 Bun만 필요하며, 패키지 설치는 빌드하는 개발 환경에서만 수행한다.

## 실행

에이전트에 토스 소비 내역 스크린샷을 주고 가계부 등록을 요청한다.
처음 응답은 미리보기에서 멈춘다.
미리보기를 확인한 뒤 등록을 명시하면 accountbook API를 호출한다.

로컬에서 MCP 서버를 직접 띄울 때는 `accountbook/.env.example`의 환경 변수를 전달한다.
환경 변수의 의미는 [데이터 계약](docs/data-schema.md#환경-변수)을 따른다.

## 검증

```bash
bun install --frozen-lockfile --cwd accountbook/plugin
bun test ./accountbook/plugin
bun run --cwd accountbook/plugin typecheck
bun run --cwd accountbook/plugin build
claude plugin validate accountbook/plugin
```

위 명령은 `bun`이 PATH에 있어야 한다. 기본 설치 위치는 `~/.bun/bin`이다.
첫 줄의 의존성 설치를 건너뛰면 `@modelcontextprotocol/sdk`를 찾지 못해 서버 테스트와 번들 일치 검사가 실패한다.

plugin 테스트에는 원본과 배포 번들의 일치 검사와 설치 없는 stdio 초기화 검사가 포함된다.
실제 운영 API를 호출하지 않으며 모든 HTTP 호출은 fetch 대역으로 검증한다.
