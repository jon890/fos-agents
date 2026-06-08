# Phase 02 — career-os prep.md 경로 전환

**Model**: sonnet
**Status**: pending

---

## 목표

career-os의 generator, native skill prompt, processor가 사람이 보는 면접 준비 파일을 `primary.data_root/interview/prep.md` 기준으로 읽고 쓰게 한다.
답변 기록과 피드백 로그는 별도 데이터 경로로 유지한다.

**범위 외**: `prep.md` 본문 정제는 Phase 01, fos-career dashboard 변경은 Phase 03, legacy split 파일 삭제는 Phase 04에서 수행한다. request result visibility 개선은 이번 plan 범위 밖이다.

---

## 강제 경계

- 구현 phase에서 `career-os/docs/`, `career-os/AGENTS.md`, `career-os/TOOLS.md`를 수정하지 않는다.
- 새 legacy fallback을 추가하지 않는다.
- 사람이 보는 primary asset으로 `current-practice.md`, `interview/reports/*.md`, `study/interview-prep-10-day-java-materials.md`, `data/prep/*/strategy.md`, `data/prep/*/checklist.md`를 쓰지 않는다.
- `interview/answers/*.jsonl`과 `interview/feedback/*.md`는 계속 별도 누적 데이터로 둔다.
- private 본문, 면접 답변 전문, 상세 피드백, command stdout 전체를 request result, audit log, Discord 알림, fos-study로 복사하지 않는다.
- 기존 dirty state나 다른 사람이 만든 변경을 되돌리지 않는다. intended files만 수정한다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 ai-nodes 루트로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
git -C career-os status --short
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-062, ADR-063
- `career-os/docs/data-schema.md`의 position home 구조
- `career-os/docs/flow.md`의 `/interview-prep-analyzer`와 data 경계
- `career-os/docs/code-architecture.md`의 native skill과 scripts 책임
- `career-os/docs/prd.md`의 plan060 면접 hub 범위
- `career-os/tasks/plan061-private-position-home-unification/index.json`
- `career-os/tasks/plan061-private-position-home-unification/phase-01.md`

---

## 작업 항목

### 1. split primary 사용처 전수 검색

아래 문자열을 `career-os/.claude/skills`, `career-os/scripts`, `career-os/config`에서 검색하고 runtime source 또는 primary asset으로 쓰는 곳만 수정 대상으로 분류한다.

- `current-practice.md`
- `interview/reports`
- `interview-prep-10-day-java-materials.md`
- `data/prep`
- `strategy_filename`
- `checklist_filename`

과거 task/history/docs의 기록은 수정하지 않는다.

### 2. `interview-prep-analyzer` prompt 전환

`career-os/.claude/skills/interview-prep-analyzer/SKILL.md`가 stage 면접 준비 산출물을 `primary.data_root/interview/prep.md`에 갱신하도록 바꾼다.
baseline/daily 일반 report 흐름은 docs가 허용한 기존 report 위치를 유지해도 되지만, 현재 포지션의 사람이 보는 면접 준비 hub는 `prep.md`가 정본이어야 한다.

### 3. answer feedback recorder 전환

`career-os/scripts/interview-prep/record_answer_feedback.ts` 또는 동등한 answer feedback processor가 context markdown을 읽을 때 `interview/prep.md`를 우선 사용하게 한다.
답변 저장은 `interview/answers/*.jsonl`, 피드백 저장은 `interview/feedback/*.md`를 유지한다.

### 4. mvp target helper와 stage config 정리

`scripts/interview-prep-analyzer/mvp_target_schema.ts`와 `config/mvp-target.json`의 stage config가 split primary file 이름에 의존하면 `prep.md` 중심 계약과 충돌하지 않게 조정한다.
단, docs/ADR 수정 없이 스키마 의미를 바꿀 수 없으면 `PHASE_BLOCKED`로 멈춘다.

### 5. public-safe 지시 유지

study-pack 요청 또는 interview asset 생성 흐름이 `prep.md` 내용을 그대로 public 경로로 복사하지 않게 public-safe 재작성 경계를 확인하고, 필요하면 skill prompt에 경계 문장을 보강한다.

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/config/mvp-target.json >/tmp/plan062-mvp-target.json

rg -n "interview/prep\\.md|prepPath|prep_path|prepMarkdown|answers/|feedback/" \
  career-os/.claude/skills career-os/scripts career-os/config \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  | tee /tmp/plan062-career-os-prep-refs.txt
PREP_REF_COUNT=$(wc -l </tmp/plan062-career-os-prep-refs.txt)
echo "[career-os prep refs] $PREP_REF_COUNT"
test "$PREP_REF_COUNT" -gt 0

rg -n "current-practice\\.md|interview/reports|interview-prep-10-day-java-materials\\.md|data/prep|strategy_filename|checklist_filename" \
  career-os/.claude/skills career-os/scripts \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  | tee /tmp/plan062-career-os-split-primary-refs.txt
SPLIT_COUNT=$(wc -l </tmp/plan062-career-os-split-primary-refs.txt)
echo "[career-os split primary refs in code and prompts] $SPLIT_COUNT"
test "$SPLIT_COUNT" -eq 0

rg -n "sources/fos-study.*prep\\.md|prep\\.md.*sources/fos-study" \
  career-os/.claude/skills career-os/scripts career-os/config \
  -g '!**/node_modules/**' \
  | tee /tmp/plan062-private-to-public-copy.txt
PUBLIC_COPY_COUNT=$(wc -l </tmp/plan062-private-to-public-copy.txt)
echo "[private prep direct public copy refs] $PUBLIC_COPY_COUNT"
test "$PUBLIC_COPY_COUNT" -eq 0

git -C career-os diff --check
git -C career-os status --short
```

필요한 경우 변경된 TypeScript 파일만 좁게 검증한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun --version
bun career-os/scripts/interview-prep-analyzer/mvp_target_schema.ts --help >/tmp/plan062-mvp-helper-smoke.txt 2>&1 || true
```

`--help` entrypoint가 없는 파일이면 import/typecheck 가능한 repo 표준 명령을 찾아 실행하고, 대체 이유와 결과를 보고한다.

---

## common-pitfalls self-check

- 수치 보고는 `rg`와 `wc -l` 출력만 사용한다.
- phase는 이전 대화 없이 실행 가능해야 한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- legacy fallback을 추가하지 않는다.
- 답변/피드백 로그는 별도 유지한다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- docs/ADR 수정 없이는 `interview-prep-analyzer` stage 산출물 경로를 `prep.md`로 바꿀 수 없다.
- answer feedback recorder가 현재 구조상 `prep.md`와 답변/피드백 분리 저장을 동시에 만족할 수 없다.
- `config/mvp-target.json` 스키마 의미 변경이 필요하다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- 사람이 보는 면접 준비 primary source로 split 파일 경로가 남았다.
- `prep.md` 내용을 fos-study로 직접 복사하는 흐름을 만들었다.
- 답변 기록이나 상세 피드백을 `prep.md`에 누적 저장하게 만들었다.
- docs/ADR/정책 문서를 수정했다.
