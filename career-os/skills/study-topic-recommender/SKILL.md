---
name: study-topic-recommender
description: morning 학습 토픽 추천 파이프라인. inventory 갱신 + 점수·mix target·RSS 피드 기반 추천. live-coding seed pool에서 1개를 골라 study-pack-writer로 dispatch하는 wrapper도 포함한다.
---

# study-topic-recommender

토픽 인벤토리 기반 아침 학습 토픽 추천 + live-coding dispatch skill.

## 호출 방법

| 명령 | 설명 |
|---|---|
| `career-os/scripts/command-router/run_now.sh recommend-topics` | inventory 갱신 후 추천 마크다운 출력 |
| `career-os/scripts/command-router/run_now.sh live-coding-dispatch` | live-coding seed에서 1개 선택 → study-pack 위임 |

실행 파일: `career-os/scripts/study-topic-recommender/`(ADR-019).

## 입력

- `config/topics.json` — study-pack 토픽 정의
- `config/live-coding-seed-pool.json` / `live-coding-seed-candidates.json` — live-coding seed
- `config/sources.json` — tech-blog / AI / geek reservoir (ADR-013)
- `data/study-progress.json` — cooldown 계산 기반 (ADR-010)

## 산출물

- `data/runtime/topic-inventory.json` — 전체 토픽 풀 재고 + 추천 결과
- `data/runtime/topic-inventory-history.jsonl` — 추천 이력
- `data/runtime/morning-topic-recommendation.md` — 10픽 + 오늘의 3선 마크다운
- `data/runtime/live-coding-generated-topic.json` — live-coding 선택 결과 (study-pack으로 위임)

## 관련 ADR

ADR-009: reservoir. ADR-010: 점수 기반 선택. ADR-012: 10픽 mix target. ADR-013: feed discovery. ADR-017: skill 분해.
