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

- 회사별 키워드는 `verified-company-research-targets.json`만 남기고 `position-collection.json.targetKeywords`는 회사 비종속 role 키워드만 유지.
- 수집 코드가 두 소스(role 키워드 + 회사별 키워드)를 merge하도록 수정.
- 랭킹 방법론(rankingBias·downrankPatterns)을 `position-decision-criteria.md` 단일 출처로 이관하거나, config 유지 시 `_meta.purpose`에 "랭킹 정책 포함"을 명시해 이름-내용 불일치 해소(ADR 결정 따름).

## 성공 기준

- 회사별 키워드가 한 파일에만 존재(`grep`로 이중 기재 0 확인).
- 수집 실행(`bun collect_live_postings.ts`) 결과가 변경 전과 회귀 없음(수집 공고 수·source별 count 비교).
- 랭킹 규칙이 지정된 단일 위치에만 존재.

## 보류 조건

- 수집 결과가 변경 전 대비 유의미하게 줄면 merge 로직 재검토.

## 실패 조건

- 수집 실행 실패 또는 active/open 공고 0건.
