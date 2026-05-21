# skill-creator 4축 검토 리포트 — agent-browser

**대상 파일**: `skills/agent-browser/SKILL.md`
**검토 일자**: 2026-05-21
**검토 기준**: skill-creator 4축 (트리거 정확도 / 지시 완결성 / 산출물 명확성 / 강화 기회)
**검토자**: plan002 phase-01 실행 (oh-my-claudecode:executor)

---

## 축 1 — 트리거 정확도

### 개선 전 상태

frontmatter `description` 전체가 영문이었다.
한국어로 "브라우저 자동화해줘", "Naver Land 수집", "스크린샷 찍어줘" 등을 입력해도 이 skill이 매칭되지 않을 가능성이 높았다.

### 발견된 문제

- 영문 description → 한국어 트리거 구문 전혀 없음.
- "Naver Land", "apartment collection" 등 고유명사는 영문 그대로 유지해야 하지만, 나머지 트리거 문구는 한국어가 필요했다.
- "exploratory QA", "visible-page evidence gathering" 같은 표현은 한국어 사용자가 실제로 입력하지 않을 구문.

### 적용한 개선

```
트리거 키워드 추가: "브라우저 자동화", "페이지 클릭", "Naver Land 수집",
"스크린샷 찍어줘", "동적 페이지 크롤", "agent-browser"
```

Naver Land·agent-browser·hydration 등 고유명사는 영문 그대로 보존.

---

## 축 2 — 지시 완결성

### 개선 전 상태

영문 본문이었지만 워크플로 자체는 논리적으로 완결돼 있었다:

- 설치 → CLI 가이드 로드 → snapshot/ref 루프 → Naver Land 특화 흐름 → 아키텍처 역할

### 발견된 약점

- **실패 복구 안내 없음**: Chrome 공유 라이브러리 누락 케이스만 다루고, 페이지 로딩 실패 / snapshot 빈 결과 / wait timeout 케이스 미언급.
- **인증 페이지 처리 없음**: 로그인이 필요한 페이지에 대한 지침 없음.
- **추출 결과 형식 미정의**: "구조화 JSON"이라고만 명시 — 실제 스키마나 예시 없음.

### 적용한 개선

기존 흐름의 의미·정책은 유지하되 한국어화로 가독성을 높였다.
실패 복구·인증·결과 스키마 등 추가 지침은 phase-01 범위 밖 (의미 변경에 해당) → 별도 강화 plan으로 위임 권장.

---

## 축 3 — 산출물 명확성

### 개선 전 상태

산출물 명세가 암묵적:

- "Return structured JSON for downstream normalizers" — 어떤 JSON 구조인지 불명.
- 아키텍처 역할 섹션은 레이어 역할을 서술하지만, 실제 반환 계약은 없음.

### 적용한 개선

기존 문구를 한국어로 정확히 번역하여 의미 보존:

- "후속 정규화기가 처리할 수 있도록 구조화 JSON으로 반환" → 원문 의도 동일하게 유지.

산출물 스키마 정의는 이 skill 범위 밖 (apartment/AGENTS.md 또는 apartment/docs/data-schema.md에서 관리하는 것이 거울 구조 원칙에 부합).

---

## 축 4 — 강화 기회

plan002 phase-01 범위 안에서 적용 완료:

| 항목 | 적용 여부 | 비고 |
|---|---|---|
| frontmatter description 한국어화 | 완료 | 고유명사 영문 보존 |
| 본문 H2 헤더 한국어화 | 완료 | `## For apartment / Naver Land` → `## 아파트 / Naver Land 수집` 등 |
| 본문 prose 한국어화 | 완료 | CLI 옵션·파일 path·도구명 영문 유지 |
| docs-style.md 8 패턴 적용 | 완료 | 패턴 1·2·5·8 주로 적용 |
| 한국어 trigger 키워드 추가 | 완료 | description 끝에 트리거 키워드 나열 |

phase-01 범위 밖 강화 (후속 plan 권장):

- 실패 복구 가이드 (`wait` timeout, snapshot 빈 결과 처리)
- 인증 필요 페이지 처리 절차
- references/common-pitfalls.md 신설 (Linux 환경 이슈, hydration 타이밍 패턴)
- 추출 결과 JSON 스키마 예시

---

## 검증

- `name: agent-browser` — 영문 유지 ✓
- `description` — 한국어 + 고유명사 영문 보존 ✓
- 본문 H2 — 한국어 ✓
- CLI 명령·옵션·파일 path — 영문 ✓
- docs-style.md 패턴 1 (semantic line break) — 적용 ✓
- docs-style.md 패턴 2 (enumerated inline 금지) — 위반 없음 ✓
- docs-style.md 패턴 8 (헤더 + 본문 구조) — 적용 ✓
