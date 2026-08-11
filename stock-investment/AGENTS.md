# AGENTS.md — stock-investment 워크스페이스

`stock-investment`는 주식·암호화폐 시장 관찰, 일일 분석, 블로그 초안 생성을 위한 독립 워크스페이스다.
이 파일은 행동 규칙과 라우팅만 담는다.
구조와 스키마는 `docs/`를 따른다.

## 읽기 순서

| 문서 | 책임 | 언제 보는지 |
|---|---|---|
| `README.md` | 범위, 설정, 실행, 검증 | 처음 사용하는 경우 |
| `docs/prd.md` | 제품 범위와 비범위 | 기능 추가, 우선순위 결정 |
| `docs/code-architecture.md` | 현재 디렉터리와 실행 구조 | 코드 구조 변경, 스크립트 추가 |
| `docs/data-schema.md` | config와 산출물 스키마 | 데이터 파일 변경 |
| `docs/flow.md` | 수집부터 결과 반환까지의 흐름 | 실행 흐름 변경, 디버깅 |
| `docs/adr.md` | 결정 이력 | 결정 이유 확인 |

## 작업 경계

- 쓰기 범위는 기본적으로 `stock-investment/` 내부로 제한한다.
- 다른 워크스페이스, 외부 git 저장소, `career-os/sources/fos-study`는 직접 수정하지 않는다.
- 블로그 발행 요청은 `data/publish/` 아래 초안과 메타데이터 생성으로 처리한다.
  실제 외부 반영, commit, push, 공개 URL 확인은 별도 승인된 발행 단계에서 수행한다.
- 비밀값은 `.env` 또는 실행 환경의 secret 저장소에 둔다.
  토큰, 쿠키, 세션, 계정 식별자는 문서와 로그에 쓰지 않는다.

## 분석 원칙

- 실시간 거래, 주문, 매수·매도 판단 자동화는 하지 않는다.
- 산출물은 개인 공부용 관찰과 분석 노트로 작성한다.
- 가격, 뉴스, 시각, 출처는 수집 raw와 분석 문장을 분리한다.
- 추정과 예측은 추정이라고 명시한다.
- 광범위 종목 풀을 임의로 확장하지 않는다.
  대상은 `config/`의 watchlist, current issue, daily universe를 따른다.

## 주요 진입점

| skill | 목적 | 주요 산출물 |
|---|---|---|
| `stock-investing-morning-brief` | 관심 종목과 테마의 아침 브리핑 | `data/YYYY-MM-DD/report.md` |
| `current-issue-analysis` | 특정 현안 심층 분석 | `data/issues/YYYY-MM-DD/<issue-key>/report.md` |
| `daily-stock-analysis-note` | 하루 1개 종목 분석과 블로그 초안 준비 | `data/daily-notes/YYYY-MM-DD/report.md`, `data/publish/*.md` |
| `stock-youtube-learning-digest` | 투자 학습 영상 후보 요약 | 실행별 요약 산출물 |

직접 실행과 검증 방법은 `README.md`와 `docs/flow.md`를 따른다.

## 변경 규칙

- 새 종목, 테마, 소스는 `config/`에 추가한다.
- 새 산출물 경로는 `docs/data-schema.md`에 먼저 정의한다.
- 새 실행 흐름은 `docs/flow.md`에 반영한다.
- 새 결정은 `docs/adr.md`에 누적한다.
