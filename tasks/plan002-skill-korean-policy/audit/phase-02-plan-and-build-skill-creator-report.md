# plan-and-build SKILL.md — skill-creator 4축 검토 리포트

날짜: 2026-05-21
대상: `skills/plan-and-build/SKILL.md` (9539 bytes)

## 1. trigger keyword 적정성

### 현황

frontmatter description: 자연어 트리거 없음. 기능 설명만 있음.
When to use 섹션 없음.

### 문제

- "/plan-and-build" 슬래시 호출 언급 없음
- "task 실행", "phase 실행", "run-phases 실행", "구현 자동화", "백그라운드로 실행" 트리거 전무
- planning SKILL.md와 달리 When to use 섹션 없어 형식 불일치

### 적용

frontmatter description에 트리거 추가. When to use 섹션 신설 (planning 완료 후 실행 관계 명시 포함).

---

## 2. workflow 명확도

### 현황

1~6단계 구조 명확. 핵심 원칙 강조 있음.

### 문제

1. 3단계: `skills/planning/task-create.md`(아직 포팅 전이면 fos-blog 원본 참고) — outdated 주석. task-create.md는 현재 skills/planning/에 존재.
2. 첫 문단 "fos-blog repo의 동명 스킬을 포팅한 것..." — 포팅 경위 설명은 독자에게 불필요한 이력.
3. "### docs 피드백 루프 원칙 (ai-nodes 추가)" / "### 데이터 위치 원칙 (ai-nodes 추가)" — "(ai-nodes 추가)" 마킹이 현재 독자에게 의미 없음.

### 적용

3단계 outdated 주석 제거. 첫 포팅 경위 문단 제거. "(ai-nodes 추가)" 마킹 2개 제거.

---

## 3. boundary 누락

### 현황

"의도적으로 안 하는 것" 섹션 있음 — OK.

### 문제

"planning skill이 먼저, plan-and-build는 그 다음" 관계가 When to use에서 명시 없음. 독립 호출과 planning 후속 호출 구분 불명확.

### 적용

When to use에 "planning 완료 후 실행" 시나리오 명시.

---

## 4. 비대 압축

9539 bytes — 12KB 임계 미달.

index.json 스키마는 planning/task-create.md와 중복 가능하나, plan-and-build 단독 호출 시 독립성이 필요하므로 유지.

**결론: 현행 유지.**

---

## 개선 요약

| 축 | 판정 | 적용 |
|---|---|---|
| trigger keyword | 전무 — 트리거 추가 + When to use 신설 | 적용 |
| workflow 명확도 | outdated 주석 + 불필요 포팅 이력 제거 | 적용 |
| boundary | When to use에 관계 명시 | 적용 |
| 비대 압축 | 양호 | 유지 |
