# Phase 03 — active code와 config coffeechat cleanup

**Model**: sonnet
**Status**: completed

---

## 목표

coffeechat tombstone skill/script 디렉터리와 active config/schema compatibility를 제거한다.

`interview-prep-analyzer`는 `first_round`, `final_round`, `offer_chat`만 지원하게 유지한다.

## 실행 원칙

Phase 02 완료 뒤에만 실행한다.
같은 plan 안의 phase는 병렬 실행하지 않는다.

HUD는 구현 시작 시 `implementation running`, 보류 시 `implementation blocked`, 실패 시 `implementation failed`로 갱신한다.

## 범위

- `.claude/skills/interview-coffeechat-prep/` 제거.
- `scripts/interview-coffeechat-prep/` 제거.
- `config/mvp-target.json`의 `primary.interview.coffeechat` field 제거.
- `scripts/interview-prep-analyzer/mvp_target_schema.ts`의 coffeechat compatibility 제거.
- 필요 시 `scripts/interview-prep-analyzer/collect_interview_sites.ts`의 active 지원 mode 설명 정리.

## 비범위

- `interview-prep-analyzer` 신규 기능 구현.
- `first_round`, `final_round`, `offer_chat` 구조 변경.
- 오래된 data archive/report output 삭제.
- 과거 task 기록 삭제.
- 과거 ADR 본문 삭제.
- fos-career 수정.
- commit, push, PR 생성.

## 작업 항목

1. Phase 01 inventory와 Phase 02 docs cleanup 결과를 확인한다.
2. `.claude/skills/interview-coffeechat-prep/`와 `scripts/interview-coffeechat-prep/`를 제거한다.
3. `config/mvp-target.json`에서 `primary.interview.coffeechat` field를 제거하고 JSON을 정렬 상태로 유지한다.
4. `mvp_target_schema.ts`에서 coffeechat nullable optional compatibility를 제거한다.
5. analyzer의 supported mode union과 runtime validation이 `first_round`, `final_round`, `offer_chat`만 허용하는지 확인한다.

## 검증 명령

```bash
cd "$(git rev-parse --show-toplevel)/career-os"

test ! -e .claude/skills/interview-coffeechat-prep
test ! -e scripts/interview-coffeechat-prep

python3 -m json.tool config/mvp-target.json >/tmp/plan066-mvp-target.json

python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("config/mvp-target.json").read_text())
interview = data["primary"]["interview"]
assert "coffeechat" not in interview
assert set(interview.keys()) == {"first_round", "final_round", "offer_chat"}
print(sorted(interview.keys()))
PY

rg -n "coffeechat|coffee chat|interview-coffeechat-prep|primary\\.interview\\.coffeechat" \
  config \
  scripts/interview-prep-analyzer \
  .claude/skills \
  --glob '!**/node_modules/**'

bun scripts/interview-prep-analyzer/mvp_target_schema.ts config/mvp-target.json
git diff --check
git status --short
```

`rg` 결과가 남는다면 active compatibility인지 history-only safety warning인지 판단한다.
이 phase의 기본 기대는 active code/config/schema 영역에서 coffeechat match가 없는 것이다.

## 성공 기준

- coffeechat tombstone skill 디렉터리가 제거됐다.
- coffeechat tombstone script 디렉터리가 제거됐다.
- `config/mvp-target.json`에 `primary.interview.coffeechat` field가 없다.
- schema/parser가 coffeechat compatibility를 허용하지 않는다.
- analyzer 지원 stage는 `first_round`, `final_round`, `offer_chat`만 남는다.
- 오래된 archive/report output은 삭제하지 않았다.

## common-pitfalls self-check

- 삭제 범위를 tombstone skill/script 디렉터리 밖으로 넓히지 않는다.
- `first_round`, `final_round`, `offer_chat` 필드를 실수로 삭제하지 않는다.
- config JSON trailing comma나 formatting 오류를 만들지 않는다.
- data retention cleanup을 이 phase에 끼워 넣지 않는다.

## PHASE_BLOCKED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `PHASE_BLOCKED: Phase 02 docs cleanup is incomplete`
- `PHASE_BLOCKED: mvp-target interview schema cannot be changed without new docs decision`
- `PHASE_BLOCKED: analyzer still depends on coffeechat field for non-coffeechat stages`
- `PHASE_BLOCKED: conflicting dirty changes in code or config cleanup target`

## PHASE_FAILED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- `first_round`, `final_round`, `offer_chat` 지원을 깨뜨렸다.
- 오래된 data archive/report output을 삭제했다.
- 과거 task 기록이나 과거 ADR 본문을 삭제했다.
- fos-career를 수정했다.
- apartment repo 변경을 수정, stage, revert했다.
