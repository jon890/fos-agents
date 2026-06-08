# Phase 01 — prep.md 초안과 정제 생성

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-063에 맞춰 CJ푸드빌 1차 면접 준비의 사람용 단일 정본 `career-os/private/cj-foodville/digital-channel-backend/interview/prep.md`를 만든다.
기존 split 파일을 단순 연결하지 않고, 현재 면접에 필요한 내용만 중복 없이 정제한다.

**범위 외**: career-os generator/skill/processor 코드 변경은 Phase 02, fos-career dashboard 변경은 Phase 03, legacy split 파일 삭제는 Phase 04에서 수행한다. docs/ADR/정책 문서는 수정하지 않는다.

---

## 강제 경계

- 구현 phase에서 `career-os/docs/`, `career-os/AGENTS.md`, `career-os/TOOLS.md`를 수정하지 않는다.
- `prep.md`는 사람이 읽는 정본이므로 긴 원문 dump나 여러 파일의 concatenate 결과로 만들지 않는다.
- 답변 기록과 피드백 로그는 `interview/answers/*.jsonl`, `interview/feedback/*.md`로 분리 유지한다.
- 날짜별 snapshot은 기본 생성하지 않는다.
- private 내용을 `sources/fos-study/`로 그대로 복사하지 않는다.
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
- `career-os/docs/data-schema.md`의 `config/mvp-target.json`과 `private/<company-slug>/<position-slug>/`
- `career-os/docs/flow.md`의 data 경계와 `/interview-prep-analyzer` 흐름
- `career-os/docs/code-architecture.md`의 native skill, private position home 책임
- `career-os/docs/prd.md`의 CJ푸드빌 면접 hub 범위
- `career-os/config/mvp-target.json`

---

## 작업 항목

### 1. source 파일 조사

`config/mvp-target.json`의 `primary.data_root`가 `private/cj-foodville/digital-channel-backend`인지 확인하고, 아래 source를 존재하는 것만 읽는다.

- `career-os/private/cj-foodville/digital-channel-backend/interview/current-practice.md`
- `career-os/private/cj-foodville/digital-channel-backend/interview/reports/2026-06-08.md`
- `career-os/private/cj-foodville/digital-channel-backend/study/interview-prep-10-day-java-materials.md`
- `career-os/data/prep/cj-foodville-first-round/strategy.md` (존재할 때만)
- `career-os/data/prep/cj-foodville-first-round/checklist.md` (존재할 때만)

`data/prep` 파일이 없으면 없는 경로를 보고하고 계속 진행한다.

### 2. `interview/` 하위 디렉터리 보장

아래 디렉터리를 필요하면 만든다.

- `career-os/private/cj-foodville/digital-channel-backend/interview/`
- `career-os/private/cj-foodville/digital-channel-backend/interview/answers/`
- `career-os/private/cj-foodville/digital-channel-backend/interview/feedback/`

`interview/history/`는 만들지 않는다.

### 3. `prep.md` 섹션 정제

`career-os/private/cj-foodville/digital-channel-backend/interview/prep.md`를 작성한다.
반드시 포함할 섹션:

- 오늘의 면접 준비 요약
- 예상 질문 드릴
- 추천 시작 질문
- 1차 면접 전략
- 1차 면접 체크리스트
- 단기 Java 준비
- 이미 정리된 주제와 낮은 우선순위 주제
- 다음 액션

첫 10줄 안에 결론 또는 권장 행동이 보여야 한다.
질문은 dashboard가 파싱하기 쉽게 Markdown list 또는 numbered list로 일관되게 작성한다.

### 4. manifest 또는 README 링크 갱신

`manifest.json` 또는 `README.md`가 면접 준비 primary asset을 나열한다면, `interview/prep.md`가 사람용 정본임을 가리키게 갱신한다.
split 파일은 legacy/reference로만 남기고 dashboard primary로 표시하지 않는다.

### 5. source 보존 메모

이번 phase에서는 기존 split 파일을 삭제하지 않는다.
대체 확인과 cleanup은 Phase 04에서 수행한다.

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
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
test -d "career-os/$DATA_ROOT/interview/answers"
test -d "career-os/$DATA_ROOT/interview/feedback"
test ! -d "career-os/$DATA_ROOT/interview/history"

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

FIRST_TEN=$(sed -n '1,10p' "$PREP")
printf '%s\n' "$FIRST_TEN" | rg -n "결론|권장|다음 액션|오늘은|우선" >/tmp/plan062-prep-first-ten.txt
wc -l /tmp/plan062-prep-first-ten.txt

git -C career-os diff --check
git -C career-os status --short
```

---

## common-pitfalls self-check

- 수치 보고는 `rg`, `wc -l`, `test` 출력만 사용한다.
- phase는 이전 phase 결과 없이 실행 가능해야 한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- `prep.md` 생성은 실제 Write/Edit로 수행한다. prose 보고만 하고 끝내지 않는다.
- `interview/history/`는 기본 생성하지 않는다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다. prose만 출력하면 success로 잘못 처리된다.

- `primary.data_root`가 없거나 CJ푸드빌 정본 경로를 결정할 수 없다.
- source 파일이 모두 없어 `prep.md`를 의미 있게 정제할 수 없다.
- docs/ADR/정책 문서 수정 없이는 `prep.md` 구조를 결정할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- `prep.md`를 만들지 않았다.
- 단순 concatenate로 장황한 원문 dump를 만들었다.
- 답변 기록 또는 피드백 로그를 `prep.md` 본문에 누적 데이터로 저장했다.
- `interview/history/`를 기본 생성했다.
- docs/ADR/정책 문서를 수정했다.
