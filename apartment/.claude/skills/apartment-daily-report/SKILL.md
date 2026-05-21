---
name: apartment-daily-report
description: 아파트 매물 일일 시세 리포트를 자동 생성하는 apartment 워크스페이스 skill. 타깃 단지(현재 엘지원앙아파트)의 네이버부동산·호갱노노·KB랜드 수집 → 정규화 → Claude 합성까지 파이프라인 전체를 실행. "일일 리포트 실행해줘", "오늘 아파트 시세 확인해줘", "매물 현황 수집해줘", "아파트 보고서 돌려줘" 같은 자연어 요청 또는 `/apartment-daily-report` 슬래시.
---

# Apartment Daily Report

수집 → 정규화 → 합성 3단계 자동화 파이프라인.
소스별 데이터 품질이 부분적이므로 결과는 신중한 참고 자료로 취급한다 — 완벽한 시장 정보 피드가 아니다.

## 언제 사용하는가

- 사용자가 `/apartment-daily-report` 슬래시 호출
- 자연어: "일일 리포트 실행해줘", "오늘 아파트 시세 확인해줘", "매물 현황 수집해줘", "아파트 보고서 돌려줘"
- cron 스케줄(매일 08:00 Asia/Seoul) 진입 시

## 범위

타깃 단지:

- 단지명: 엘지원앙아파트 (LG원앙)
- 위치: 경기 구리시 수택동 854-2 / 체육관로 54
- 산출물 루트: `~/ai-nodes/apartment/data/YYYY-MM-DD/`

타깃 변경 시 `apartment/config/` 또는 `.env`에서 읽는다 — 이 SKILL.md에 단지명을 hard-code하지 않는다.

## 워크플로

### 1단계: 수집

```bash
bash scripts/apartment-daily-report/run_report.sh
```

- `TRACK_TASK_WRAPPED` 가드로 `_shared/bin/track_task.sh` 자동 래핑
- 네이버부동산 정적 수집 → `raw-search.json`
- 정적 수집 결과가 `status: not_found` 또는 `error`이면 `references/naver-browser-prompt.md` 프롬프트로 browser fallback 실행

### 2단계: 정규화

```bash
bun scripts/apartment-daily-report/normalize_results.ts
```

- 소스별 원시 데이터 → `summary.json` (정규화 구조체)

### 3단계: Claude 합성

```bash
claude --permission-mode bypassPermissions --print
```

- `references/claude-prompt.md` 프롬프트 + `raw-search.json` + `summary.json` 입력
- 산출물: `report.md`

리포트 구조는 `references/claude-prompt.md` 참조.

## 경계

**해야 할 것:**

- 소스 수집 실패 시 실패 사실을 명시적으로 기록한다
- 검증된 사실과 추론을 항상 구분한다
- 동일 날짜 재실행이 같은 결과를 내도록 멱등 유지

**하지 말아야 할 것:**

- 가격·수량이 없으면 발명하지 않는다 — 소스 실패 시 raw 보존
- 불확실성 섹션을 생략하지 않는다
- `~/.openclaw/` 아래 파일을 직접 수정하지 않는다 (wrapper는 위임·스케줄 글루만)
- 타깃 단지명을 이 SKILL.md 또는 스크립트에 hard-code하지 않는다

## 파일 및 의존성

| 항목 | 경로 | 용도 |
|---|---|---|
| 메인 러너 | `scripts/apartment-daily-report/run_report.sh` | 전체 파이프라인 실행 |
| 스모크 테스트 | `scripts/apartment-daily-report/run_smoke_test.sh` | 빠른 동작 확인 |
| 정규화기 | `scripts/apartment-daily-report/normalize_results.ts` | 원시 데이터 → summary.json |
| 합성 프롬프트 | `references/claude-prompt.md` | Claude 최종 합성 지침 + 리포트 구조 |
| Naver browser 프롬프트 | `references/naver-browser-prompt.md` | browser fallback 수집 지침 |
| 트래커 | `_shared/bin/track_task.sh` | 실행 로그·토큰 추적 |
| 결과 파서 | `_shared/lib/extract_claude_result.ts` | Claude JSON envelope → report.md (Bun) |

## 아키텍처

정식 구현체는 `~/ai-nodes/apartment/`.
`~/.openclaw/workspace/skills/apartment-daily-report/`는 위임·스케줄 글루만 담는 wrapper — wrapper 변경은 최소화한다.
