# 압축 옵션 평가 + 결정 근거 — candidate-baseline-suggester

plan028 phase-02 / 2026-05-21

---

## 옵션 평가

| 압축 옵션 | 예상 절감 | 리스크 | 결정 |
|---|---|---|---|
| A. references/audit-trail-format.md 분리 (4-1 bash + 4-2.D 이력서 탐지 + 4-4 bash + changes.md 템플릿) | ~2.8KB | 낮음 — 실행 시 references 로드 포인터 명시 | **채택** |
| B. append + 주석 마킹 동작 정책 분리 | ~2KB | 높음 — 동작 판단 핵심 정책이 분리되어 trigger 시 추론 비용↑ | 기각 |
| C. 압축 안 함 | 0 | 12KB 유지 지속 | 기각 |

---

## 채택 결정: 옵션 A

### 분리 대상 (→ references/audit-trail-format.md)

1. **Bash — 4-1 Backup**: `mkdir -p` + `cp` 3개 명령 블록
2. **4-2.D 이력서 탐지 상세**: `find` 명령 + 우선순위 알고리즘 + 출력 조건 분기
3. **Bash — 4-4 After/Diff**: after/ 스냅샷 + diff/ 파일별 bash 명령
4. **changes.md 구조**: 5+개 섹션 구조 + 각 항목 포맷

### SKILL.md inline 유지 항목

- frontmatter (강화된 트리거 포함)
- When to use (강화된 자연어 예시 포함)
- Inputs 5개
- Workflow:
  - 4-1: `$AUDIT_DIR` 변수 정의 + 디렉터리 생성 필수 정책 (bash 명령은 포인터)
  - 4-2: A/B/C 분석 로직 전체 inline, D는 핵심 요약 + 포인터
  - 4-3: 정책(append 금지, 마킹 형식) + JSON 단축 inline + **no-op 조건 추가**
  - 4-4: 헤더 + references 포인터 2줄
- Self-check 7항목 전체 (서두 `5항목` → `7항목` 수정)
- Error handling 표
- Why this design (ADR-028 3줄)
- 호출 패턴

### 절감 목표

- 현재: 12065 bytes
- 분리 + 4-3 JSON 단축 표현 후 목표: ~9.2KB (약 24% 절감)
- 분리 파일: `references/audit-trail-format.md` (~2.5KB)

---

## 차단 조건 확인

- [x] audit trail 동작 영향 없음 — bash 명령은 references에 포인터로 안내, Claude가 실행 전 references 로드
- [x] append + 주석 마킹 정책 변경 없음 — 정책은 SKILL.md inline 유지
- [x] 기존 자산 갱신 순서 변경 없음
- [x] 4-2.D 이력서 탐지 동작 변경 없음 — 핵심 정책(자동 교체 X) inline 유지, 알고리즘만 이동

---

## trigger 강화 결정

추가 (4개):
- "프로필 업데이트" — "갱신"의 자연 동의어
- "baseline 갱신" — "업데이트"의 자연 동의어
- "학습 내용 반영" — 학습 완료 후 전형 요청
- "weak_spots 갱신" — study-progress.json 집중 요청

When to use 자연어 예시 추가 (2개):
- "프로필 업데이트해줘"
- "weak_spots 갱신해줘"

## 버그 수정

- Self-check 서두 `5항목` → `7항목` (실제 7개 항목인데 텍스트가 5라고 명시된 오기)
- no-op 조건 추가: 변경 없을 때도 audit trail (changes.md `변경 없음 (0건)`) 필수 생성
