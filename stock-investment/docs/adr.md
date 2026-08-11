# ADR — stock-investment

stock-investment에만 적용되는 살아 있는 결정을 기록한다.
공통 결정은 [루트 ADR INDEX](../../docs/adr/INDEX.md)를 따른다.

## Quick Index

| ADR | 제목 | Status |
|---|---|---|
| ADR-003 | skill과 수집 코드의 실행 경계 | Accepted |
| ADR-004 | 쓰기 범위를 stock-investment 내부로 제한 | Accepted |

## ADR-003 — skill과 수집 코드의 실행 경계

- Status: Accepted
- Date: 2026-05-29

### 맥락

시장 데이터 수집은 결정론적 코드가 필요하고, 해석과 문서 작성은 agent workflow가 적합하다.
두 책임을 runner 하나에 섞으면 실행 도구와 결과 형식이 강하게 결합된다.

### 결정

- Python collector는 원천 데이터 수집과 정규화를 담당한다.
- 각 SKILL.md는 수집 결과를 읽고 분석 문서와 공개 가능한 요약을 만든다.
- runner는 로컬 파일, 표준 출력, 종료 코드만 외부 계약으로 둔다.
- 특정 agent CLI, 전달 채널, 외부 게시를 skill의 필수 동작으로 두지 않는다.

### 거절한 대안

- 수집까지 agent 추론에 맡기면 데이터 재현성과 오류 분리가 약해진다.
- 외부 전달을 runner에 넣으면 실행 환경에 종속된다.

### 결과

수집 실패와 분석 실패를 분리하고 같은 workflow를 여러 실행 도구에서 사용할 수 있다.

## ADR-004 — 쓰기 범위를 stock-investment 내부로 제한

- Status: Accepted
- Date: 2026-07-03

### 맥락

투자 분석 workflow가 다른 워크스페이스나 외부 저장소를 직접 수정하면 데이터와 승인 경계가 흐려진다.

### 결정

- 기본 쓰기 범위는 `stock-investment/` 내부로 제한한다.
- 다른 워크스페이스와 외부 저장소는 사용자가 대상과 목적을 명시한 경우에만 수정한다.
- 공개 글은 내부 초안으로 만들고 실제 발행은 별도 승인 단계로 둔다.
- 비밀 값은 워크스페이스 `.env`에만 둔다.

### 거절한 대안

- 다른 워크스페이스에 직접 발행하면 소유권과 검토 단계를 우회한다.
- 비밀 값을 문서나 skill에 기록하면 공개 저장소와 로그에 노출될 수 있다.

### 결과

stock-investment는 분석과 초안 생성까지 책임지고 외부 발행은 분리한다.
