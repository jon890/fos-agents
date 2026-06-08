# Phase 03 — 통합 검증과 cleanup

## 목표

career-os와 fos-career 양쪽에서 ADR-062 적용이 끝났는지 검증하고, 새 정본으로 대체된 legacy runtime/report/mirror 파일만 정리한다.
검증 결과와 HUD completion event까지 확인한 뒤 task index를 완료 상태로 갱신한다.

**범위 외**: 새 기능 추가, dashboard UX polish, request result visibility UI/DB schema 개선, docs/ADR/정책 문서 수정, 외부 제출/공개 발행은 하지 않는다.

## 강제 경계

- 구현 phase에서 `career-os/docs/`, `career-os/AGENTS.md`, `career-os/TOOLS.md`, fos-career 정책/ADR 문서를 수정하지 않는다.
- cleanup은 새 정본으로 대체가 확인된 legacy runtime/report/mirror 파일에 한정한다.
- 삭제 전에는 파일 경로와 대체 정본 경로를 stdout에 출력한다. 불확실하면 삭제하지 않고 `PHASE_BLOCKED` 또는 보고 항목으로 남긴다.
- 기존 dirty state나 다른 사람이 만든 변경을 되돌리지 않는다.

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 첫 bash에서 ai-nodes 루트로 이동하고, fos-career는 `git -C`로 다룬다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
git -C career-os status --short
git -C /home/bifos/services/fos-career status --short
```

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-062
- `career-os/docs/data-schema.md`의 data 경계와 position home 구조
- `career-os/docs/flow.md`의 data 보존 흐름
- `career-os/docs/code-architecture.md`의 fos-career 별도 repo 경계
- 이 task의 `phase-01.md`, `phase-02.md`

## 작업 항목

### 1. legacy runtime source grep 통합 검증

career-os runtime caller, native skill prompt, fos-career adapter/processor/UI에서 legacy 경로가 runtime source로 남지 않았는지 확인한다.
과거 task/history/docs에 남은 기록은 runtime source가 아니면 허용하되, grep 결과와 제외 이유를 보고한다.

### 2. 정본 파일 존재 확인

`config/mvp-target.json`의 `primary.data_root`를 읽고 다음 정본 후보가 존재하는지 확인한다.

- position home directory
- `interview/`
- `study/`
- `manifest.json` 또는 README 성격의 index 파일

없는 파일은 무조건 생성하지 말고 이전 phase 산출물과 docs 계약을 확인한다.
정본 자체가 없으면 `PHASE_BLOCKED`로 보고한다.

### 3. legacy 파일 cleanup

다음 파일 또는 디렉터리가 존재하고 새 정본으로 대체됐으면 제거한다.

- `career-os/data/runtime/interview-drill.md`
- `career-os/data/reports/daily/*/interview-drill/`
- `career-os/data/cj-foodville/`

대체 여부가 불명확하면 제거하지 않는다.
archive 없이 제거 가능한 것은 ADR-062가 허용한 새 정본 대체 완료 legacy runtime/report/mirror에 한정한다.

### 4. build/smoke와 docker health 확인

career-os는 변경된 코드에 맞는 좁은 검증을 실행한다.
fos-career는 repo 표준 build 또는 smoke를 실행한다.
docker compose 또는 systemd로 dashboard가 떠 있다면 health/status를 확인하되, 새 DB 컨테이너를 만들지 않는다.

### 5. task index와 HUD completion

검증이 끝나면 `career-os/tasks/plan061-private-position-home-unification/index.json`의 status/current_phase/phase status/updated_at을 완료 상태로 갱신한다.
HUD completion event가 자동 반영됐는지 확인하고, stale이면 메인 세션에 refresh 필요를 보고한다.

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/tasks/plan061-private-position-home-unification/index.json >/tmp/plan061-index.json
python3 -m json.tool career-os/config/mvp-target.json >/tmp/plan061-mvp-target.json

DATA_ROOT=$(python3 - <<'PY'
import json
from pathlib import Path
data = json.loads(Path("career-os/config/mvp-target.json").read_text())
print(data["primary"]["data_root"])
PY
)
echo "[primary.data_root] $DATA_ROOT"
test "$DATA_ROOT" = "private/cj-foodville/digital-channel-backend"
test -d "career-os/$DATA_ROOT"

rg -n "data/runtime/interview-drill\\.md|data/reports/daily/.*/interview-drill|data/reports/daily/YYYY-MM-DD/interview-drill|data/cj-foodville" \
  career-os/.claude/skills career-os/scripts career-os/config /home/bifos/services/fos-career \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/coverage/**' \
  | tee /tmp/plan061-final-legacy-runtime-source.txt
COUNT=$(wc -l </tmp/plan061-final-legacy-runtime-source.txt)
echo "[final legacy runtime source count] $COUNT"
test "$COUNT" -eq 0

for path in \
  career-os/data/runtime/interview-drill.md \
  career-os/data/cj-foodville
do
  if [ -e "$path" ]; then
    echo "[legacy still exists] $path"
    exit 1
  fi
done

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

HUD completion event 확인은 현재 OpenClaw 환경에서 가능한 명령으로 수행한다.
도구가 없거나 권한이 없으면 실패로 만들지 말고 "HUD 확인 불가"와 필요한 follow-up을 보고한다.

## common-pitfalls self-check

- grep count, file existence, build 결과는 실제 명령 출력만 보고한다.
- cleanup은 정본 대체 확인된 legacy runtime/report/mirror에 한정한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- `index.json`은 trailing newline이 있는 valid JSON으로 저장한다.
- `git status --short`로 unrelated dirty state를 확인하고 intended files만 stage한다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- `primary.data_root` 정본 디렉터리가 없다.
- legacy 파일이 정본으로 대체됐는지 판단할 수 없다.
- docker health나 HUD 확인 방식이 운영 문서 없이 불명확하고 검증 결론에 영향을 준다.
- docs/ADR/정책 문서 수정 없이는 완료 판정을 내릴 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- final legacy runtime source grep count가 0이 아니다.
- `primary.data_root`가 `private/cj-foodville/digital-channel-backend`가 아니다.
- 정본 대체가 불명확한 파일을 삭제했다.
- build/smoke가 실패했는데 원인을 보고하지 않았다.
- docs/ADR/정책 문서를 수정했다.
