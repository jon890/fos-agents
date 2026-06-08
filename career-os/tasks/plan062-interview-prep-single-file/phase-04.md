# Phase 04 — legacy split 파일 정리와 통합 검증

**Model**: haiku
**Status**: pending

---

## 목표

ADR-063 적용이 career-os와 fos-career 양쪽에서 끝났는지 검증하고, `prep.md`로 대체 확인된 legacy split 파일을 정본에서 제외하거나 제거한다.
검증이 끝나면 task index를 완료 상태로 갱신한다.

**범위 외**: 새 기능 추가, dashboard UX polish, request result visibility UI/DB schema 개선, docs/ADR/정책 문서 수정, 외부 제출/공개 발행은 하지 않는다.

---

## 강제 경계

- 구현 phase에서 `career-os/docs/`, `career-os/AGENTS.md`, `career-os/TOOLS.md`, fos-career 정책/ADR 문서를 수정하지 않는다.
- cleanup은 `prep.md`로 대체가 확인된 split primary 파일에 한정한다.
- 삭제 전에는 파일 경로와 대체 정본 경로를 stdout에 출력한다. 불확실하면 삭제하지 않고 `PHASE_BLOCKED` 또는 보고 항목으로 남긴다.
- `interview/answers/*.jsonl`, `interview/feedback/*.md`는 삭제하지 않는다.
- `interview/history/YYYY-MM-DD.md`는 존재할 때만 다루며 새로 만들지 않는다.
- 기존 dirty state나 다른 사람이 만든 변경을 되돌리지 않는다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 첫 bash에서 ai-nodes 루트로 이동하고, fos-career는 `git -C`로 다룬다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
git -C career-os status --short
git -C /home/bifos/services/fos-career status --short
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-062, ADR-063
- `career-os/docs/data-schema.md`의 position home 구조와 data 보존 원칙
- `career-os/docs/flow.md`의 data 보존 흐름
- `career-os/docs/code-architecture.md`의 fos-career 별도 repo 경계
- 이 task의 `phase-01.md`, `phase-02.md`, `phase-03.md`

---

## 작업 항목

### 1. 정본 파일과 필수 섹션 확인

`config/mvp-target.json`에서 `primary.data_root`를 읽고 `interview/prep.md`가 존재하는지 확인한다.
Phase 01의 필수 섹션이 모두 남아 있어야 한다.

### 2. legacy split primary 참조 grep

career-os runtime caller, native skill prompt, fos-career adapter/processor/UI에서 split 파일이 primary source로 남지 않았는지 확인한다.
과거 task/history/docs에 남은 기록은 runtime source가 아니면 허용하되, grep 결과와 제외 이유를 보고한다.

### 3. legacy split 파일 cleanup

아래 파일이 존재하고 `prep.md` 대체가 확인됐으면 제거하거나 정본에서 제외한다.
제거할 때는 `rm`보다 `trash`가 있으면 `trash`를 우선한다.

- `career-os/private/cj-foodville/digital-channel-backend/interview/current-practice.md`
- `career-os/private/cj-foodville/digital-channel-backend/interview/reports/2026-06-08.md`
- `career-os/private/cj-foodville/digital-channel-backend/study/interview-prep-10-day-java-materials.md`
- `career-os/data/prep/cj-foodville-first-round/strategy.md` (존재할 때만)
- `career-os/data/prep/cj-foodville-first-round/checklist.md` (존재할 때만)

대체 여부가 불명확하면 제거하지 말고 `PHASE_BLOCKED`로 멈춘다.

### 4. build, legacy grep, docker health 확인

career-os는 변경된 코드에 맞는 좁은 검증을 실행한다.
fos-career는 `npm run build` 또는 repo 표준 build/typecheck를 실행한다.
dashboard가 docker compose 또는 systemd로 떠 있다면 health/status를 확인하되, 새 DB 컨테이너를 만들지 않는다.

### 5. task index 갱신

