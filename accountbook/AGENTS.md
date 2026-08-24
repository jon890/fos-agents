# AGENTS.md: accountbook 워크스페이스

`accountbook`는 개인 가계부 입력 자동화를 관리하는 독립 워크스페이스다.
토스 같은 외부 화면에서 거래 후보를 추출하되, 검증되지 않은 결과를 가계부에 등록하지 않는다.

## 읽기 순서

| 문서 | 책임 |
|---|---|
| `README.md` | 실행 준비와 검증 명령 |
| `docs/prd.md` | 제품 범위와 성공 기준 |
| `docs/flow.md` | 추출, 검토, 등록 상태 흐름 |
| `docs/data-schema.md` | 후보와 등록 상태 스키마 |
| `docs/code-architecture.md` | skill과 결정적 script 경계 |
| `docs/adr/INDEX.md` | 기술 결정 |

## 금융 데이터 경계

- 원본 이미지, OCR 원문, 거래 후보, 인증 토큰과 등록 상태는 `private/`에만 둔다.
- `private/` 내용은 git에 커밋하거나 다른 워크스페이스에서 참조하지 않는다.
- 공개 문서와 fixture에는 실제 이름, 계좌, 카드, 가맹점, 금액을 넣지 않는다.
- 로그에는 인증 값, 원본 OCR 본문과 API 응답 본문을 남기지 않는다.

## 등록 안전 규칙

- vision 결과는 거래 후보일 뿐이며 결정적 검증을 통과하기 전에는 등록하지 않는다.
- 일별 수입·지출 합계가 화면 요약과 일치하지 않으면 자동 등록하지 않는다.
- 화면에서 잘린 날짜와 거래 시각을 추정해 채우지 않는다.
- 기존 거래와 같은 날짜, 금액, 설명이 발견되면 중복으로 단정하지 않고 `needs_review`로 멈춘다.
- 대화형 실행은 사용자가 후보를 확인하고 등록을 명시한 뒤에만 accountbook API를 호출한다.
- 주간 자동 실행은 `weekly-safe-v1` 정책을 모두 통과한 후보만 사용자 확인 없이 등록한다.
- 부분 성공 뒤 재실행할 때는 private 등록 상태를 확인하고 이미 성공한 후보를 다시 전송하지 않는다.

## 실행 경계

- skill은 이미지 검사, 후보 생성, 사용자 확인과 오류 복구를 조정한다.
- `scripts/accountbook-screenshot-import/`는 스키마 검증, 합계 계산과 API 등록을 담당한다.
- 스케줄러와 외부 agent runtime은 저장소 밖에서 선택한다.
- vision 입력을 지원하지 않는 runtime에서는 `OCR_UNAVAILABLE`로 중단한다.

## 현재 skill

| skill | 목적 |
|---|---|
| `accountbook-screenshot-import` | 토스 소비 화면을 검증된 수입·지출 후보로 변환하고 사용자 확인 뒤 등록 |
| `accountbook-weekly-import` | inbox의 신규 토스 화면을 주간 단위로 검증하고 안전 정책 통과분만 자동 등록 |
