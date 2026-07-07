# Phase 02 — 회사 키워드·AI 랭킹 규칙 단일화

**Model**: sonnet
**Status**: pending

## 목표

findings 높음 1번. 회사별 Wanted 키워드 이중 기재와 AI 랭킹/다운랭크 규칙 4곳 분산을 Phase 01 ADR 결정대로 단일 출처로 모은다.

## 중요 지침

구현 phase다. docs·ADR을 수정하지 않는다.
Phase 01 ADR의 단일 출처 결정을 그대로 따른다.

## 관련 파일

- `config/position-collection.json` (`wanted.targetKeywords`, `interestProfile.rankingBias`·`downrankPatterns`·`preferredPatterns`)
- `config/verified-company-research-targets.json` (`priorityCompanies[].wantedKeywords`)
- `.claude/skills/position-recommender/references/position-decision-criteria.md`
- `scripts/position-recommender/collect_live_postings.ts`, `scripts/position-recommender/live-postings/config.ts`

## 작업

- **착수 직전 baseline 캡처(필수)**: 편집 전 `bun collect_live_postings.ts`를 1회 실행해 수집 공고 수·source별 count를 스냅샷으로 저장한다. Phase 종료 시 이 baseline과 비교해 회귀를 판정한다.
- 회사별 키워드는 `verified-company-research-targets.json`만 남기고 `position-collection.json.targetKeywords`는 회사 비종속 role 키워드만 유지.
  - **비-priority 회사 처리는 ADR-103 방침을 따른다**: 기본은 verified에 저-tier `secondaryCompanies` 키워드 목록을 신설해 삼성SDS·LG CNS·SK*·현대오토에버·KT·카카오(corp)·카카오엔터프라이즈·카카오헬스케어·NAVER Cloud·Works Mobile 등 verified `priorityCompanies`에 없는 회사 키워드를 이관한다(수집 커버리지 유지). ADR-103과 다르면 PHASE_BLOCKED.
- 수집 코드가 여러 소스(role 키워드 + priorityCompanies 키워드 + secondaryCompanies 키워드)를 merge하도록 수정.
- 랭킹 방법론(rankingBias·downrankPatterns)을 `position-decision-criteria.md` 단일 출처로 이관하거나, config 유지 시 `_meta.purpose`에 "랭킹 정책 포함"을 명시해 이름-내용 불일치 해소(ADR-103 결정 따름).

## 성공 기준

- 회사별 키워드가 한 파일에만 존재(`grep`로 이중 기재 0 확인).
- 수집 실행(`bun collect_live_postings.ts`) 결과가 착수 직전 baseline과 회귀 없음(수집 공고 수·source별 count 비교). 특히 비-priority 회사(삼성SDS 등) 공고가 탈락하지 않았는지 확인.
- 랭킹 규칙이 지정된 단일 위치에만 존재.

## 보류 조건

- 수집 결과가 baseline 대비 유의미하게 줄면 merge 로직 재검토.

## 실패 조건

- 수집 실행 실패 또는 active/open 공고 0건.
