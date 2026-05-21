# skill-creator 4축 리포트 — interview-coffeechat-prep

plan028 phase-03-F / 2026-05-21

---

## 주의: ADR-007 보호 대상

interview-coffeechat-prep의 frontmatter description 패턴은 ADR-007 표준 사례.
description 내용 변경 금지 — trigger keyword 개선은 When to use 본문에만 적용.

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (description + When to use)

description (ADR-007 보호 — 변경 금지):
- "커피챗 준비", "회사 리서치", "면접 회사 분석"

When to use:
- "커피챗 준비해줘", "회사 리서치 해줘", "면접 회사 분석해줘", "커피챗 전략 보고서 만들어줘"
- 호출 빈도: 커피챗 일정 전 1회 이상, 신규 타깃 전환 후 첫 번째 실행

### 누락 트리거

| 누락 표현 | 추가 이유 |
|---|---|
| "회사 분석해줘" | "회사 리서치"의 짧은 동의어 |
| "기업 조사해줘" | "리서치"를 모르는 사용자의 자연어 표현 |
| "타깃 기업 준비해줘" | 능동적 면접 준비 프레임의 요청 형태 |
| "인터뷰 전 회사 공부" | 면접 직전 활성화 패턴에서 나오는 표현 |

### 결정

When to use 자연어 요청 예시에 4개 표현 추가.

---

## 축 2. Workflow 명확도

### 강점

- "회사 불가지론" 원칙이 SKILL.md 상단에 명시 — 회사명 hard-code 위험 제거.
- zod 파싱 first 패턴으로 진입 시점 스키마 오류 조기 실패.
- 수집 일부 실패(exit 2) vs 전체 실패(exit 1) 구분 명확.

### 개선 지점

1. **Self-check 최대 2회**: 다른 skill들은 모두 3회 cap. interview-coffeechat-prep만 2회인 이유가 명시 안 됨. 동작에는 문제 없지만 일관성 혼란 야기. → "리포트 분량 특성상 최대 2회 (재작성 비용이 다른 skill 대비 큼)" 1줄 추가.
2. **Step 3 컨텍스트 조립에서 manifest.json Read 위치**: manifest.json을 언급하지만 Step 2(수집)의 산출물로 명시되지 않아 독자가 "언제 생성되는가"를 역추적해야 함. → Step 2 수집 결과에 "manifest.json 생성" 언급 추가.

### 결정

Self-check 최대 2회 이유 1줄 추가. Step 2 산출물에 manifest.json 언급.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| 회사명 hard-code 금지 (mvp-target.json 단일 출처) | ✅ | SKILL.md 서두 + Step 1 |
| fos-study publish 안 함 (비공개 리포트) | ✅ | description + When to use |
| coffeechat 설정 없으면 exit 1 | ✅ | Step 1 + Error handling |
| 사이트 수집 전체 실패 시 exit 1 | ✅ | Error handling |
| **복수 기업 비교 분석 아님 (단일 active 타깃만)** | ❌ 누락 | 명시 없음 |
| **회사명 직접 입력 불필요 (mvp-target.json에서 자동 추출)** | ❌ 누락 | When to use에 없음 — 사용자가 회사명을 인자로 넘길 필요 없음을 알기 어려움 |

### 결정

When to use 끝에 boundary 2줄 추가:
- "회사명 직접 입력 불필요 — `mvp-target.json primary.coffeechat`에서 자동 추출."
- "단일 active 타깃 기준 실행 — 복수 기업 동시 비교 분석 아님."

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (6552 bytes 기준)

| 섹션 | 성격 | 압축 가능 여부 |
|---|---|---|
| Inputs 6개 파일 목록 (coffeechat 객체 필드 상세) | 실행 필수 참조 | ❌ inline 필요 |
| Step 3 컨텍스트 조립 (Read 목록) | 실행 필수 | ❌ inline 필요 |
| Step 4 리포트 구조 6개 섹션 | 실행 필수 참조 | ❌ inline 필요 |
| Self-check 4항목 | 검증 필수 | ❌ inline 필요 |
| Why this design (ADR-029 3개 결정) | ADR 맥락 | ❌ 결정 근거 유지 필요 |

### 압축 권장 (실제 적용 X — 12KB 미만)

6552 bytes — 가장 작은 skill. 즉각 압축 불필요.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 65% — "회사 분석"·"기업 조사" 동의어 누락 | 4개 추가 (description 변경 X) |
| Workflow 명확도 | 82% — Self-check 2회 이유 미명시, manifest.json 생성 시점 불명확 | 2건 추가 |
| Boundary 완결성 | 80% — 단일 타깃 + 회사명 입력 불필요 미명시 | 2건 추가 |
| 크기 효율성 | 6552 bytes — 즉각 압축 불필요 | 권장만 기록 |
