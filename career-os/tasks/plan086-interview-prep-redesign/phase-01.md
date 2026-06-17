# Phase 01 — docs-first materialization (코드 변경 없음)

**Model**: sonnet
**Status**: pending

---

## 목표

plan086의 설계 결정을 docs에 선반영한다.
이 phase는 코드·스킬 파일을 건드리지 않는다 — docs 파일만 수정한다.

수정 대상:
- `career-os/docs/data-schema.md` — weak_spots 확장 필드·드릴 일별 로그·질문 풀 구조
- `career-os/docs/flow.md` — 새 스킬 흐름(job-fit-analyzer·tech-interview-drill·behavioral-interview-drill·interview-stage-prep) 추가
- `career-os/docs/code-architecture.md` — 스킬 구조·공용 드릴 엔진 배치 확정(ADR-019 scripts 분리·ADR-031 _lib 폐기 고려)
- `career-os/docs/prd.md` — 기능 표 갱신(신규 스킬·제거 스킬 반영)
- `career-os/README.md` 또는 적절한 docs 파일 — 스킬 역할·담당 파일·생성 파일·플로우차트 추가

**범위 외**:
- 스킬 파일(SKILL.md), scripts/, .codex/ 심링크, 실제 코드 수정 금지
- ADR 신규 작성 금지(ADR-092는 이미 존재)
- push·PR 금지

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

---

## 작업 항목

### 1. 현재 docs 현황 파악

```bash
cd "$(git rev-parse --show-toplevel)"
# 현재 스킬 목록 확인
ls career-os/.claude/skills/
# docs 파일 확인
ls career-os/docs/
# 기존 data-schema weak_spots 섹션 확인
grep -n "weak_spot" career-os/docs/data-schema.md | head -30
# 기존 flow.md 스킬 흐름 확인
grep -n "interview-prep\|baseline-suggester" career-os/docs/flow.md | head -20
```

### 2. data-schema.md 갱신

다음 내용을 반영한다:

**weak_spots 확장 필드** (`config/study-progress.json`의 `weak_spots`에 추가 — candidate-profile.md의 prose 약점 섹션과 혼동 금지):
- `question_id` — 연결된 질문 풀 ID (드릴 일별 로그와 연결)
- `pass_count` / `shallow_count` / `fail_count` / `unknown_count` — 답변 성과 누적 횟수
- `next_review_date` — 다음 복습 예정일 (간격 반복 스케줄, ISO 8601)
- `last_passed` — 마지막 통과 날짜 (ISO 8601, null이면 미통과)
- `status` — `active` | `retired` (충분히 통과 시 드릴에서 제외)

**드릴 일별 로그 schema** (신규, `data/runtime/drill-log-YYYY-MM-DD.jsonl`):
- `date` — ISO 8601 날짜
- `drill_type` — `tech` | `behavioral`
- `question_id` — 질문 풀 ID
- `question_text` — 실제 질문 문구
- `answer_summary` — 사용자 답변 요약 (1문장)
- `score` — `pass` | `shallow` | `fail` | `unknown`
- `topics` — 관련 토픽 배열 (예: `["JPA", "트랜잭션"]`)
- `study_pack_dispatched` — study-pack-writer 위임 여부 (boolean)

**질문 풀 구조** (신규, `data/question-bank/tech-questions.jsonl`, `data/question-bank/behavioral-questions.jsonl`):
- `id` — 고유 식별자 (예: `tech-001`)
- `type` — `tech` | `behavioral`
- `question` — 질문 문구
- `topics` — 관련 토픽 배열
- `difficulty` — `easy` | `medium` | `hard`
- `created_at` — 추가 날짜
- `source` — `question-bank-collector` | `manual`

### 3. flow.md 갱신

다음 스킬 흐름을 추가한다:

