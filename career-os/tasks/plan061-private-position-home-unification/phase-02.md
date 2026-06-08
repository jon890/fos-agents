# Phase 02 — fos-career data_root 통일

## 목표

별도 repo인 `/home/bifos/services/fos-career`의 dashboard projection과 processor가 career-os의 `config/mvp-target.json` `primary.data_root`만 따라가게 한다.
read-only mount 원칙을 유지하고 legacy fallback을 추가하지 않는다.

**범위 외**: career-os 내부 legacy 제거는 Phase 01, 통합 cleanup은 Phase 03에서 수행한다. request result UI/DB schema 개선은 다음 plan에서 별도로 다룬다.

## 강제 경계

- 구현 phase에서 `career-os/docs/`, `career-os/AGENTS.md`, `career-os/TOOLS.md`, fos-career의 정책/ADR 성격 문서를 수정하지 않는다.
- 문서 계약 변경이 필요하면 `PHASE_BLOCKED: fos-career data_root contract needs docs update`로 멈춘다.
- `/home/bifos/services/fos-career`는 이 plan의 구현 대상이지만 ai-nodes와 별도 git repo다. 각 repo의 dirty state를 따로 확인하고 intended files만 수정한다.
- dashboard container는 career-os를 writable로 mount하지 않는다. processor가 필요한 경우에만 host-side writable checkout에서 작업한다.

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

- `career-os/docs/adr.md`의 ADR-046, ADR-053, ADR-054, ADR-060, ADR-061, ADR-062
- `career-os/docs/data-schema.md`의 `config/mvp-target.json`과 position home 섹션
- `career-os/docs/flow.md`의 dashboard와 processor request 흐름
- `career-os/docs/code-architecture.md`의 fos-career 별도 repo 경계
- `/home/bifos/services/fos-career`의 README, package scripts, career-os adapter/processor 관련 파일

## 작업 항목

### 1. fos-career career-os adapter 조사

`/home/bifos/services/fos-career`에서 career-os root, mvp-target, interview hub, request processor, file link 생성 코드를 찾는다.
legacy 경로 문자열은 다음 기준으로 분류한다.

- runtime source로 쓰면 제거 대상.
- 과거 migration note, test fixture, task history면 유지 가능하나 검증 보고에 이유를 남긴다.

### 2. `primary.data_root` projection 통일

dashboard projection은 career-os read-only mount에서 `config/mvp-target.json`을 읽고 `primary.data_root`를 resolve한다.
하드코딩된 `private/cj-foodville/digital-channel-backend`는 표시용 기본값이나 fixture가 아니라면 제거한다.
`data/runtime/interview-drill.md`, `data/reports/daily/*/interview-drill`, `data/cj-foodville` fallback은 추가하지 않는다.

### 3. processor 경로 통일

request processor가 생성/갱신 파일 경로를 계산할 때 `primary.data_root`를 사용하게 한다.
processor가 career-os write 작업을 수행해야 하면 dashboard app container가 아니라 host-side processor 또는 writable checkout 경계에서만 수행한다.
request/audit에는 private 본문이나 command stdout 전체를 저장하지 않는다.

### 4. read-only mount 유지 확인

Docker compose, env, adapter 설정에서 dashboard의 career-os mount가 read-only인지 확인한다.
read-only가 깨져 있으면 원래 원칙대로 복구한다.
별도 DB 컨테이너를 새로 만들지 않는다.

### 5. 단위 검증과 build

fos-career의 기존 package manager와 script를 확인한 뒤 가능한 가장 좁은 검증을 실행한다.
권장 순서: typecheck 또는 lint, 그다음 `npm run build` 또는 repo가 제공하는 equivalent build.

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/config/mvp-target.json >/tmp/plan061-mvp-target.json

rg -n "data/runtime/interview-drill\\.md|data/reports/daily/.*/interview-drill|data/reports/daily/YYYY-MM-DD/interview-drill|data/cj-foodville" \
  /home/bifos/services/fos-career \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/coverage/**' \
  | tee /tmp/plan061-fos-career-legacy-runtime-source.txt
COUNT=$(wc -l </tmp/plan061-fos-career-legacy-runtime-source.txt)
echo "[fos-career legacy runtime source count] $COUNT"
test "$COUNT" -eq 0

rg -n "primary\\.data_root|data_root|mvp-target" \
  /home/bifos/services/fos-career \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  | tee /tmp/plan061-fos-career-data-root-refs.txt
REF_COUNT=$(wc -l </tmp/plan061-fos-career-data-root-refs.txt)
echo "[fos-career data_root reference count] $REF_COUNT"
test "$REF_COUNT" -gt 0

git -C /home/bifos/services/fos-career diff --check
git -C /home/bifos/services/fos-career status --short
```

추가로 repo에 맞는 검증 명령을 실행한다.

```bash
cd /home/bifos/services/fos-career
npm run build
```

`npm run build`가 repo 표준이 아니면 `package.json`을 읽고 가장 가까운 build/typecheck/smoke 명령으로 대체하되, 대체 이유와 출력 요약을 보고한다.

## common-pitfalls self-check

- `/home/bifos/services/fos-career`는 명시적으로 포함된 별도 repo이므로 git 상태와 수정 범위를 따로 보고한다.
- 수치 보고는 실측 grep count만 사용한다.
- legacy fallback을 추가하지 않는다.
- read-only mount 원칙을 유지한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- fos-career가 현재 career-os root나 mvp-target 파일에 접근할 방법이 없다.
- writable dashboard mount 없이는 구현이 불가능한 구조다.
- docs/ADR/정책 문서 수정 없이는 data_root 계약을 적용할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- fos-career runtime source grep count가 0이 아니다.
- dashboard에 writable career-os mount를 추가했다.
- legacy fallback을 추가했다.
- request/audit에 private 본문이나 command stdout 전체를 저장했다.