검증이 끝나면 `career-os/tasks/plan062-interview-prep-single-file/index.json`의 `status`, `current_phase`, 각 phase status, `updated_at`을 완료 상태로 갱신한다.
JSON은 trailing newline이 있는 valid JSON으로 저장한다.

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/tasks/plan062-interview-prep-single-file/index.json >/tmp/plan062-index.json
python3 -m json.tool career-os/config/mvp-target.json >/tmp/plan062-mvp-target.json

DATA_ROOT=$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("career-os/config/mvp-target.json").read_text())
print(data["primary"]["data_root"])
PY
)
echo "[primary.data_root] $DATA_ROOT"
test "$DATA_ROOT" = "private/cj-foodville/digital-channel-backend"

PREP="career-os/$DATA_ROOT/interview/prep.md"
test -f "$PREP"
for heading in \
  "오늘의 면접 준비 요약" \
  "예상 질문 드릴" \
  "추천 시작 질문" \
  "1차 면접 전략" \
  "1차 면접 체크리스트" \
  "단기 Java 준비" \
  "이미 정리된 주제와 낮은 우선순위 주제" \
  "다음 액션"
do
  COUNT=$(rg -n "^## .*${heading}|^# .*${heading}" "$PREP" | wc -l)
  echo "[heading count] $heading=$COUNT"
  test "$COUNT" -gt 0
done

rg -n "current-practice\\.md|interview/reports|interview-prep-10-day-java-materials\\.md|data/prep|strategy_filename|checklist_filename" \
  career-os/.claude/skills career-os/scripts /home/bifos/services/fos-career \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/coverage/**' \
  | tee /tmp/plan062-final-split-primary-refs.txt
SPLIT_COUNT=$(wc -l </tmp/plan062-final-split-primary-refs.txt)
echo "[final split primary refs in code, prompts, and dashboard] $SPLIT_COUNT"
test "$SPLIT_COUNT" -eq 0

for path in \
  "career-os/$DATA_ROOT/interview/current-practice.md" \
  "career-os/$DATA_ROOT/interview/reports/2026-06-08.md" \
  "career-os/$DATA_ROOT/study/interview-prep-10-day-java-materials.md" \
  "career-os/data/prep/cj-foodville-first-round/strategy.md" \
  "career-os/data/prep/cj-foodville-first-round/checklist.md"
do
  if [ -e "$path" ]; then
    echo "[legacy split still exists] $path"
    exit 1
  fi
done

test -d "career-os/$DATA_ROOT/interview/answers"
test -d "career-os/$DATA_ROOT/interview/feedback"

git -C career-os diff --check
git -C /home/bifos/services/fos-career diff --check
git -C career-os status --short
git -C /home/bifos/services/fos-career status --short
```

fos-career build 또는 smoke:

```bash
cd /home/bifos/services/fos-career
npm run build
```

docker health 확인은 현재 repo 구성을 먼저 읽고 가능한 경우에만 실행한다.

```bash
cd /home/bifos/services/fos-career
docker compose ps
```

`docker compose ps`가 repo 구성상 불가능하면 systemd unit, container name, dev server 상태 중 실제 운영 방식에 맞는 health 명령으로 대체하고 이유를 보고한다.

---

## common-pitfalls self-check

- grep count, file existence, build 결과는 실제 명령 출력만 보고한다.
- cleanup은 `prep.md` 대체 확인된 split primary 파일에 한정한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- `index.json`은 trailing newline이 있는 valid JSON으로 저장한다.
- `git status --short`로 unrelated dirty state를 확인하고 intended files만 stage한다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `prep.md` 정본 파일이 없거나 필수 섹션이 비어 있다.
- legacy split 파일이 `prep.md`로 대체됐는지 판단할 수 없다.
- docker health 확인 방식이 운영 문서 없이 불명확하고 검증 결론에 영향을 준다.
- docs/ADR/정책 문서 수정 없이는 완료 판정을 내릴 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- final split primary grep count가 0이 아니다.
- `primary.data_root`가 `private/cj-foodville/digital-channel-backend`가 아니다.
- 정본 대체가 불명확한 파일을 삭제했다.
- 답변/피드백 로그를 삭제했다.
- build/smoke가 실패했는데 원인을 보고하지 않았다.
- docs/ADR/정책 문서를 수정했다.
