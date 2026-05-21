# skill-creator 4축 리포트 — study-pack-writer

plan028 phase-03-B / 2026-05-21

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (description + When to use)

description:
- "/study-pack-writer <topic-key-or-자연어>" / "study pack 만들어줘" / "학습 정리해줘" / "스터디팩"
- "backend·db·infrastructure·언어·아키텍처 주제로 fos-study에 즉시 commit/push"

When to use:
- 사용자가 `/study-pack-writer <topic>` 슬래시 호출
- "MySQL 인덱스 study pack 만들어줘", "Redis 캐시 전략 학습 자료 정리해줘"
- "fos-study repo에 즉시 publish할 study pack이 필요한 모든 경우"

### 누락 트리거

| 누락 표현 | 추가 이유 |
|---|---|
| "fos-study에 <주제> 올려줘" | 사용자가 publish 의도를 직접 표현하는 전형적 형태 |
| "<주제> 공부 자료 만들어줘" | "study pack"이라는 단어를 모르는 사용자의 자연어 형태 |
| "<주제> 학습 문서 작성해줘" | "학습 정리해줘"의 자연스러운 변형 |

### 결정

When to use 자연어 예시에 3개 표현 추가.

---

## 축 2. Workflow 명확도

### 강점

- Duplicate guard 3-1 → 3-2 → 3-3 3단계가 결정 매트릭스(표)로 명확히 분기.
- Self-check 5항목 + 재작성 ≤3회 cap 명시.
- 안전 기본값 (needs-user-confirmation) 명시.

### 개선 지점

1. **Step 1 freeform 모드 진입 조건 로그 누락**: "freeform 모드: domain·outputPath 본인이 결정. stderr에 결정 근거 1줄 로그"라고 하나, 어떤 정보를 로그하는지 예시 없음. → 로그 예시 1줄 추가.
2. **Step 6 `git status --porcelain` 판단 기준 불명확**: `add` vs `update` 판단 로직이 "자동 판단"으로만 되어 있어 에이전트 입장에서 실행 근거 모호. → "신규 파일이면 add, 기존 파일 수정이면 update" 1줄 명시.

### 결정

Step 1에 freeform 로그 예시 추가. Step 6 add/update 판단 기준 명시.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| duplicate guard가 사용자 직접 호출 주제에도 적용 | ✅ | Step 3 도입부 |
| needs-user-confirmation → exit 1 (비대화형) | ✅ | Step 3-3 표 |
| AskUserQuestion 금지 (claude -p 패턴) | ✅ | Step 3-3 needs-user-confirmation 항목 |
| git pull 호출 금지 (로컬 clone 기준) | ✅ | Step 3-1 |
| **후보자 이력 기반 자산은 interview-asset-writer로 라우팅** | ❌ 누락 | When to use에 없음 (description에만 간접 언급) |
| publish 완료 후 commit hash Discord 알림 | ✅ | Step 7 완료 알림 형식 |

### 결정

When to use 끝에 라우팅 boundary 1줄 추가:
"후보자 이력·task 기반 Q&A 질문 은행·플레이북은 `/interview-asset-writer`로 라우팅 (본 skill은 기술 토픽 학습 문서 전담)."

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (8113 bytes 기준)

| 섹션 | 성격 | 압축 가능 여부 |
|---|---|---|
| Duplicate guard 3단계 상세 + decision 표 | 실행 필수 | ❌ inline 필요 |
| Self-check 5항목 | 검증 필수 | ❌ inline 필요 |
| Step 4 작성 규칙 (≥80줄, 펜스 언어 등) | 실행 필수 참조 | ❌ inline 필요 |
| Error handling 표 | 예외 경로 | ❌ inline 필요 |
| Why this design | ADR 맥락 | 축소 가능하나 8KB 수준에서 불필요 |

### 압축 권장 (실제 적용 X — 12KB 미만)

8113 bytes — 즉각 압축 불필요.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 72% — publish 의도 표현 누락 | 3개 추가 |
| Workflow 명확도 | 82% — freeform 로그 예시, add/update 기준 불명 | 2건 명시 추가 |
| Boundary 완결성 | 85% — 라우팅 규칙 When to use 부재 | 1건 추가 |
| 크기 효율성 | 8113 bytes — 즉각 압축 불필요 | 권장만 기록 |
