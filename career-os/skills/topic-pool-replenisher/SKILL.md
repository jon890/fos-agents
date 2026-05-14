---
name: topic-pool-replenisher
description: "study-pack candidate reservoir 자동 보충 + primary auto-promotion(ADR-011). Claude subprocess를 직접 호출해 후보 토픽을 생성, 로컬 validator로 key/domain/tag/outputPath/prompt 검증 후 config/topics.json의 study-pack-candidates namespace에 append. 부족 시 candidate 일부를 primary로 promote."
---

# topic-pool-replenisher

`config/topics.json`의 study-pack-candidates namespace에 새 후보 토픽을 자동으로 보충하는 skill.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh replenish-topics
```

실행 파일: `career-os/scripts/topic-pool-replenisher/`(ADR-019).

## 입력

- `config/topics.json` (study-pack-candidates namespace) — 현재 후보 풀
- `config/topics.json` (study-pack namespace) — primary 토픽 (auto-promotion 대상)
- Claude subprocess — key · domain · tag · outputPath · prompt 포함 후보 생성

## 산출물

- `config/topics.json` — study-pack-candidates append, 필요 시 primary promote
- `data/runtime/topic-replenishment.json` — 실행 요약

## 관련 ADR

ADR-011: candidate reservoir + auto-promotion 정책.
ADR-014: topics.json 통합 스키마.
ADR-017: skill 분해 계획 (4번째 단계).
