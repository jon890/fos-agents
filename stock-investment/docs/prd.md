# PRD — stock-investment

## 목적

AI 기술, 금융 시장, 암호화폐 흐름을 매일 수집하고 한국어 분석 노트를 만든다.
단일 사용자의 투자 공부와 시장 관찰을 돕는 로컬 워크플로다.

## 사용자

본인 1인.
매일 아침 브리핑, 현안 분석, 블로그 초안 생성을 반복한다.

## 현재 MVP

| 기능 | 산출물 | 빈도 |
|---|---|---|
| `stock-investing-morning-brief` | `data/YYYY-MM-DD/report.md` | 매일 또는 수동 |
| `current-issue-analysis` | `data/issues/YYYY-MM-DD/<issue-key>/report.md` | 수동 |
| `daily-stock-analysis-note` | `data/daily-notes/YYYY-MM-DD/report.md`, `data/publish/*.md` | 매일 또는 수동 |
| `stock-youtube-learning-digest` | 학습 영상 요약 | 후보가 있을 때 |

## 현재 관심 범위

- CRCL, BTC, GOOGL/GOOG, QQQ
- AI 반도체와 인프라
- 스테이블코인 규제
- Google AI와 개발자 행사
- 일일 분석 후보 풀에 등록된 미국·한국 종목

정확한 대상은 `config/` 파일을 따른다.

## 산출물 정책

- raw 수집 결과와 분석 리포트를 분리한다.
- 블로그 글은 `data/publish/`에 초안으로 만든다.
- 외부 발행, 외부 저장소 반영, 공개 URL 확인은 별도 승인된 단계에서 수행한다.
- 모든 분석은 개인 공부용이며 투자 권유가 아니다.

## 비기능 요구사항

- 같은 날 재실행해도 산출물 경로가 예측 가능해야 한다.
- 실패는 stderr, 종료 코드, 부분 산출물로 확인 가능해야 한다.
- 비밀값은 문서와 산출물에 노출하지 않는다.
- 검증된 사실과 추론을 구분한다.

## 비범위

- 매수·매도 주문
- 투자 자문
- 유료 금융 데이터 API 필수 의존
- 광범위 종목 전체 리포트
- 다른 워크스페이스나 외부 저장소 직접 수정