**job-fit-analyzer** (interview-prep-analyzer 리네임 + 리포커스):
- 입력: `config/mvp-target.json`, `config/candidate-profile.md`
- 처리: 타깃 직무 역할 단위 핏 분석 → 부족분 갭 진단
- 출력: `data/reports/job-fit-YYYY-MM-DD.md` (비공개)
- git push: 없음 (비공개 리포트)

**tech-interview-drill** (신규):
- 입력: `data/question-bank/tech-questions.jsonl`, `config/study-progress.json` weak_spots
- 처리: 질문 선정(간격 반복) → 대화 답변 → 3단계 채점 → 기록 → 약점 환류 → study-pack-writer 위임(비동기)
- 출력: `data/runtime/drill-log-YYYY-MM-DD.jsonl` (누적), `config/study-progress.json` weak_spots 갱신
- git push: 없음

**behavioral-interview-drill** (신규):
- 입력: `data/question-bank/behavioral-questions.jsonl`, `config/study-progress.json` weak_spots
- 처리: tech-interview-drill과 동일 엔진, STAR·가치관 관점 채점 rubric 적용
- 출력: `data/runtime/drill-log-YYYY-MM-DD.jsonl` (누적), `config/study-progress.json` weak_spots 갱신
- git push: 없음

**interview-stage-prep** (신규):
- 입력: `config/mvp-target.json` (면접 단계 정보), `config/candidate-profile.md`
- 처리: 1차/최종/오퍼 단계별 실전 준비 자료 생성
- 출력: `data/reports/stage-prep-YYYY-MM-DD.md` (비공개)
- git push: 없음

### 4. code-architecture.md 갱신

다음 내용을 반영한다:

**공용 드릴 엔진 배치 확정**:
- 위치: `career-os/scripts/interview-drill/` (ADR-019 scripts 분리 원칙 준수)
- 구성 파일: `drill-engine.ts` (질문 선정·채점·기록·약점 환류·study-pack 위임)
- tech-interview-drill과 behavioral-interview-drill이 이 엔진을 공유
- ADR-031(_lib 폐기) 준수: `scripts/_lib/` 미사용, 스킬 한정 scripts/ 내 공용 모듈

**스킬 디렉터리 변경 사항**:
- `interview-prep-analyzer/` → `job-fit-analyzer/` (리네임)
- `tech-interview-drill/` (신규)
- `behavioral-interview-drill/` (신규)
- `interview-stage-prep/` (신규)
- `candidate-baseline-suggester/` (제거 예정, phase-06)

### 5. prd.md 기능 표 갱신

다음 변경을 반영한다:
- `interview-prep-analyzer` → `job-fit-analyzer`로 항목 갱신 (daily 모드 제거, 핏·갭 진단으로 리포커스)
- `tech-interview-drill` 신규 항목 추가 (매일 기술 면접 답변 연습·채점·약점 환류)
- `behavioral-interview-drill` 신규 항목 추가 (매일 인성 면접 답변 연습·채점·약점 환류)
- `interview-stage-prep` 신규 항목 추가 (1차/최종/오퍼 단계별 실전 준비)
- `candidate-baseline-suggester` → 제거 예정으로 표기 (phase-06 완료 후 실제 제거)

### 6. README 또는 docs 플로우차트 추가

`career-os/docs/flow.md` 또는 적절한 위치에 스킬 역할·담당 파일·생성 파일을 정리한 플로우차트(마크다운 표 또는 mermaid)를 추가한다.

플로우차트에 포함할 내용:
- 각 스킬 이름 → 입력 파일 → 출력 파일
- 드릴 → study-pack-writer 위임 흐름
- question-bank-collector → 질문 풀 보충 흐름

---

## common-pitfalls self-check (섹션 1~5)

이 phase 작업 전 확인한다:

