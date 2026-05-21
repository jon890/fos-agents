# Phase-01-B: daily-stock-analysis-note skill-creator 4축 검토 리포트

작성일: 2026-05-21
대상: `stock-investment/.claude/skills/daily-stock-analysis-note/SKILL.md`

## 1. 트리거 키워드 적정성

**현황:**
description이 "Generate and publish one daily Korean blog-style AI/tech stock observation note..."로 시작하는 영문.
자연어 trigger phrase 목록이 없음.

**발견 문제:**
- 한국어 사용자가 "오늘 종목 분석 노트 써줘" 또는 "NVDA 블로그 노트 작성해줘"라고 입력해도 skill 트리거 불확실.
- cron payload (b88e9a4d)는 영문 메시지 "Run the daily AI/tech stock Korean blog note workflow for today."로 직접 명령 — SKILL.md 설명과 별도로 동작.

**개선 (적용):**
- 한국어 자연어 trigger phrase 3개 추가.
- 슬래시 명령 `/daily-stock-analysis-note` 명시.
- cron 09:00 Asia/Seoul 트리거 명시.

## 2. 워크플로 명확도

**현황:**
Invocation 섹션에 bash 명령 + 선택 옵션 포함.
그러나 스크립트 경로가 구 경로 참조.

**발견 문제:**
```
# 구 경로 (SKILL.md 원본, 오류)
~/ai-nodes/stock-investment/skills/daily-stock-analysis-note/scripts/run_daily_note.sh

# 정상 경로 (AGENTS.md + 실제 파일시스템 기준)
~/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh
```

**cron payload 정합 확인:**
cron payload (b88e9a4d)는 `SKIP_NOTIFY=1 ~/ai-nodes/stock-investment/scripts/daily-stock-analysis-note/run_daily_note.sh` 경로 사용.
SKILL.md 수정 후 경로 일치 확인됨.

**개선 (적용):** 스크립트 경로를 ADR-006 분리 패턴에 맞게 수정.

## 3. 경계 정의

**현황:** Policy 섹션에 6개 항목 — 관찰 후보/분석 후보 프레임, 매수/매도 금지, 유니버스 한정, 발행 대상 명시.

**발견 문제:**
- Policy 항목 일부가 영문/한국어 혼재 (ex. `관찰 후보 / 분석 후보`는 한국어, 나머지 설명은 영문).
- Discord 전송과 fos-study 발행의 분리 조건이 명시적이나, SKIP_NOTIFY=1 vs SKIP_PUSH=1 옵션의 의미 설명 없음.

**개선 (적용):**
- Policy 전체 한국어화.
- 선택 옵션 2개를 별도 code block으로 분리해 가독성 향상.

## 4. SKILL.md 비대 여부

**현황:** 1568 bytes.
**판정:** 적정. 압축 불필요.

## 종합

| 축 | 원본 | 개선 후 |
|---|---|---|
| 트리거 적정성 | 영문 description, trigger 없음 | 한국어 trigger 3개 + 슬래시 + cron 09:00 명시 |
| 워크플로 명확도 | 스크립트 경로 오류 | ADR-006 실경로로 수정, cron payload 정합 확인 |
| 경계 정의 | 한/영 혼재 Policy 6개 | 한국어 6개, 선택 옵션 분리 |
| 비대 여부 | 1568 bytes | 적정, 압축 불필요 |

**차단 조건 해당 없음:** cron payload 변경 불필요 (payload 메시지는 영문 직접 명령 방식), 종목 코드 보존 완료.
