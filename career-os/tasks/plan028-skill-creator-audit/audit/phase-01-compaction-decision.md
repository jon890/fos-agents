# 압축 옵션 평가 + 결정 근거 — docs-audit

plan028 phase-01 / 2026-05-21

---

## 옵션 평가

| 압축 옵션 | 예상 절감 | 리스크 | 결정 |
|---|---|---|---|
| A. references/axis-detail.md 분리 (Step A 코드 블록) | ~7.2KB | 낮음 — 실행 시점에 references 로드 | **채택** |
| B. Quality Loop 별도 skill 분리 | ~4.5KB | 높음 — 7축 결과 연계 끊어짐, 사용자 혼동 | 보류 |
| C. sub-agent YAML schema references/ 분리 | ~1.0KB | 낮음 | **채택** (A에 통합) |
| D. 리포트 템플릿 references/ 분리 | ~2.0KB | 중간 — 에이전트가 리포트 작성 시 참조 필요 | 보류 — 템플릿은 inline이 접근성 높음 |
| E. 압축 안 함 | 0KB | 19KB 유지 — 컨텍스트 비용 누적 | 기각 |

---

## 채택 결정: 옵션 A + C 통합

### 분리 대상 (→ references/axis-detail.md)

Step A 전체 구현 상세:
- 축 1 Unlinked path mention: ripgrep 패턴 2개 + Python 마스킹 코드 + 수정 제안 형식
- 축 2 Broken link: 추출 패턴 + Python 검증 절차
- 축 5 가시성·스캔 가능성: 검사 항목 4가지 + Python 전처리 코드 + 시그널 우선순위 + 의도적 줄글 필터
- 축 6 문체 정적 검사: Python 검사 코드 3종

Step B sub-agent 위임 상세:
- YAML 표준 schema (axis/findings/total 구조)
- 호출 시 프롬프트 예시

### SKILL.md inline 유지 항목

- frontmatter (name, description, triggers)
- The Insight (배경 + 7축 개요 표)
- Recognition Pattern (예시 구문 목록)
- 실행 순서 Step A — **축별 정의 + 핵심 규칙만** (코드 블록 제거, references 포인터 추가)
- 실행 순서 Step B — **호출 형식 표 + 메인 책임** (schema는 references 포인터)
- 실행 순서 Step C
- 리포트 형식 (전체 템플릿 inline 유지 — 에이전트가 리포트 출력 시 즉시 참조 필요)
- 수정 적용 단계
- Quality Loop 전체 (트리거·분류 라벨·운영 원칙 — 분리 시 모드 판단 불가)
- 안티패턴
- 주기·참고

### 절감 목표

- 현재: 19603 bytes
- 분리 후 목표: 12KB 이하 (약 38% 절감)
- 분리 파일: `references/axis-detail.md` (~7-8KB)

---

## 차단 조건 확인

- [x] fos-study 감사 동작 영향 없음 — 축 정의·판단 기준은 SKILL.md inline 유지, 코드만 이동
- [x] 7축 의미 변경 없음 — 정의·severity·수정 원칙 모두 inline 유지
- [x] Quality Loop 동작 변경 없음 — 전체 inline 유지
- [x] sub-agent 위임 동작 영향 없음 — 호출 형식 표는 inline 유지, schema spec만 이동

---

## trigger 강화 결정

제거 (4개): `"허브 심화 역할"`, `"큰 정리 직후"`, `"refresh-needed"`, `"문서 관계 파악"`

추가 (5개): `"링크 검사"`, `"링크 깨진 거"`, `"문서 건전성"`, `"문체 검사"`, `"docs-link-audit"`

description 끝에 1줄 추가:
"Quality Loop는 기본 실행 아님 — `quality-loop`, `diff 검증`, `문서 품질 루프` 등 명시 호출 시에만 작동."
