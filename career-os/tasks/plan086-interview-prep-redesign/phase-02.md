# Phase 02 — job-fit-analyzer 리네임

**Model**: sonnet
**Status**: pending

---

## 목표

`interview-prep-analyzer`를 `job-fit-analyzer`로 리네임한다.
daily 모드를 제거하고 타깃 직무(역할 단위) 핏·갭 진단으로 리포커스한다.
심링크·참조를 갱신한다.
개별 공고 fit은 application-package-writer 담당임을 SKILL.md 경계에 명시한다.

**범위 외**:
- 공용 드릴 엔진·신규 드릴 스킬 작성 금지 (phase-03·04)
- stage 모드 분리 금지 (phase-05)
- candidate-baseline-suggester 제거 금지 (phase-06)
- docs/ADR 수정 금지 (phase-01 완료됨)
- push·PR 금지

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 작업 항목

### 1. 현황 파악

```bash
cd "$(git rev-parse --show-toplevel)"
# 기존 스킬 구조 확인
ls career-os/.claude/skills/interview-prep-analyzer/
ls career-os/.codex/skills/ 2>/dev/null || echo ".codex 없음"
# 기존 SKILL.md의 daily 모드 관련 구절 확인
grep -n "daily\|baseline\|stage\|모드\|mode" career-os/.claude/skills/interview-prep-analyzer/SKILL.md | head -30
# scripts/ 관련 경로 확인
ls career-os/scripts/ | grep -i interview || echo "scripts 없음"
# 다른 파일에서 interview-prep-analyzer 참조 확인
grep -rn "interview-prep-analyzer" career-os/.claude/skills/ career-os/docs/ career-os/CLAUDE.md 2>/dev/null | grep -v "interview-prep-analyzer/SKILL.md" | head -20
```

### 2. 스킬 디렉터리 리네임

```bash
cd "$(git rev-parse --show-toplevel)"
# 리네임: .claude/skills/
cp -r career-os/.claude/skills/interview-prep-analyzer career-os/.claude/skills/job-fit-analyzer

# .codex/skills/ 심링크 갱신 (있을 경우)
if [ -e career-os/.codex/skills/interview-prep-analyzer ]; then
  ln -sf ../../.claude/skills/job-fit-analyzer career-os/.codex/skills/job-fit-analyzer
  echo ".codex 심링크 생성됨"
fi
```

### 3. job-fit-analyzer SKILL.md 개정

`career-os/.claude/skills/job-fit-analyzer/SKILL.md`를 다음 방향으로 개정한다:

**제거**:
- `daily` 모드 전체 (daily 토픽별 진단, daily 출력 형식)
- baseline/daily/stage 분기 로직

**변경**:
- 스킬 이름을 `job-fit-analyzer`로 업데이트
- description: "타깃 직무(역할 단위) 대비 후보자 핏·부족분을 1회/주기로 진단한다"
- 모드를 단일 모드(핏·갭 진단)로 단순화
- 입력: `config/mvp-target.json`(역할 정보), `config/candidate-profile.md`(후보자 이력)
- 출력: `data/reports/job-fit-YYYY-MM-DD.md`

**추가**:
- 경계 명시: "개별 공고 단위 fit 분석은 `application-package-writer` 담당. 매일 답변 연습은 `tech-interview-drill` / `behavioral-interview-drill` 담당."
- stage(면접 단계) 준비는 `interview-stage-prep` 담당임을 명시

### 4. 기존 디렉터리 정리 및 참조 갱신

```bash
cd "$(git rev-parse --show-toplevel)"
# 기존 interview-prep-analyzer 스킬 디렉터리 제거 (git rm)
git rm -r career-os/.claude/skills/interview-prep-analyzer/

# .codex 기존 심링크 제거
if [ -e career-os/.codex/skills/interview-prep-analyzer ]; then
  git rm career-os/.codex/skills/interview-prep-analyzer
fi
```

CLAUDE.md(career-os)에서 `interview-prep-analyzer` 진입점 라인을 `job-fit-analyzer`로 갱신한다.

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: interview-prep-analyzer → job-fit-analyzer 리네임과 SKILL.md 개정만. 신규 드릴·stage 분리·baseline-suggester 제거 금지.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 아래 검증 명령이 직접 실행 가능한지 확인.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-01 docs 완료 후 단독 실행 가능.
- [ ] **섹션 4 (작업 항목 4개)**: 현황 파악·리네임·SKILL.md 개정·참조 갱신.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# job-fit-analyzer 스킬 존재 확인
[ -f career-os/.claude/skills/job-fit-analyzer/SKILL.md ] \
  || { echo "[FAIL] job-fit-analyzer/SKILL.md 없음"; FAIL=1; }

# 기존 interview-prep-analyzer 제거 확인
[ ! -d career-os/.claude/skills/interview-prep-analyzer ] \
  || { echo "[FAIL] interview-prep-analyzer 디렉터리 잔존"; FAIL=1; }

# daily 모드 제거 확인 (SKILL.md에 daily 관련 핵심 구절 없어야 함)
grep -qi "daily 모드\|daily mode\|daily 토픽" career-os/.claude/skills/job-fit-analyzer/SKILL.md \
  && { echo "[FAIL] job-fit-analyzer SKILL.md에 daily 모드 잔존"; FAIL=1; }

# 경계 명시 확인
grep -q "application-package-writer" career-os/.claude/skills/job-fit-analyzer/SKILL.md \
  || { echo "[FAIL] application-package-writer 경계 미명시"; FAIL=1; }

# CLAUDE.md 진입점 갱신 확인
grep -q "job-fit-analyzer" career-os/CLAUDE.md \
  || { echo "[FAIL] CLAUDE.md 진입점 job-fit-analyzer 미반영"; FAIL=1; }

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-02 job-fit-analyzer 리네임 검증 통과"
else
  echo "PHASE_FAILED: 위 항목 수정 후 재실행"
  exit 1
fi
```

---

## commit (push 금지)

```bash
cd "$(git rev-parse --show-toplevel)"
git add \
  career-os/.claude/skills/job-fit-analyzer/ \
  career-os/CLAUDE.md
# .codex 심링크도 변경됐다면 추가
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
refactor(career-os): interview-prep-analyzer → job-fit-analyzer 리네임 + daily 제거

- .claude/skills/interview-prep-analyzer/ 제거
- .claude/skills/job-fit-analyzer/ 신설 (핏·갭 진단 단일 모드)
- daily 모드 제거, 개별 공고 fit은 application-package-writer 경계 명시
- CLAUDE.md 진입점 갱신

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
echo "[working tree 잔여]"
git status --porcelain | head
```

---

## Blocked 조건

- `career-os/.claude/skills/interview-prep-analyzer/` 가 존재하지 않으면: `PHASE_BLOCKED: interview-prep-analyzer 스킬 디렉터리 없음 — ls career-os/.claude/skills/ 확인`
- SKILL.md 읽기 권한 없으면: `PHASE_BLOCKED: SKILL.md 접근 불가 — 권한 확인`
- 성공 기준 검증 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
