# Phase 01 — freshness guard + rotation rule + cron payload 정리

**Status**: completed

## 목표

`position-recommender` daily cron이 같은 공고를 며칠째 반복하거나 stale runtime을 재전송하지 않도록 한다.

## 작업 항목

1. Claude native skill에 최근 7일 추천 이력 로드와 반복 후보 감점 규칙 추가.
2. daily cron 검증 wrapper 추가.
3. live posting collector에서 Toss career article이 기본 공고 목록에 섞이지 않게 변경.
4. OpenClaw wrapper와 career-os flow 문서 갱신.
5. OpenClaw cron payload에서 특정 공고/회사 우선 bias 제거.

## 검증 기준

- `scripts/position-recommender/run_daily_with_claude.sh` 문법 검증 통과.
- `collect_live_postings.ts` Bun 문법 검증 통과.
- cron payload가 wrapper를 호출하고 deleted command-router를 쓰지 않는다.
- cron payload에 `KakaoPay AX` 고정 우선 문구가 없다.

## 완료 기록

- `position-recommender/SKILL.md`에 daily 수집, 최근 7일 이력, 반복 감점, Asia/Seoul 날짜, stale-output self-check를 추가.
- `run_daily_with_claude.sh` 추가. Claude 실행 후 오늘 날짜 report/runtime을 검증하고 runtime stale이면 report로 미러링한다.
- `collect_live_postings.ts` 기본 `all` 수집에서 Toss career article을 제외하고, `--include-toss-articles` 또는 `--source toss`일 때만 포함한다.
- OpenClaw wrapper와 cron payload를 daily wrapper 중심으로 갱신.

