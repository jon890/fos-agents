# ADR — apartment

apartment에만 적용되는 살아 있는 결정을 기록한다.
공통 결정은 [루트 ADR INDEX](../../docs/adr/INDEX.md)를 따른다.

## Quick Index

| ADR | 제목 | Status |
|---|---|---|
| ADR-001 | Naver Land API 수집 경계 | Accepted |
| ADR-002 | 타깃 메타 단일 출처 | Accepted |
| ADR-003 | TypeScript와 워크스페이스 helper 경계 | Accepted |
| ADR-005 | 외부 HTTP 요청은 Bun fetch 사용 | Accepted |
| ADR-006 | collector는 module import로 조합 | Accepted |
| ADR-007 | 외부 응답은 zod로 검증 | Accepted |
| ADR-011 | 인테리어 결정은 HTML 뷰를 함께 제공 | Accepted |

## ADR-001 — Naver Land API 수집 경계

- Status: Accepted
- Date: 2026-04-24

### 맥락

Naver Land 화면 자동화는 차단과 UI 변경에 취약했다.
로그인 세션으로 접근 가능한 API는 단지 개요, 공식 시세, 매물 호가를 안정적으로 제공했다.

### 결정

- 수집 대상은 단지 개요, 시세, 매물 API로 제한한다.
- 쿠키는 `.env`의 `NAVER_COOKIE`로 주입한다.
- Bearer token은 브라우저 세션에서 추출하고 실패 시 `NAVER_BEARER`를 사용할 수 있다.
- 요청 간격과 재시도 제한을 두며 실패하면 다른 출처와 마지막 정상 snapshot으로 리포트를 완성한다.
- 인증 값과 응답 원문은 공개 리포트에 포함하지 않는다.

### 거절한 대안

- 화면 자동화는 차단과 UI 변경 비용이 크다.
- 인증 없는 비공식 호출은 재현할 수 없다.

### 결과

수집기는 필요한 데이터만 요청하고 인증 실패를 전체 리포트 실패로 확대하지 않는다.

## ADR-002 — 타깃 메타 단일 출처

- Status: Accepted
- Date: 2026-05-19

### 맥락

타깃 단지와 평형 정보가 runner와 config에 중복되면 변경 시 서로 어긋난다.

### 결정

- 타깃 메타는 `config/focus-unit.json`을 단일 출처로 둔다.
- 필수 값이 없으면 실행을 중단한다.
- 일회성 검증을 위한 명시적 환경 변수 override는 허용한다.

### 거절한 대안

- runner 기본값과 config를 함께 유지하면 두 출처를 계속 동기화해야 한다.

### 결과

타깃 변경은 config 한 곳에서 수행한다.

## ADR-003 — TypeScript와 워크스페이스 helper 경계

- Status: Accepted
- Date: 2026-05-19

### 맥락

수집과 정규화 코드는 JSON 처리와 타입 검증이 많아 TypeScript가 유지보수에 적합하다.

### 결정

- 결정론적 수집과 정규화 코드는 TypeScript와 Bun을 사용한다.
- 단일 skill 코드는 `scripts/<skill>/`에 둔다.
- 여러 apartment script가 공유하는 작은 helper만 `scripts/_lib/`에 둔다.
- helper는 다른 워크스페이스에서 직접 import하지 않는다.

### 거절한 대안

- 저장소 공용 helper로 올리면 apartment 데이터 구조가 공용 경계에 새어 나간다.
- JSON 처리를 shell에 넣으면 검증과 오류 처리가 어려워진다.

### 결과

apartment 실행 코드는 워크스페이스 안에서 타입과 소유권 경계를 유지한다.

## ADR-005 — 외부 HTTP 요청은 Bun fetch 사용

- Status: Accepted
- Date: 2026-05-19

### 결정

외부 HTTP 요청은 Bun의 표준 `fetch`를 사용한다.
재시도와 timeout은 호출 코드에서 명시한다.

### 거절한 대안

- 별도 HTTP package는 현재 필요한 기능보다 의존성 비용이 크다.

### 결과

추가 HTTP dependency 없이 표준 `Response` 인터페이스를 사용한다.

## ADR-006 — collector는 module import로 조합

- Status: Accepted
- Date: 2026-05-19

### 결정

`collect_sources.ts`는 각 collector의 함수를 import해 직접 호출한다.
프로세스 격리가 필요한 외부 도구만 subprocess로 실행한다.

### 거절한 대안

- 모든 collector를 subprocess로 호출하면 타입 정보와 오류 문맥을 잃는다.

### 결과

collector 반환 타입과 실패를 한 프로세스에서 검증할 수 있다.

## ADR-007 — 외부 응답은 zod로 검증

- Status: Accepted
- Date: 2026-05-19

### 결정

외부 API 응답은 zod schema로 검증한다.
필수 필드는 엄격히 확인하고 알 수 없는 부가 필드는 허용한다.

### 거절한 대안

- 검증 없는 JSON cast는 API 변경을 잘못된 리포트로 전파할 수 있다.

### 결과

응답 변경을 수집 단계에서 발견하고 불확실한 값을 리포트에서 제외할 수 있다.

## ADR-011 — 인테리어 결정은 HTML 뷰를 함께 제공

- Status: Accepted
- Date: 2026-06-14

### 맥락

인테리어 결정 기록은 Markdown이 추적에 유리하지만 사용자 검토에는 시각적 구분이 필요하다.

### 결정

- 결정 정본은 `docs/interior/`의 Markdown으로 유지한다.
- 사용자에게 보여줄 때는 확정, 미결정, 현장 확인 항목을 구분한 HTML을 함께 만든다.
- 외부 게시를 요청한 경우에만 `report-publisher`로 공개 범위를 점검하고 게시한다.

### 거절한 대안

- HTML만 정본으로 두면 diff와 장기 편집이 어려워진다.
- 자동 공개는 개인 주거 정보가 노출될 수 있다.

### 결과

Markdown의 추적성과 HTML의 읽기 경험을 함께 유지한다.
