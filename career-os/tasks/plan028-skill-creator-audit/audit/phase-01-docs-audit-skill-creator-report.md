# skill-creator 4축 검토 리포트 — docs-audit

대상: `career-os/.claude/skills/docs-audit/SKILL.md` (19603 bytes)
작성: plan028 phase-01 / 2026-05-21

---

## 축 1 — trigger keyword 커버리지 및 정확도

### 현황

frontmatter `triggers` 25개 + `description` 안 11개 trigger phrase.

### 문제점

| 문제 | 상세 |
|---|---|
| 의미 없는 context 트리거 | `"허브 심화 역할"`, `"큰 정리 직후"` — 사용자가 행동 요청으로 입력할 가능성 0에 가까움 |
| 결과 라벨이 트리거로 등록됨 | `"refresh-needed"` — 출력 분류 라벨, 입력 요청이 아님 |
| 자연어 패턴 누락 | `"링크 검사"`, `"링크 깨진 거"`, `"문서 건전성"`, `"fos-study 감사"`, `"문체 검사"` |
| 레거시 alias 미등록 | 본문에는 `/docs-link-audit` 구 이름 인식 언급 있으나 triggers 에는 없음 |
| description 중복 | triggers 배열과 description 안 phrase 가 대부분 겹침 — description 에는 **when to trigger** 가 유용하지만 word-for-word 반복은 낭비 |

### 권장 변경

제거: `"허브 심화 역할"`, `"큰 정리 직후"`, `"refresh-needed"`, `"문서 관계 파악"` (범위 모호)

추가:
- `"링크 검사"`, `"링크 깨진 거"`, `"문서 건전성"`
- `"문체 검사"`, `"문체 점검"`
- `"docs-link-audit"` (레거시 alias)

---

## 축 2 — 콘텐츠 배치 (inline vs references/)

### 현황

references/ 디렉터리 없음. 19KB 전부 SKILL.md 단일 파일.

### 섹션별 크기 추정

| 섹션 | 추정 크기 | 성격 |
|---|---|---|
| frontmatter + The Insight + 개요 표 | ~1.5KB | 워크플로 의사결정에 필요 — inline 유지 |
| Recognition Pattern | ~0.4KB | inline 유지 |
| Step A 축 1 — regex + Python 상세 | ~2.5KB | **구현 상세 — references/ 후보** |
| Step A 축 2 — broken link 절차 | ~1.0KB | **구현 상세 — references/ 후보** |
| Step A 축 5 — 가시성 + Python 코드 | ~2.2KB | **구현 상세 — references/ 후보** |
| Step A 축 6 — 문체 검사 코드 | ~1.5KB | **구현 상세 — references/ 후보** |
| Step B — sub-agent 위임 표 + YAML schema | ~1.8KB | schema spec — references/ 후보 |
| Step C — 결과 통합 | ~0.3KB | inline 유지 |
| 리포트 형식 (전체 템플릿) | ~2.5KB | **template — references/ 후보** |
| 수정 적용 단계 | ~0.7KB | inline 유지 |
| Quality Loop 전체 | ~4.5KB | 트리거 조건 + 분류 라벨 inline 필요; 상세 절차는 references/ 가능 |
| 안티패턴 | ~1.0KB | inline 유지 |
| 주기 + 참고 | ~0.3KB | inline 유지 |

### progressive disclosure 적합성

skill-creator 기준: SKILL.md 본문 500 lines 이하가 ideal.
현재 388 lines — 줄 수는 OK이나 **밀도가 높아** 에이전트 컨텍스트 비용이 큼.

Step A의 regex/Python 코드 블록은 에이전트가 **실제로 축 실행 시점에만 필요**한 구현 상세다.
스킬 트리거 시점(어떤 축을 실행할지 판단)에는 불필요 → references/ 분리 타당.

---

## 축 3 — 모드 분리도 (7축 구조 감사 vs Quality Loop)

### 현황

- 7축 구조 감사: 기본 모드 (docs-audit 직접 호출 시)
- Quality Loop: 명시 호출 모드 (특정 트리거 구문 사용 시에만)
- 게이팅 명확: "단순 docs-audit 호출 시에는 실행 안 함 (명시 호출 모드)"

### 별도 skill 분리 검토

| 항목 | 분리 시 | 유지 시 |
|---|---|---|
| 책임 경계 | 명확해짐 | 현재도 게이팅으로 구분 |
| 세션 흐름 | 두 skill 따로 호출해야 함 | 한 skill 안에서 모드 전환 자연스러움 |
| 컨텍스트 공유 | 7축 결과 → Quality Loop 연계 어려워짐 | 자연스러운 연계 유지 |
| SKILL.md 크기 효과 | ~4.5KB 감소 | Quality Loop 내용 전부 남음 |
| 사용자 인지 부담 | skill 2개 인지 필요 | 1개 skill, 2 모드 |

**결론: 분리 불필요.**
Quality Loop는 이미 잘 게이팅되어 있고, 7축 결과와 연계해 실행하는 게 자연스럽다.
대신 Quality Loop의 **운영 원칙 + 추천 사용 시점 반복 설명**은 references/ 로 이동 가능.

---

## 축 4 — boundary 누락

### 명시된 boundary (현재)

- 외부 URL 미검사 (안티패턴에 명시)
- 자동화/cron 불필요 (주기 섹션에 명시)
- `.html/.pdf/.png` 비-md 파일 링크화 금지 (안티패턴에 상세 설명)
- 앵커 완벽 검증 불가 (안티패턴에 명시)

### 누락된 boundary

| 누락 항목 | 영향 |
|---|---|
| **대상 저장소 명시 없음** | description은 "fos-study 저장소"라고 하지만, 사용자가 다른 저장소를 지정하면 동작 범위 모호 |
| **코드 파일 감사 아님** | `.ts/.py` 파일 언급 없음 — 코드 품질이나 코드 내 링크 검사 아님을 명시 안 함 |
| **맞춤법/문법 검사 아님** | 축 6 문체 검사는 특정 패턴만 (취소선·§·Bold 패턴) — 일반 맞춤법 아님 |
| **Quality Loop 가 기본 실행 아님** | description 에는 "추가로 Quality Loop 모드"라고 하지만 **기본은 off** 임을 description 에서 명확히 해야 함 |

### 권장 변경

description 에 한 줄 추가:
"Quality Loop 는 기본 실행 아님 — 명시 호출 시에만 (`quality-loop`, `diff 검증` 등)."

---

## 종합 요약

| 축 | 심각도 | 권장 조치 |
|---|---|---|
| 1. trigger 커버리지 | 낮음 | 4개 제거, 5개 추가 |
| 2. 콘텐츠 배치 | 높음 | Step A 상세 (~7.2KB) → references/axis-detail.md |
| 3. 모드 분리 | 없음 | 현 구조 유지, Quality Loop 운영 절차 일부 이동 가능 |
| 4. boundary 누락 | 낮음 | Quality Loop 기본 off 명시, 대상 저장소 명시 |

**압축 최우선 후보**: Step A 축 1~6 regex/Python 코드 + YAML sub-agent schema → `references/axis-detail.md`
예상 절감: ~7.2KB → SKILL.md 약 12KB 이하 달성 가능.
