# plan071 discovery audit

Phase 01 실행자가 채우는 감사 산출물이다.
실측 없이 수치를 쓰지 않는다.

## 감사 일시

- 실행 일시 UTC:
- 실행 commit:
- 실행 명령:

## adapter별 현황

| source | adapter 파일 | discovery entrypoint | 개별 공고 URL seed | 현재 수집량 | AI 관련 공고 수 | source diagnostics | 조치 |
|---|---|---|---|---:|---:|---|---|
| toss | `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` |  |  |  |  |  |  |
| wanted | `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` |  |  |  |  |  |  |
| kakaopay | `career-os/scripts/position-recommender/live-postings/adapters/kakaopay.ts` |  |  |  |  |  |  |
| kakaopay-securities | `career-os/scripts/position-recommender/live-postings/adapters/kakaopay-securities.ts` |  |  |  |  |  |  |
| kakaomobility | `career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts` |  |  |  |  |  |  |
| naver-careers | `career-os/scripts/position-recommender/live-postings/adapters/naver-careers.ts` |  |  |  |  |  |  |
| coupang-careers | `career-os/scripts/position-recommender/live-postings/adapters/coupang-careers.ts` |  |  |  |  |  |  |

## 하드코딩 URL 후보

`rg` 실측 결과를 붙인다.
root entrypoint URL과 개별 공고 URL을 구분한다.

```text

```

## 기준선 snapshot

`--source all` 또는 source별 실행 결과를 붙인다.
명령이 없거나 실패하면 실패 모드와 stderr 요약을 기록한다.

```text

```

## phase 02 입력

- 제거 대상 개별 공고 URL seed:
- 유지 가능한 root/listing/API/sitemap entrypoint:
- PHASE_BLOCKED 후보:
