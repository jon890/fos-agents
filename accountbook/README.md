# accountbook

토스 소비 화면 같은 금융 스크린샷을 가계부 거래 후보로 변환하고 검증한 뒤 등록하는 워크스페이스다.

## 현재 범위

- vision 지원 agent가 토스 소비 화면을 읽는다.
- TypeScript 검증기가 날짜, 금액, 행 구조와 일별 합계를 검사한다.
- 대화형 후보는 사용자가 확정한 뒤 기존 accountbook 수입·지출 API에 등록한다.
- 주간 실행은 `weekly-safe-v1` 정책을 통과한 후보만 자동 등록한다.
- 이미지 해시와 private 등록 상태로 같은 실행의 중복 전송을 막는다.

OCR 엔진 자체를 제공하지 않으며 vision 입력을 지원하지 않는 runtime에서는 실행을 중단한다.
LangGraph나 별도 queue는 사용하지 않는다.

## 준비

`accountbook/.env.example`을 참고해 `accountbook/.env`를 만든다.
원본 이미지와 실행 산출물은 `accountbook/private/` 아래에 두며 git에 커밋하지 않는다.

## 실행

agent에서 다음 의도로 skill을 호출한다.

```text
/accountbook-screenshot-import <이미지 경로>
/accountbook-weekly-import --inbox accountbook/private/inbox/new --mode auto-safe
```

처음 실행은 후보 미리보기에서 멈춘다.
후보를 확인한 뒤 등록을 명시하면 기존 accountbook API를 호출한다.
주간 실행 시점과 iPhone 업로드 방식은 저장소 밖 runtime에서 설정한다.
권장 schedule은 매주 월요일 04:00 `Asia/Seoul`이다.

## 검증

```bash
bun test accountbook/scripts/accountbook-screenshot-import
bunx tsc --noEmit --strict --skipLibCheck --target ESNext --module ESNext \
  --moduleResolution bundler --allowImportingTsExtensions --types bun-types \
  accountbook/scripts/accountbook-screenshot-import/*.ts
python3 ~/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  accountbook/.claude/skills/accountbook-screenshot-import
```
