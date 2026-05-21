# Skill-Creator 4축 리포트 — candidate-baseline-suggester

plan028 phase-02 / 2026-05-21

---

## 축 1. Trigger keyword 적정성

### 현재 트리거 (frontmatter + When to use)

- "후보자 프로필 갱신" / "후보자 프로필 갱신해줘"
- "baseline 약점·강점 평가 업데이트" / "baseline 약점·강점 업데이트"
- "fos-study 학습 결과 프로필에 반영해줘"
- "/candidate-baseline-suggester" 슬래시

### 누락 트리거 (추가 대상)

| 누락 표현 | 추가 이유 |
|---|---|
| "프로필 업데이트" | "갱신"보다 짧은 동의어 — 자연스러운 요청 형태 |
| "baseline 갱신" | "업데이트"보다 짧은 동의어 |
| "학습 내용 반영" | 학습 완료 후 자연어 요청의 전형 |
| "weak_spots 갱신" | study-progress.json 집중 요청 시 |

### 결정

frontmatter description 끝에 4개 trigger 추가. When to use에 자연어 예시 2개 추가.

---

## 축 2. Workflow 명확도

### 강점

- 4-1 → 4-2 → 4-3 → 4-4 흐름이 명확하고 이전 단계 결과가 다음 단계로 전달되는 경로가 명시.
- 4-2 A/B/C/D 서브 단계별 역할 분리 명확.
- Self-check 7항목이 Append 모드 불변식을 구체적으로 보장.
- Error handling 표가 예외 경로마다 처리 방법 명시.

### 개선 지점

1. **no-op 조건 미명시**: 신규 commit 없음 / outdated weak_spots 없음 시 동작이 불분명. "변경 없을 때도 audit trail 생성"이라는 조건이 없음.
2. **Self-check 서두 항목 수 불일치**: "아래 5항목 검증"이라고 했으나 실제 체크 항목은 7개 (1~7번). → `5항목` → `7항목` 수정.
3. **"4-" 접두사 맥락 부재**: `### 4-1`, `### 4-2` 는 `## Workflow` 내 하위 단계인데 "4-" 접두사 근거가 없어 처음 읽는 독자에게 혼란. 기능 동작 영향 없음 — 리라이트 X.

### 결정

- no-op 조건 1줄 추가 (4-3 말미).
- Self-check 서두 `5항목` → `7항목` 수정.

---

## 축 3. Boundary 누락 점검

| 핵심 정책 | 명시 여부 | 위치 |
|---|---|---|
| 기존 본문 줄 삭제 절대 금지 | ✅ | 4-3 첫 줄 |
| outdated 항목 주석 마킹만 (덮어쓰기 X) | ✅ | 4-3 약점 섹션 + Self-check 5 |
| audit trail 없이 자산 갱신 금지 | ✅ | 4-1 말미 |
| 자동 commit 하지 않음 | ✅ | 호출 패턴 말미 |
| `_missing_note` 기존 항목 제거 절대 금지 | ✅ | 4-3 baseline 섹션 |
| 이력서 자동 교체 X — 사용자 결정 | ✅ | 4-2.D |
| **no-op 시 audit trail 생성 의무** | ❌ 누락 | → 4-3 말미에 추가 |

---

## 축 4. 비대 압축 후보

### 섹션별 크기 분석 (12065 bytes 기준)

| 섹션 | 대략 크기 | 압축 가능 여부 |
|---|---|---|
| 4-1 bash block (backup mkdir + cp) | ~320 bytes | ✅ bash ops → references 분리 가능 |
| 4-2 A/B/C 분석 로직 | ~1.3KB | ❌ 실행 컨텍스트 필수 inline |
| 4-2.D 이력서 탐지 상세 | ~680 bytes | ✅ 보조 흐름 — 핵심 요약만 inline, 알고리즘 references 분리 |
| 4-3 JSON format 블록 (baseline append + missing_note) | ~550 bytes | 부분 압축 — inline 단축 표현으로 대체 |
| 4-3 weak_spots JSON 블록 | ~350 bytes | ❌ 실행 시 즉시 참조 필수 |
| 4-4 bash block (after/diff) + changes.md 템플릿 | ~1.1KB | ✅ references 분리 가능 |
| Self-check 7항목 | ~700 bytes | ❌ 실행 검증 필수 inline |
| Error handling 표 | ~520 bytes | ❌ 예외 경로 inline 필수 |
| Why this design | ~420 bytes | ❌ ADR-028 맥락 보존 필요 |

### 압축 결정 요약

→ `phase-02-compaction-decision.md` 참조.

---

## 종합 평가

| 항목 | 현황 | 조치 |
|---|---|---|
| Trigger 완성도 | 60% — 짧은 동의어 누락 | 4개 추가 |
| Workflow 명확도 | 85% — 항목 수 오기 + no-op 미명시 | 2건 수정 |
| Boundary 완결성 | 92% — no-op 조건 1개 누락 | 1건 추가 |
| 크기 효율성 | 12KB — 압축 여지 있음 | references/ 분리 |
