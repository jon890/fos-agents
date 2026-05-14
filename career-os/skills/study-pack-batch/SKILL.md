---
name: study-pack-batch
description: "특정 도메인의 부트캠프 모드로 study-pack 일괄 생성. config/topics.json의 bootcamp namespace에 정의된 토픽 큐에서 dailyRecommendCount만큼 추천하고 dailyGenerateCount만큼 study-pack-writer로 위임. dispatcher의 bootcamp-batch 명령이 이 skill의 runner를 호출."
---

# study-pack-batch

`config/topics.json`의 `bootcamp` namespace 토픽 큐를 바탕으로 매일 일정량의 study-pack을 자동 생성한다.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh bootcamp-batch
```

드라이런:

```bash
DRY_RUN=1 career-os/scripts/study-pack-batch/run_bootcamp_batch.sh
```

실행 파일: `career-os/scripts/study-pack-batch/`(ADR-019).

## 입력

- `config/topics.json` (bootcamp namespace) — 배치 설정

| 키 | 기본값 | 의미 |
|---|---|---|
| `dailyRecommendCount` | 10 | 매일 추천 토픽 수 |
| `dailyGenerateCount` | 5 | 매일 실제 생성 수 |
| `topics` | - | bootcamp에 포함할 study-pack 토픽 키 목록 |

- `config/topics.json` (study-pack namespace) — 위임된 개별 study-pack 메타데이터

## 산출물

- `data/runtime/bootcamp-summary.md` — 오늘의 추천+생성 요약
- `data/reports/daily/YYYY-MM-DD/bootcamp/` — 날짜별 사본
- 위임된 study-pack의 fos-study commit·push (study-pack-writer 담당)

## 관련 ADR

ADR-011: study-pack-writer 분리. ADR-014: 비용 측정 정책. ADR-016: topic-pool-replenisher 분리. ADR-017: plan005 분해.
