# Phase-01-C: stock-investing-morning-brief skill-creator 4축 검토 리포트

작성일: 2026-05-21
대상: `stock-investment/.claude/skills/stock-investing-morning-brief/SKILL.md`

## 1. 트리거 키워드 적정성

**현황:**
description이 "Generate a Korean morning stock/crypto investment brief from the 주식투자 ai-nodes workspace..."로 시작.
일부 한국어 포함이나 자연어 trigger phrase 목록이 없음.

**발견 문제:**
- "Use for daily 08:00 Asia/Seoul reports, smoke tests, and cron-backed Discord delivery" — "smoke tests"가 description에 있으나 SKILL.md 본문에 smoke test 방법 미기술.
- 사용자가 "모닝 브리핑 실행해줘"라고 입력할 때 skill 트리거 보장 안 됨.

**개선 (적용):**
- 한국어 자연어 trigger phrase 4개 추가.
- 슬래시 명령 `/stock-investing-morning-brief` 명시.
- cron 08:00 Asia/Seoul 트리거 명시.
- description에서 "smoke tests" 제거 — 별도 smoke test 스크립트 미존재, 수동 실행으로 대체.

## 2. 워크플로 명확도

**현황:**
Workflow 섹션에 Run 명령 + runner 동작 5단계 목록 포함.
그러나 스크립트 경로가 구 경로 참조.

**발견 문제:**
```
# 구 경로 (SKILL.md 원본, 오류)
~/ai-nodes/stock-investment/skills/stock-investing-morning-brief/scripts/run_report.sh

# 정상 경로 (AGENTS.md + 실제 파일시스템 기준)
~/ai-nodes/stock-investment/scripts/stock-investing-morning-brief/run_report.sh
```

**cron payload 정합 확인:**
cron payload (87efe34a)는 한국어 메시지: "stock-investment 모닝 브리핑을 실행해줘. `/home/bifos/ai-nodes/stock-investment/scripts/stock-investing-morning-brief/run_report.sh`를 실행하면 되고..."
SKILL.md 수정 후 경로 일치 확인됨.

**개선 (적용):** 스크립트 경로를 ADR-006 분리 패턴에 맞게 수정.

## 3. 경계 정의

**현황:** Guardrails 섹션에 4개 항목 — untrusted 콘텐츠, 부분 수집 명시, 가격 예측 금지, 투자 조언 금지.

**발견 문제:**
- Scope 섹션에 `stablecoin regulation / CLARITY Act / SEC / policy news` — 슬래시 4개 나열 (docs-style 패턴 2 위반).

**개선 (적용):**
- 위반 항목을 `스테이블코인 규제 동향: CLARITY Act, SEC 정책, 관련 뉴스`로 재구성 (슬래시 → 콜론+쉼표).
- Guardrails 한국어화.

## 4. SKILL.md 비대 여부

**현황:** 1886 bytes.
**판정:** 적정. 압축 불필요.

## 종합

| 축 | 원본 | 개선 후 |
|---|---|---|
| 트리거 적정성 | 영문 description, trigger 없음 | 한국어 trigger 4개 + 슬래시 + cron 08:00 명시 |
| 워크플로 명확도 | 스크립트 경로 오류 | ADR-006 실경로로 수정, cron payload 정합 확인 |
| 경계 정의 | 슬래시 4개 나열 위반 (패턴 2) | 콜론+쉼표 재구성, Guardrails 한국어화 |
| 비대 여부 | 1886 bytes | 적정, 압축 불필요 |

**차단 조건 해당 없음:** cron payload 변경 불필요 (payload 경로는 이미 정상), 종목 코드 보존 완료.
