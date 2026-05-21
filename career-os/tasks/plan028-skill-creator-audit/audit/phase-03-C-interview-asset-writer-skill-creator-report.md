# skill-creator 4축 리포트 — interview-asset-writer

plan028 phase-03-C / 2026-05-21

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (description + When to use)

description:
- "질문 은행" / "qbank" / "experience-..." / "마스터 플레이북" / "master" / "playbook"
- "후보자 이력서·task 노트 기반 면접 자산이 필요하면 무조건 이 skill을 호출"

When to use:
- "AI 서비스팀 면접 질문 은행 만들어줘", "slot 팀 experience qbank 정리해줘"
- "시니어 백엔드 마스터 플레이북 만들어줘", "면접 master playbook 갱신"
- fos-study repo에 즉시 publish할 *후보자 이력 기반 면접 자산*이 필요한 모든 경우

### 누락 트리거

| 누락 표현 | 추가 이유 |
|---|---|
| "면접 자료 만들어줘" | 구체 형식(Q&A/플레이북)을 모를 때 사용자가 쓰는 포괄적 요청 |
| "경험 기반 질문 정리해줘" | "experience-..." topic-key 패턴의 한국어 자연어 대응 |
| "자기소개 플레이북 만들어줘" | 마스터 플레이북 핵심 섹션(자기소개)을 직접 언급하는 요청 |
| "면접 준비 자산 만들어줘" | "인터뷰 자산"의 한국어 pair — interview-prep-analyzer와 혼동 방지 포함 |

### 결정

When to use 자연어 요청 예시에 4개 표현 추가.

---

## 축 2. Workflow 명확도

### 강점

- 형식 판단(Q&A vs 마스터 플레이북) 기준이 topic-key 패턴 + 자연어 키워드 2축으로 명확.
- Self-check 5-A/5-B/5-C로 형식별 검증 항목 분리.
- stderr 결정 근거 로그 형식 예시 명시.

### 개선 지점

1. **Step 3 Overlap 점검 진행 조건 불명확**: "update 의도 확인"이라고 하는데, 비대화형(`claude -p`) 환경에서 어떻게 확인하는지 설명 없음. 사용자와 대화가 없으면 update 모드로 자동 진행인지 exit 1인지 불분명. → "비대화형 시 유사 파일 있으면 update 모드로 자동 진행" 1줄 추가.
2. **Step 4-A 형식 저장 경로와 Step 4-B 형식 저장 경로가 분리되어 있어** 실수로 서로 바뀔 위험 있음. 기능 동작 영향은 없으나 경로 명시가 각 서브섹션 첫 줄에 있어 현재도 명확 — 추가 조치 불필요.

### 결정

Step 3에 비대화형 환경 update 자동 진행 1줄 추가.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| 일반 기술 토픽 학습 문서는 study-pack-writer로 라우팅 | ✅ | When to use 마지막 줄 |
| AskUserQuestion 금지 (claude -p) | ✅ | Step 3-3 needs-user-confirmation 항목 |
| git pull 금지 (중복 가드 대상 외) | 해당 없음 | — |
| 메타 보고 문구 금지 | ✅ | Step 4 공통 출력 규칙 |
| self-check 재작성 최대 3회 | ✅ | Step 5 |
| **비대화형에서 모호한 형식 요청 시 기본값 Q&A 질문 은행** | ❌ 누락 | 본문에 "기본값 Q&A 질문 은행" 있으나 비대화형 처리 명시 없음 |
| **publish 경로: fos-study commit + push (비공개 X)** | ✅ | When to use + Step 6 |

### 결정

Step 1 형식 판단 끝에 비대화형 기본값 처리 1줄 추가:
"비대화형(`claude -p`) 환경에서 모호 → 기본값 Q&A 질문 은행으로 자동 진행 (exit 1 아님)."

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (8041 bytes 기준)

| 섹션 | 성격 | 압축 가능 여부 |
|---|---|---|
| Step 4-A Q&A 구조 상세 (6개 부속 섹션) | 실행 필수 참조 | ❌ inline 필요 |
| Step 4-B 마스터 플레이북 구조 | 실행 필수 참조 | ❌ inline 필요 |
| Self-check 5-A/B/C | 검증 필수 | ❌ inline 필요 |
| Why this design | ADR 맥락 | ❌ 4개 의사결정 근거 유지 필요 |

### 압축 권장 (실제 적용 X — 12KB 미만)

8041 bytes — 즉각 압축 불필요.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 68% — 포괄적 한국어 요청 형태 누락 | 4개 추가 |
| Workflow 명확도 | 83% — 비대화형 overlap 처리 불명확 | 1건 명시 추가 |
| Boundary 완결성 | 88% — 비대화형 기본값 처리 미명시 | 1건 추가 |
| 크기 효율성 | 8041 bytes — 즉각 압축 불필요 | 권장만 기록 |