- [ ] **섹션 1 (범위 준수)**: 코드·스킬 파일은 건드리지 않는다. docs 파일만 수정한다.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 아래 검증 명령이 직접 실행 가능한지 확인한다.
- [ ] **섹션 3 (독립 실행 가능성)**: 이전 phase 산출물 없이 이 phase만 실행해도 완료 가능하다.
- [ ] **섹션 4 (작업 항목 5개 이하)**: 6개 항목이나 1번이 파악 전용(코드 없음)이므로 실질 작업은 5개 이하.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

아래 명령을 Bash 도구로 직접 실행해 통과 확인 후 commit한다.
**grep 결과를 보지 않고 "완료" 보고하지 않는다.**

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# data-schema.md: weak_spots 확장 필드 확인
for FIELD in "question_id" "pass_count" "next_review_date" "last_passed" "drill-log"; do
  grep -q "$FIELD" career-os/docs/data-schema.md \
    || { echo "[FAIL] data-schema.md: $FIELD 누락"; FAIL=1; }
done

# flow.md: 신규 스킬 흐름 확인
for SKILL in "job-fit-analyzer" "tech-interview-drill" "behavioral-interview-drill" "interview-stage-prep"; do
  grep -q "$SKILL" career-os/docs/flow.md \
    || { echo "[FAIL] flow.md: $SKILL 누락"; FAIL=1; }
done

# code-architecture.md: 공용 드릴 엔진 배치 확인
grep -q "drill-engine" career-os/docs/code-architecture.md \
  || { echo "[FAIL] code-architecture.md: drill-engine 누락"; FAIL=1; }
grep -q "interview-drill" career-os/docs/code-architecture.md \
  || { echo "[FAIL] code-architecture.md: interview-drill 디렉터리 누락"; FAIL=1; }

# prd.md: 신규 스킬 항목 확인
for SKILL in "job-fit-analyzer" "tech-interview-drill" "behavioral-interview-drill" "interview-stage-prep"; do
  grep -q "$SKILL" career-os/docs/prd.md \
    || { echo "[FAIL] prd.md: $SKILL 누락"; FAIL=1; }
done

# 코드 파일 미수정 확인 (scripts/, .claude/skills/ 변경 없어야 함)
CHANGED=$(git diff --name-only | grep -E "career-os/scripts/|career-os/\.claude/skills/" | grep -v "\.md$" || true)
[ -z "$CHANGED" ] || { echo "[FAIL] 코드 파일 변경 감지(범위 외): $CHANGED"; FAIL=1; }

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-01 docs 갱신 검증 통과"
else
  echo "PHASE_FAILED: docs 갱신 누락 항목 확인"
  exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add \
  career-os/docs/data-schema.md \
  career-os/docs/flow.md \
  career-os/docs/code-architecture.md \
  career-os/docs/prd.md
# README나 다른 docs 파일도 수정했다면 추가
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(career-os): plan086 면접 준비 flow 재편 docs-first materialization

- data-schema.md: weak_spots 확장 필드 + 드릴 일별 로그 + 질문 풀 구조
- flow.md: job-fit-analyzer·tech-interview-drill·behavioral-interview-drill·interview-stage-prep 흐름 추가
- code-architecture.md: 공용 드릴 엔진(scripts/interview-drill/) 배치 확정
- prd.md: 신규·제거 스킬 반영

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
echo "[working tree 잔여]"
git status --porcelain | head
```

---

## Blocked 조건

- docs 파일 읽기 권한이 없어 현황 파악이 불가능하면: `PHASE_BLOCKED: docs 파일 접근 불가 — 경로 확인 필요`
- data-schema.md·flow.md·code-architecture.md·prd.md 중 하나라도 존재하지 않으면: `PHASE_BLOCKED: 대상 docs 파일 미존재 — ls career-os/docs/ 결과 확인`
- 성공 기준 검증 명령이 FAIL을 출력하면: `PHASE_FAILED: 검증 실패 항목 수정 후 재실행`
- 코드 파일 변경이 감지되면: `PHASE_FAILED: 범위 외 파일 변경 — 되돌리고 docs 파일만 수정`
