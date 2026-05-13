---
name: study-pack-batch
description: "특정 도메인의 부트캠프 모드로 study-pack 일괄 생성. config/topics.json의 bootcamp namespace에 정의된 토픽 큐에서 dailyRecommendCount만큼 추천하고 dailyGenerateCount만큼 study-pack-writer로 위임. dispatcher의 bootcamp-batch 명령이 이 skill의 runner를 호출."
---

## 역할

`config/topics.json`의 `bootcamp` namespace에 등록된 토픽 큐를 바탕으로 매일 일정량의 study-pack을 자동 생성한다.

## 산출물

- `data/runtime/bootcamp-summary.md` — 오늘의 추천+생성 요약 (실시간)
- `data/reports/daily/YYYY-MM-DD/bootcamp/` — 날짜별 사본
- 위임된 study-pack의 fos-study commit·push (study-pack-writer 담당)

## 설정

`config/topics.json` > `bootcamp` namespace:

| 키 | 의미 |
|---|---|
| `dailyRecommendCount` | 매일 추천할 토픽 수 (기본 10) |
| `dailyGenerateCount` | 매일 실제 생성할 토픽 수 (기본 5) |
| `topics` | 이 배치에 포함할 study-pack 토픽 키 목록 (study-pack namespace 기준) |

## 실행 방법

```bash
# dispatcher를 통한 표준 실행
career-os/skills/command-router/scripts/run_now.sh bootcamp-batch

# 직접 실행 (테스트/디버그)
TASK_ROOT=~/ai-nodes/career-os \
  career-os/skills/study-pack-batch/scripts/run_bootcamp_batch.sh

# 드라이런
DRY_RUN=1 TASK_ROOT=~/ai-nodes/career-os \
  career-os/skills/study-pack-batch/scripts/run_bootcamp_batch.sh
```

## 의존성

- `skills/study-pack-writer/scripts/resolve_study_pack_topic.py` — 토픽 키 → env 변수 리졸버
- `skills/study-pack-writer/scripts/run_study_pack.sh` — 개별 study-pack 생성 러너
- `config/topics.json` — bootcamp + study-pack namespace

## 관련 ADR

- ADR-011: study-pack-writer 분리
- ADR-014: 비용 측정 정책
- ADR-016: topic-pool-replenisher 분리
- ADR-017: plan005 WIP wire-up 분해 (본 skill = WIP 1/3)
