# skill-creator 4축 평가 — apartment-daily-report (phase-01)

평가 대상: `apartment/.claude/skills/apartment-daily-report/SKILL.md` (한국어화 전 영문 버전)
평가 기준: skill-creator 4축 (trigger keyword 적정성 / workflow 명확도 / boundary 누락 / 비대 압축 후보)

## 1. Trigger keyword 적정성

### 현황

- `description`이 전부 영문 — 한국어 자연어 트리거와 매칭 불가
- 슬래시 명령 `/apartment-daily-report` 언급 없음
- "building or running a repeatable local reporting pipeline" — 실행 의도를 가진 사용자가 쓸 법한 표현이 아님
- "OpenClaw cron" — 구현 세부 사항, 트리거 용도 없음

### 개선안

- `description` 한국어화 + 따옴표 trigger phrase 추가
  - "일일 리포트 실행해줘"
  - "오늘 아파트 시세 확인해줘"
  - "매물 현황 수집해줘"
  - "아파트 보고서 돌려줘"
- 슬래시 명령 `/apartment-daily-report` 명시
- "OpenClaw cron" 제거 — 구현 세부 사항으로 trigger 가치 없음

### 적용 결과

description 전면 한국어화 + trigger phrase 4개 + 슬래시 명령 추가.

## 2. Workflow 명확도

### 현황

- 10단계가 단순 나열 — 입력/출력 흐름 불명확
- 3단계 출력 파일 목록이 슬래시 나열 (`report.md / raw-search.json / summary.json`) — docs-style.md 패턴 2 위반
- 정규화 단계(`normalize_results.ts`)가 workflow에 없음 — `Files` 섹션에만 언급
- Naver browser fallback 트리거 조건 불명확 ("may use" — 언제 쓰나?)
- 단계 9(OpenClaw wrapper 유지)는 workflow 단계가 아니라 운영 규칙

### 개선안

- 수집 → 정규화 → 합성 3단계 명확화
- 정규화 단계(`normalize_results.ts`) workflow에 추가
- Naver browser fallback 조건 명시: `status: not_found` 또는 `error`일 때
- OpenClaw wrapper 유지 규칙 → 아키텍처 섹션으로 이동

### 적용 결과

3단계 구조로 재편. 정규화 단계 명시. fallback 조건 명확화.

## 3. Boundary 누락 항목

### 현황

`Guardrails` 섹션 4개 항목 존재:
- 수집 웹 콘텐츠 untrusted 취급
- 재현 가능한 파일 산출물 선호
- 소스 불가 시 명시 기록
- 동일 날짜 멱등 유지

누락된 경계 규칙:
- 가격·수량 발명 금지가 workflow step 7에 묻혀 있음 — 경계로 재표현 필요
- 불확실성 섹션 생략 금지 없음
- `~/.openclaw/` 수정 금지 없음 (글로벌 `openclaw_safety` directive 재확인)
- 타깃 단지명 hard-code 금지 없음

### 개선안

명시적 "해야 할 것 / 하지 말아야 할 것" 목록으로 재편:

- 하지 말아야 할 것 추가
  - 가격·수량 없으면 발명하지 않는다 (소스 실패 시 raw 보존)
  - 불확실성 섹션 생략하지 않는다
  - `~/.openclaw/` 아래 파일 직접 수정하지 않는다
  - 타깃 단지명을 SKILL.md 또는 스크립트에 hard-code하지 않는다

### 적용 결과

"해야 할 것 / 하지 말아야 할 것" 2개 그룹으로 경계 섹션 재편. 4개 누락 항목 추가.

## 4. 비대 압축 후보

### 현황 (원본 총 80줄)

- `Required report sections` 섹션 — `references/claude-prompt.md`의 리포트 구조와 중복
- `Architecture note` 3 bullets — 핵심 1개 + 부가 2개로 압축 가능
- Status 블록쿼트 — 코드/문서가 아닌 운영 상태 정보, AGENTS.md나 주석에 적합
- `Files` + `External dependencies` 두 섹션이 개념상 유사 — 통합 가능

### 압축안

- `Required report sections` 삭제 → "리포트 구조는 `references/claude-prompt.md` 참조" 1줄 대체
- `Architecture note` 3줄 → 단일 섹션 2줄 압축
- Status 블록쿼트 → 개요 섹션의 한 문장으로 흡수
- `Files` + `External dependencies` → `파일 및 의존성` 단일 표(table)로 통합

### 적용 결과

원본 80줄 → 약 60줄. 중복 제거 + 섹션 통합.

## 최종 적용 항목 요약

| 축 | 발견 항목 | 적용 여부 | 비고 |
|---|---|---|---|
| Trigger | description 영문 → 한국어 + trigger phrase 4개 | 적용 | 슬래시 명령 추가 |
| Trigger | "OpenClaw cron" 제거 | 적용 | 구현 세부 → 불필요 |
| Workflow | 수집/정규화/합성 3단계 흐름 명확화 | 적용 | |
| Workflow | normalize 단계 명시 | 적용 | 누락 단계 보완 |
| Workflow | Naver fallback 조건 명시 | 적용 | |
| Boundary | 발명 금지 경계 재표현 | 적용 | workflow → 경계 섹션 이동 |
| Boundary | 불확실성 섹션 생략 금지 | 추가 | 누락 항목 |
| Boundary | `~/.openclaw/` 수정 금지 | 추가 | 누락 항목 |
| Boundary | 단지명 hard-code 금지 | 추가 | 누락 항목 |
| 압축 | Required report sections → 1줄 참조 | 적용 | |
| 압축 | Files + External dependencies 통합 | 적용 | |
| 압축 | Status 블록쿼트 → 개요 한 문장 | 적용 | |
| 압축 | Architecture note 압축 | 적용 | |
