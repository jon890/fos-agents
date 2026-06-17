# Phase 05 — interview-stage-prep 신규 스킬 (stage 모드 분리)

**Model**: sonnet
**Status**: pending

---

## 목표

`interview-stage-prep` 스킬을 신규 작성한다.
job-fit-analyzer(phase-02에서 리네임, daily만 제거됨)에는 stage 모드(1차/최종/오퍼 단계별 준비) 내용이 **아직 남아 있다**. 이 phase에서 그 stage 내용을 새 `interview-stage-prep` 스킬로 추출한 뒤, **job-fit-analyzer에서 stage 모드를 제거**한다. (추출+제거를 이 phase가 함께 소유 — 한 phase에서 원자적으로.)

**범위 외**:
- 드릴 스킬(tech/behavioral-interview-drill) 수정 금지
- candidate-baseline-suggester 제거 금지 (phase-06)
- docs/ADR 수정 금지
- push·PR 금지

**job-fit-analyzer는 stage 제거 목적으로만** 수정한다(핏·갭 진단 로직은 건드리지 않는다).

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
# 기존 mvp-target.json에서 면접 단계 구조 확인
grep -n "stage\|round\|1차\|최종\|오퍼" career-os/config/mvp-target.json 2>/dev/null | head -20
# mvp_target_schema.ts에서 stage 필드 확인
grep -n "stage\|round" career-os/scripts/interview-prep-analyzer/mvp_target_schema.ts 2>/dev/null \
  || grep -n "stage\|round" career-os/scripts/*/mvp_target_schema.ts 2>/dev/null | head -20
# job-fit-analyzer(phase-02에서 리네임)에 남아 있는 stage 모드 내용 확인 — 추출 대상
grep -rn "stage\|1차\|최종\|오퍼\|first_round\|final_round\|offer" career-os/.claude/skills/job-fit-analyzer/ 2>/dev/null | head -20
```

### 2. interview-stage-prep 스킬 작성

`career-os/.claude/skills/interview-stage-prep/SKILL.md` 신규 작성.

포함 내용:
- description: "1차·최종·오퍼 단계별 면접 실전 준비를 생성한다. 입력: config/mvp-target.json(단계 정보), config/candidate-profile.md. 출력: data/reports/stage-prep-YYYY-MM-DD.md. 드릴이나 공고 fit 분석은 담당하지 않는다."
- 단계별 준비 내용:
  - **1차 면접**: 기술 역량 중심, 드릴 약점 토픽 연계, 예상 기술 질문 목록, 포트폴리오 강조 포인트
  - **최종 면접**: 가치관·문화 핏 중심, 회사 미션·팀 스타일 리서치 포인트, STAR 인성 질문 예상
  - **오퍼 협상**: 보상·성장 기회·팀 환경 체크리스트, 역협상 포인트
- 입력: `config/mvp-target.json` (현재 단계 정보), `config/candidate-profile.md`
- 출력: `data/reports/stage-prep-YYYY-MM-DD.md` (비공개, git push 없음)
- 경계 명시: "매일 답변 연습은 `tech-interview-drill` / `behavioral-interview-drill` 담당. 공고 fit 분석은 `application-package-writer` 담당."

`.codex/skills/` 심링크 생성:
```bash
ln -sf ../../.claude/skills/interview-stage-prep career-os/.codex/skills/interview-stage-prep
```

### 3. job-fit-analyzer에서 stage 모드 제거

stage 내용을 interview-stage-prep로 옮긴 뒤, job-fit-analyzer SKILL.md(및 관련 참조)에서 stage 모드(1차/최종/오퍼) 분기·섹션을 제거한다.
job-fit-analyzer는 핏·갭 진단 단일 책임만 남긴다. 핏·갭 진단 로직은 건드리지 않는다.

### 4. CLAUDE.md 진입점 추가

`career-os/CLAUDE.md`의 agent skill 목록에 `/interview-stage-prep` 진입점 추가.
job-fit-analyzer 항목에 stage 관련 표기가 남아 있으면 함께 정리한다.

---

## common-pitfalls self-check (섹션 1~5)

- [ ] **섹션 1 (범위 준수)**: interview-stage-prep 신규 + job-fit-analyzer에서 stage 제거(stage 한정). 드릴 스킬·candidate-baseline-suggester는 건드리지 않는다.
- [ ] **섹션 2 (성공 기준 실행 가능성)**: 아래 검증 명령 직접 실행 가능 확인.
- [ ] **섹션 3 (독립 실행 가능성)**: phase-04 완료 후 단독 실행 가능.
- [ ] **섹션 4 (작업 항목 4개)**: 현황 파악·stage-prep 작성·job-fit stage 제거·CLAUDE.md.
- [ ] **섹션 5 (blocked 조건 명시)**: 아래에 명시.

---

## 성공 기준

```bash
cd "$(git rev-parse --show-toplevel)"
FAIL=0

# interview-stage-prep 스킬 존재 확인
[ -f career-os/.claude/skills/interview-stage-prep/SKILL.md ] \
  || { echo "[FAIL] interview-stage-prep/SKILL.md 없음"; FAIL=1; }

# SKILL.md 핵심 구절 확인
for KWORD in "1차\|최종\|오퍼" "stage-prep" "application-package-writer" "tech-interview-drill"; do
  grep -q "$KWORD" career-os/.claude/skills/interview-stage-prep/SKILL.md \
    || { echo "[FAIL] SKILL.md에 $KWORD 누락"; FAIL=1; }
done

# CLAUDE.md 진입점 확인
grep -q "interview-stage-prep" career-os/CLAUDE.md \
  || { echo "[FAIL] CLAUDE.md 진입점 누락"; FAIL=1; }

# job-fit-analyzer에서 stage 모드 제거 확인 (stage/단계 분기 잔존 없어야 함)
grep -rniE "first_round|final_round|offer_chat|1차 면접|최종 면접|오퍼" career-os/.claude/skills/job-fit-analyzer/ 2>/dev/null \
  && { echo "[FAIL] job-fit-analyzer에 stage 모드 잔존 — 제거 필요"; FAIL=1; } || echo "[ok] job-fit-analyzer stage 제거됨"

if [ "$FAIL" = "0" ]; then
  echo "SUCCESS: phase-05 interview-stage-prep 검증 통과"
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
  career-os/.claude/skills/interview-stage-prep/ \
  career-os/.claude/skills/job-fit-analyzer/ \
  career-os/CLAUDE.md
# .codex 심링크도 추가
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
feat(career-os): interview-stage-prep 스킬 신규 추가 (stage 모드 분리)

- .claude/skills/interview-stage-prep/SKILL.md: 1차·최종·오퍼 단계별 실전 준비
- 기존 interview-prep-analyzer stage 모드에서 독립 스킬로 분리
- CLAUDE.md 진입점 추가

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
git log --oneline -1
echo "[working tree 잔여]"
git status --porcelain | head
```

---

## Blocked 조건

- `config/mvp-target.json` 단계 구조를 파악할 수 없으면: `PHASE_BLOCKED: mvp-target.json stage 구조 불명확 — 파일 확인 후 스킬 설계`
- interview-prep-analyzer가 phase-02에서 제거되지 않았으면: `PHASE_BLOCKED: interview-prep-analyzer 잔존 — phase-02 완료 여부 확인`
- 성공 기준 검증 FAIL 시: `PHASE_FAILED: 위 항목 수정 후 재실행`
