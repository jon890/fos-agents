---
name: knowledge-gap-analyzer
description: 후보자의 코드/문서 갭을 분석. baseline(전체 큐레이션 set)·daily(토픽 집중)·smoke(최소 점검) 세 모드. dispatcher의 baseline / daily / smoke 명령이 이 skill의 runner를 호출한다.
---

# knowledge-gap-analyzer

후보자의 학습 갭을 분석하고 study-progress를 갱신한다.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh baseline
career-os/scripts/command-router/run_now.sh daily [topic]
career-os/scripts/command-router/run_now.sh smoke
```

| 모드 | 설명 | 러너 |
|---|---|---|
| baseline | 큐레이션된 core 파일 전체 분석 (ADR-003) | `scripts/run_baseline.sh` |
| daily | 오늘의 토픽 집중 분석 (ADR-001) | `scripts/run_daily.sh` |
| smoke | 최소 파일 세트로 파이프라인 점검 | `scripts/run_smoke_test.sh` |

실행 파일: `career-os/scripts/knowledge-gap-analyzer/`(ADR-019).

## 입력

- `config/baseline-core-files.json` — baseline 대상 큐레이션 파일 목록
- `data/study-progress.json` — daily 토픽 선택 기반 (ADR-010)
- `sources/fos-study/` — 분석 대상 마크다운

## 산출물

- `data/reports/baseline/YYYY-MM-DD/report.md`
- `data/reports/daily/YYYY-MM-DD/report.md`
- `data/study-progress.json` — daily 완료 시 자동 갱신

## 관련 ADR

ADR-001: daily 토픽 선택 전략. ADR-002: 파일 선택 전략. ADR-003: baseline 단일 호출. ADR-014: 스터디 진행 추적.
