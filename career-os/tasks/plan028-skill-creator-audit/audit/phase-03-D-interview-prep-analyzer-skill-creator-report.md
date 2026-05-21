# skill-creator 4축 리포트 — interview-prep-analyzer

plan028 phase-03-D / 2026-05-21

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (description + When to use)

description:
- "면접 준비 진단", "오늘 갭 점검", "<topic> 약점 분석"

When to use:
- "면접 준비 전체 진단", "baseline 갭 분석", "전반적인 학습 상태 점검", "진단해줘"
- "오늘 갭 점검", "daily 분석", "MySQL 인덱스 약점 분석", "오늘 공부할 내용 갭 확인"
- "학습 노트 기반 면접 갭 분석이 필요한 모든 경우"

### 누락 트리거

| 누락 표현 | 추가 이유 |
|---|---|
| "학습 갭 분석해줘" | "오늘 갭 점검"보다 명시적이고 자연스러운 표현 |
| "갭 점검해줘" | "오늘 갭 점검"의 날짜 비한정 동의어 |
| "준비 현황 분석해줘" | "면접 준비 진단"의 자연어 변형 |
| "오늘 학습 분석" | study-topic-recommender와 연계되는 자연어 흐름 |

### 결정

When to use 자연어 요청 예시에 4개 표현 추가.

---

## 축 2. Workflow 명확도

### 강점

- baseline / daily 분기 조건이 신호 목록으로 명확히 정의.
- daily 토픽 자동 선택 로직 3단계 (study-progress → topic-file-map → freeform) 명확.
- 각 모드별 보고서 구조(섹션 수, 파일 경로) 명확.

### 개선 지점

1. **Step 2 git sync 실패 후 계속 진행 시 경고 가시성**: "stderr warn + 로컬 캐시로 계속"라고 하는데, 최종 보고서에 "offline 분석" 표시 여부가 명시 안 됨. 리포트 독자가 offline 상태임을 알 수 없을 수 있음. → "git sync 실패 시 보고서 첫 줄 아래 warning 1줄 추가" 명시.
2. **Step 5 study-progress 갱신 시 기존 entry 없음 처리**: "entry 없으면 추가"라고 하는데, 기존 파일이 없으면 신규 생성한다는 내용이 있으나 JSON 스키마 형태가 불명확. → 현재 코드에 위임되는 구조이므로 추가 명시 불필요 — 이 개선 지점은 제거.

### 결정

Step 2 실패 처리 말미에 "보고서 offline 표시" 1줄 추가.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| 기본값 daily 모드 | ✅ | Step 1 모호 시 처리 |
| Kotlin 현재 MVP 제외 | ✅ | 공통 출력 규칙 |
| DB 약점 영역 우선 처리 | ✅ | 공통 출력 규칙 |
| self-check 재작성 최대 3회 | ✅ | Self-check |
| **fos-study publish 안 함 (비공개 리포트)** | ❌ 누락 | When to use에 없음 |
| **문서 작성 아님 — 분석·진단·리포트만** | ❌ 누락 | description에 없음 |
| 일반 학습 문서 생성은 study-pack-writer로 | ✅ | When to use 마지막 줄 |

### 결정

When to use 끝에 boundary 2줄 추가:
- "fos-study publish 안 함 — 비공개 career-os 리포트만 생성."
- "학습 문서 작성 아님 — 갭 진단·분석 전담. 실제 문서 생성은 `/study-pack-writer`로 위임."

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (7483 bytes 기준)

| 섹션 | 성격 | 압축 가능 여부 |
|---|---|---|
| 4-A baseline 7개 섹션 명세 | 실행 필수 참조 | ❌ inline 필요 |
| 4-B daily 5개 섹션 명세 | 실행 필수 참조 | ❌ inline 필요 |
| Self-check 6항목 | 검증 필수 | ❌ inline 필요 |
| Why this design (Python 6개 폐기, smoke 폐기) | ADR-027 맥락 | ❌ 결정 근거 유지 필요 |

### 압축 권장 (실제 적용 X — 12KB 미만)

7483 bytes — 즉각 압축 불필요.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 68% — 갭 분석 동의어 누락 | 4개 추가 |
| Workflow 명확도 | 87% — offline 상태 보고서 표시 미명시 | 1건 추가 |
| Boundary 완결성 | 78% — fos-study 비공개 + 문서 작성 아님 미명시 | 2건 추가 |
| 크기 효율성 | 7483 bytes — 즉각 압축 불필요 | 권장만 기록 |
