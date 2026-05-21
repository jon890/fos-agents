# docs-check SKILL.md — skill-creator 4축 검토 리포트

날짜: 2026-05-21
대상: `skills/docs-check/SKILL.md` (9516 bytes)

## 1. trigger keyword 적정성

### 현황

frontmatter description 트리거: "ADR 건전성 점검", "docs 감사", "stale ADR 찾기", "/docs-check"

When to use 트리거: "/docs-check [scope]", "ADR 건전성 점검", "docs 감사", "stale ADR 찾아줘", "ADR Quick Index sync 확인"

### 문제

- "docs drift 확인" 누락 — Decay 축 직접 호출 의도를 커버하지 못함
- "5문서 건전성 감사" 누락 — 종합 감사 키워드
- "코드-문서 불일치" 누락 — Decay 진입점
- "ADR 정리 전 감사" 누락 — plan 완료 후 cleanup 시나리오

### 적용

frontmatter description 트리거에 4개 추가. When to use에도 3개 보강.

---

## 2. workflow 명확도

### 현황

0~4단계 흐름과 자동화 bash 블록 5개 구조 양호. 각 축 판정 기준 구체적.

### 문제

자동화-4 (Dispatcher case coverage)가 career-os 전용인데 ai-nodes scope에서 실행 여부가 불명확하다. 헤더에 scope 조건 없음.

### 적용

자동화-4 헤더에 `(career-os scope 한정)` 명시 — ai-nodes-only scope에서 skip 근거 제공.

---

## 3. boundary 누락

### 현황

"사용자 승인 없이 docs 수정 금지" 문장이 4단계 본문에 포함되어 있음.

### 문제

명시적 "의도적으로 안 하는 것" 섹션 없음. plan-and-build / planning과 형식 불일치.

### 적용

섹션 추가 — 발견 전용 / 코드 변경 금지 / ADR 자동 삭제 금지 / scope 외 파일 감사 금지.

---

## 4. 비대 압축

9516 bytes — 12KB 임계 미달. 자동화 bash 블록 5개는 실행 명세로 압축 불가.

**결론: 현행 유지.**

---

## 개선 요약

| 축 | 판정 | 적용 |
|---|---|---|
| trigger keyword | 부족 — 4개 추가 | 적용 |
| workflow 명확도 | 자동화-4 scope 조건 누락 | 적용 |
| boundary | "의도적으로 안 하는 것" 섹션 없음 | 적용 |
| 비대 압축 | 양호 | 유지 |
