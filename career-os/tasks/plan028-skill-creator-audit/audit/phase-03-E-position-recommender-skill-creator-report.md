# skill-creator 4축 리포트 — position-recommender

plan028 phase-03-E / 2026-05-21

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (description + When to use)

description:
- "내가 갈만한 포지션 추천", "지원 포지션 후보", "주기적 role-fit 추천 요청"

When to use:
- "내가 갈만한 포지션 추천해줘", "지원 포지션 후보 뽑아줘", "role-fit 분석해줘"
- "AI 서비스팀 백엔드 위주로 봐줘", "커머스·핀테크 중심으로", 특정 회사·팀 언급
- "최신 Wanted 공고 같이 봐줘", "Toss 채용 자동 수집해줘"
- 사용자 지정 파일 경로 직접 지정

### 누락 트리거

| 누락 표현 | 추가 이유 |
|---|---|
| "이직 추천해줘" | "포지션 추천"의 동기 맥락을 담은 자연어 — 이직 결정 단계에서 흔히 사용 |
| "어떤 회사에 지원할까" | role-fit보다 회사 선택 프레임으로 질문하는 유형 |
| "채용 공고 맞는 거 찾아줘" | collect_live_postings 흐름과 직접 연결되는 요청 |
| "job fit 분석해줘" | 영어 표현 선호 사용자가 쓰는 형태 |

### 결정

When to use 자연어 요청 섹션에 4개 표현 추가.

---

## 축 2. Workflow 명확도

### 강점

- Step 1이 선택적 실행(자연어 키워드 조건부)이라는 점 명확히 게이팅.
- 보고서 3-tier 구조(강력 추천/도전 추천/보류·주의)가 각 항목 필수 필드까지 명시.
- Self-check 4항목이 런타임 미러 파일까지 검증.

### 개선 지점

1. **Step 1 자동 수집 키워드 조건이 3개 예시만**: "최신 채용", "Wanted", "Toss 자동 수집" — 사용자가 "지원 공고 최신화해줘"나 "공고 가져와줘"를 쓰면 트리거 안 될 수 있음. → "실시간 채용" / "공고 가져와줘" 추가.
2. **Step 3 후보자 직접 포커스 키워드 반영 방법 불명확**: "자연어 포커스 키워드를 분석 컨텍스트에 반영"이라고 하는데, references 파일 안에서 어떻게 가중치를 주는지 설명 없음. 운용상 Claude 판단에 위임되는 구조 — 추가 명시 불필요.

### 결정

Step 1 수집 트리거 키워드 목록에 "실시간 채용" / "공고 가져와줘" 추가.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| fos-study publish 안 함 (비공개 리포트) | ✅ | description + When to use |
| 특정 회사명 hard-code 안 함 | 암묵적 | references 파일 통해 처리 — 명시 없음 |
| 수집 실패 시 수동 컨텍스트로 계속 | ✅ | Step 1 + Error handling |
| 날짜별 경로로 복수 실행 멱등 | ✅ | Step 4 + Why this design |
| **커피챗 전략은 interview-coffeechat-prep으로** | ❌ 누락 | When to use에 없음 |
| **학습 갭 분석은 interview-prep-analyzer로** | ❌ 누락 | When to use에 없음 |

### 결정

When to use 끝에 라우팅 boundary 2줄 추가:
- "커피챗 전략 리포트 → `/interview-coffeechat-prep` 으로 라우팅."
- "학습 갭·면접 준비 진단 → `/interview-prep-analyzer` 로 라우팅."

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (7037 bytes 기준)

| 섹션 | 성격 | 압축 가능 여부 |
|---|---|---|
| references 7개 파일 목록 | 입력 명세 | ❌ inline 필요 |
| Step 3 보고서 구조 (3-tier) | 실행 필수 참조 | ❌ inline 필요 |
| Self-check 4항목 | 검증 필수 | ❌ inline 필요 |
| Why this design (ADR-030 5개 결정) | ADR 맥락 | ❌ 결정 근거 유지 필요 |

### 압축 권장 (실제 적용 X — 12KB 미만)

7037 bytes — 즉각 압축 불필요.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 70% — 이직·공고 수집 동의어 누락 | 4+2개 추가 |
| Workflow 명확도 | 88% — 수집 트리거 키워드 미비 | Step 1 키워드 보완 |
| Boundary 완결성 | 80% — 연관 skill 라우팅 미명시 | 2건 추가 |
| 크기 효율성 | 7037 bytes — 즉각 압축 불필요 | 권장만 기록 |
