# skill-creator 4축 리포트 — study-topic-recommender

plan028 phase-03-A / 2026-05-21

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (description + When to use)

description:
- "오늘 뭐 공부할까" / "morning recommend" / "토픽 풀 갱신" / "live-coding 1개 골라줘"

When to use 자연어:
- "오늘 뭐 공부할까", "morning recommend", "오늘 학습 추천"
- "토픽 풀 갱신해줘", "추천 갱신", "study topic 추천"
- "live-coding 1개 골라줘", "live-coding seed 선택"
- "recommend-topics 실행", "morning 추천 돌려줘"

### 누락 트리거

| 누락 표현 | 추가 이유 |
|---|---|
| "아침 학습 추천" | "morning recommend" 영어 동의어의 한국어 pair — 자연어 요청 빈도 높음 |
| "공부 주제 추천해줘" | "오늘 뭐 공부할까"보다 짧고 직접적 동의어 |
| "토픽 추천해줘" | "토픽 풀 갱신해줘"보다 단순한 단축 형태 |
| "오늘 토픽 뭐야" | 아침 routine 문맥에서 흔히 나오는 질문 형태 |

### 결정

When to use 자연어 패턴에 4개 표현 추가.

---

## 축 2. Workflow 명확도

### 강점

- Step 1 → 2 → 2.5 → 2.6 → 3 → 4 흐름이 번호로 명확히 순서화.
- 각 step 산출물 파일 경로 명시.
- Error handling 표가 모든 예외 경로 커버.

### 개선 지점

1. **Step 2 → 2.5 진입 조건 분리**: Step 2(bun 스크립트 실행) 설명 안에서 `excluded.possibleDuplicates` 배열이 생성된다고 암묵적으로 가정하지만, Step 2 자체 설명에는 이 사실이 없음. → Step 2 산출물 목록에 "possibleDuplicates 배열 생성" 1줄 추가.
2. **promote 안내 분기 결과 누락**: Step 1 promote 후보가 있을 때 "사용자에게 안내 후 수정 권유"라고 하는데, 이후 흐름(계속 진행 or 대기)이 불명확. → "안내 후 Step 2로 계속 진행 (대기 X)"으로 명시.

### 결정

Step 2 산출물 목록에 possibleDuplicates 생성 언급 추가. Step 1 promote 처리 흐름에 "계속 진행" 명시.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| promote 안내만 (자동 수정 X) | ✅ | Step 1 말미 |
| RSS fetch 실패 시 캐시 사용 | ✅ | Error handling 표 |
| bun 미설치 시 exit 1 | ✅ | Error handling 표 |
| live-coding seed 선택은 옵션 | ✅ | Step 4 도입부 |
| **fos-study publish 안 함 (추천만)** | ❌ 누락 | When to use에 없음 |
| **실제 study pack 작성은 study-pack-writer로 위임** | ❌ 누락 | Step 4에 일부 있으나 boundary 섹션 없음 |
| 트리거 시점 정책은 외부 스케줄러 | ✅ | description 말미 |

### 결정

When to use 끝에 boundary 2줄 추가:
- "fos-study publish 안 함 — 토픽 추천만. 실제 문서 작성은 `/study-pack-writer`로 위임."
- "promote 후보 안내는 사용자 확인 후 수동 적용 — 자동 config 수정 안 함."

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (9300 bytes 기준)

| 섹션 | 성격 | 압축 가능 여부 |
|---|---|---|
| 알고리즘 상수 (RECENT_PENALTY 등) | 실행 참고용 | ✅ references/ 이동 가능 |
| Step 2.5 duplicate review JSON schema | 실행 시 즉시 참조 | ❌ inline 필요 |
| Self-check bash block | 검증 필수 | ❌ inline 필요 |
| Error handling 표 | 예외 경로 | ❌ inline 필요 |

### 압축 권장 (실제 적용 X — 12KB 미만)

`알고리즘 상수 블록` (~300 bytes) → `references/algorithm-constants.md` 분리 가능.
현재 크기 9300 bytes — 즉각 압축 불필요.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 70% — 짧은 한국어 동의어 누락 | 4개 추가 |
| Workflow 명확도 | 80% — Step 2→2.5 진입 조건 암묵적 | 2건 명시 추가 |
| Boundary 완결성 | 75% — fos-study publish 미명시 | 2건 추가 |
| 크기 효율성 | 9300 bytes — 즉각 압축 불필요 | 권장만 기록 |
