# Phase 04 — policy grep, schema smoke, fos-career 부재 검증

**Model**: haiku
**Status**: completed

---

## 목표

coffeechat reference가 active 영역에서 제거됐고 history-only 영역에만 남았는지 검증한다.

career-os schema smoke와 fos-career 부재 검증을 수행하고 task 실행 결과를 정리한다.

## 실행 원칙

Phase 03 완료 뒤에만 실행한다.
같은 plan 안의 phase는 병렬 실행하지 않는다.

검증 완료 시 HUD를 `implementation completed`로 갱신한다.
실패 시 `implementation failed`, 보류 시 `implementation blocked`로 갱신한다.

## 범위

- career-os active reference 정책 grep.
- history-only reference 정책 grep.
- `config/mvp-target.json` JSON smoke.
- `scripts/interview-prep-analyzer/mvp_target_schema.ts` schema smoke.
- 가능한 범위의 Bun/TypeScript 검증.
- `~/services/fos-career` coffeechat reference 부재 확인.
- task `index.json` status, verification, HUD 결과 정리.

## 비범위

- 추가 구현 cleanup.
- fos-career 수정.
- data retention cleanup.
- 과거 ADR/task history 수정.
- commit, push, PR 생성.

## 작업 항목

1. career-os active 영역에서 coffeechat reference가 남았는지 정책 grep을 실행한다.
2. `docs/adr.md`와 과거 task 기록에는 history-only reference가 남아 있음을 확인한다.
3. JSON과 schema smoke를 실행한다.
4. fos-career에는 coffeechat reference가 없음을 확인한다.
5. 검증 결과와 예외적으로 남은 history-only reference를 `index.json`에 정리한다.

## 검증 명령

```bash
cd "$(git rev-parse --show-toplevel)/career-os"

git status --short

rg -n "coffeechat|coffee chat|interview-coffeechat-prep|primary\\.interview\\.coffeechat" \
  AGENTS.md \
  TOOLS.md \
  docs \
  config \
  scripts \
  .claude/skills \
  --glob '!docs/adr.md' \
  --glob '!tasks/**' \
  --glob '!data/**' \
  --glob '!private/**'

rg -n "coffeechat|coffee chat|interview-coffeechat-prep|primary\\.interview\\.coffeechat" \
  docs/adr.md \
  tasks/plan021-* \
  tasks/plan041-* \
  tasks/plan056-*

python3 -m json.tool config/mvp-target.json >/tmp/plan066-mvp-target.json

python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("config/mvp-target.json").read_text())
interview = data["primary"]["interview"]
assert "coffeechat" not in interview
assert set(interview.keys()) == {"first_round", "final_round", "offer_chat"}
print("interview modes:", ", ".join(sorted(interview)))
PY

bun scripts/interview-prep-analyzer/mvp_target_schema.ts config/mvp-target.json

rg -n "coffeechat|coffee chat|interview-coffeechat-prep|primary\\.interview\\.coffeechat" \
  ~/services/fos-career \
  --glob '!node_modules/**' \
  --glob '!.next/**' \
  --glob '!db/data/**'

git diff --check
git status --short
```

첫 번째 active grep은 결과가 없는 것을 기대한다.
남은 결과가 있다면 history-only가 아니라 active 누수로 보고 phase를 실패 처리한다.

두 번째 history grep은 결과가 있는 것을 기대한다.
과거 이력이 사라졌다면 보존 정책 위반으로 실패 처리한다.

fos-career grep은 결과가 없는 것을 기대한다.
결과가 있다면 이번 plan에서 수정하지 말고 `PHASE_BLOCKED`로 보고한다.

## 성공 기준

- career-os active docs, guide, config, scripts, skills에서 coffeechat reference가 제거됐다.
- coffeechat reference는 `docs/adr.md`와 보존 대상 task history에만 남는다.
- `config/mvp-target.json`은 유효한 JSON이다.
- schema smoke가 통과한다.
- `interview-prep-analyzer` 지원 stage는 `first_round`, `final_round`, `offer_chat`뿐이다.
- fos-career에 coffeechat reference가 없다.
- task `index.json`에 검증 결과와 HUD 결과가 정리됐다.

## common-pitfalls self-check

- active grep 결과를 무시하고 완료 처리하지 않는다.
- history grep 결과가 없어도 성공으로 처리하지 않는다.
- fos-career 결과가 나오면 이번 plan에서 수정하지 않고 보류한다.
- 검증 phase에서 새 cleanup 구현을 시작하지 않는다.

## PHASE_BLOCKED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `PHASE_BLOCKED: fos-career contains coffeechat references outside this plan scope`
- `PHASE_BLOCKED: remaining active reference requires a new decision`
- `PHASE_BLOCKED: validation cannot distinguish active reference from history-only reference`
- `PHASE_BLOCKED: conflicting dirty changes prevent final verification`

## PHASE_FAILED

다음 경우에는 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- active 영역에 coffeechat reference가 남았는데 완료 처리했다.
- history-only reference를 삭제했다.
- schema smoke 실패를 무시했다.
- fos-career를 수정했다.
- commit, push, PR을 생성했다.
- apartment repo 변경을 수정, stage, revert했다.
