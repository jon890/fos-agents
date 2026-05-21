# planning SKILL.md — skill-creator 4축 검토 리포트

날짜: 2026-05-21
대상: `skills/planning/SKILL.md` (18430 bytes) — 압축 후보 1순위

## 1. trigger keyword 적정성

### 현황

frontmatter description 트리거: "/planning 호출 또는 "계획 세워보자" / "설계해보자" 요청 시 사용"

When to use 섹션 없음.

### 문제

- "plan 세워줘", "기획해줘", "task 파일 만들어줘", "구현 전 검토" 누락
- When to use 섹션 없어 docs-check / plan-and-build 형식 불일치

### 적용

frontmatter description 트리거 4개 추가. When to use 섹션 신설 (planning→plan-and-build 흐름 명시 포함).

---

## 2. workflow 명확도

### 현황

8단계 구조 명확. 단계 건너뛰기 가이드 있음. Critic 패턴 사전 소진 명시.

### 문제

6단계: "새 runner 추가 시 `claude_lib.sh` source + `claude_persist_usage` 호출 보장" — outdated.
claude_lib.sh는 ADR-031 (plan023)에서 폐기됨.

"dispatcher case 추가 시 `run_tracked()` 헬퍼 통과 보장" — run_tracked()도 폐기된 dispatcher 패턴 잔재.

### 적용

6단계 outdated 참조 2줄을 현재 패턴으로 대체: `_shared/bin/track_task.sh` 래핑 + AGENTS.md 참조.

---

## 3. boundary 누락

"의도적으로 안 하는 것" 섹션 있음. 단계 건너뛰기 가이드 있음.

**결론: 양호. 변경 없음.**

---

## 4. 비대 압축 (핵심)

18430 bytes — 12KB+ 임계 초과. 압축 1순위.

### 압축 후보 A — ADR 작성 원칙 섹션

- 위치: 7단계 내, 약 65줄
- 내용: ADR 가치 판단, ADR감/비ADR감, 단일 책임 원칙, 구조 표준, 넣지 않는 것, 이유
- 분리 목적지: `references/adr-writing.md` (신규 생성)
- 영향: 7단계에서 반드시 Read 로드 지시 명시 필요
- 결론: **분리 적용**

### 압축 후보 B — 5문서 공통 작성 원칙 섹션

- 위치: 7단계 내, 약 35줄
- 내용: 5문서 각 책임, 넣지 않는 것, 공통 금지 목록, 코드 블록 기준, 이유
- 분리 목적지: `references/5docs-policy.md` (신규 생성)
- 영향: 7단계에서 반드시 Read 로드 지시 명시 필요
- 결론: **분리 적용**

### 예상 압축 결과

- 현재: 18430 bytes
- 분리 후 메인: ~13000 bytes (약 5400 bytes 절감)
- references/adr-writing.md: ~3200 bytes (신규)
- references/5docs-policy.md: ~1700 bytes (신규)

12KB+ 임계는 여전히 상회하나 plan 사이클 동작에 직접 영향을 주는 섹션(완료 후 절차, 단계 건너뛰기 등)은 이번 phase에서 압축하지 않는다.

---

## 개선 요약

| 축 | 판정 | 적용 |
|---|---|---|
| trigger keyword | 부족 — 4개 추가 + When to use 신설 | 적용 |
| workflow 명확도 | 6단계 outdated 참조 (claude_lib.sh, run_tracked) | 적용 |
| boundary | 양호 | 유지 |
| 비대 압축 | references 분리로 ~5400 bytes 절감 | 적용 |
