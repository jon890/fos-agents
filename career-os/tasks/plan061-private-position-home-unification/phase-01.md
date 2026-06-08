# Phase 01 — career-os legacy runtime source 제거

## 목표

career-os 안의 runtime caller, processor 성격 스크립트, native skill prompt가 CJ푸드빌 면접 준비 자료를 legacy 경로에서 정본으로 읽지 않게 한다.
정본은 `career-os/config/mvp-target.json`의 `primary.data_root`가 가리키는 `career-os/private/cj-foodville/digital-channel-backend/`다.

**범위 외**: `/home/bifos/services/fos-career` 수정은 Phase 02, 통합 cleanup 검증은 Phase 03에서 수행한다. dashboard result UI 개선은 다음 plan에서 별도로 다룬다.

## 강제 경계

- 구현 phase에서 `career-os/docs/`, `career-os/AGENTS.md`, `career-os/TOOLS.md` 같은 docs/ADR/정책 문서를 수정하지 않는다.
- 문서 계약 변경이 필요할 만큼 ADR-062 해석이 애매하면 구현하지 말고 `PHASE_BLOCKED: docs contract needed for data_root unification`을 출력한 뒤 실패/보류 exit code로 종료한다.
- 기존 dirty state나 다른 사람이 만든 변경을 되돌리지 않는다. intended files만 수정한다.
- `private/` 내용을 `sources/fos-study/`로 그대로 복사하지 않는다. 공개 공부팩이 필요하면 public-safe 재작성만 허용한다.

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 ai-nodes 루트로 이동한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
git -C career-os status --short
```

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-062
- `career-os/docs/data-schema.md`의 `config/mvp-target.json`과 `private/<company-slug>/<position-slug>/`
- `career-os/docs/flow.md`의 data 경계와 보존 흐름
- `career-os/docs/code-architecture.md`의 native skill, scripts, runtime 책임
- `career-os/docs/prd.md`의 plan060과 면접 hub 범위
- `career-os/config/mvp-target.json`

## 작업 항목

### 1. legacy runtime source 사용처 분류

다음 문자열을 전수 검색하고 runtime source로 쓰는 코드와 prompt만 분류한다.

- `data/runtime/interview-drill.md`
- `data/reports/daily/.*/interview-drill`
- `data/reports/daily/YYYY-MM-DD/interview-drill`
- `data/cj-foodville`
- `interview-drill`

검색 대상은 최소한 `career-os/.claude/skills/`, `career-os/scripts/`, `career-os/config/`, `career-os/tasks/plan060-interview-skill-request-gateway/`와 현재 task 구현에 영향을 주는 runtime caller다.
단, 과거 task/history/docs의 단순 기록은 수정하지 않는다.

### 2. `primary.data_root` helper 사용 또는 추가

career-os 코드가 이미 `parseMvpTarget()` 또는 동등한 helper를 제공하면 재사용한다.
필요하면 작은 helper를 추가해 `config/mvp-target.json`을 읽고 `primary.data_root`를 career-os 루트 기준 absolute path로 resolve한다.
legacy fallback은 추가하지 않는다.

### 3. runtime caller와 skill prompt 경로 교체

면접 연습, report, study material 위치를 정본 구조로 읽게 한다.
권장 정본 하위 경로는 docs 계약을 따른다.

- `private/<company>/<position>/interview/current-practice.md`
- `private/<company>/<position>/interview/reports/YYYY-MM-DD.md`
- `private/<company>/<position>/interview/answers/`
- `private/<company>/<position>/interview/feedback/`
- `private/<company>/<position>/study/`

`data/runtime/interview-drill.md`, `data/reports/daily/*/interview-drill`, `data/cj-foodville`를 새 runtime source로 읽는 코드는 제거하거나 `primary.data_root` 기반으로 수정한다.

### 4. 대체 완료된 legacy mirror 제거

새 정본 파일이 존재하고 내용이 대체됐음을 확인한 legacy runtime/report/mirror 파일만 archive 없이 제거한다.
대체 여부가 불명확하면 삭제하지 말고 Phase 03 검증 보고에 남긴다.

### 5. public-safe 경계 확인

study-pack 관련 prompt나 runner가 private 답변, 지원 전략, 회사별 민감 맥락을 fos-study로 그대로 복사하지 않게 확인한다.
필요하면 public-safe 재작성 지시만 보강한다.

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/config/mvp-target.json >/tmp/plan061-mvp-target.json

rg -n "data/runtime/interview-drill\\.md|data/reports/daily/.*/interview-drill|data/reports/daily/YYYY-MM-DD/interview-drill|data/cj-foodville" \
  career-os/.claude/skills career-os/scripts career-os/config \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  | tee /tmp/plan061-career-os-legacy-runtime-source.txt
COUNT=$(wc -l </tmp/plan061-career-os-legacy-runtime-source.txt)
echo "[career-os legacy runtime source count] $COUNT"
test "$COUNT" -eq 0

rg -n "primary\\.data_root|data_root|parseMvpTarget|private/cj-foodville/digital-channel-backend" \
  career-os/.claude/skills career-os/scripts career-os/config \
  | tee /tmp/plan061-career-os-data-root-refs.txt
REF_COUNT=$(wc -l </tmp/plan061-career-os-data-root-refs.txt)
echo "[career-os data_root reference count] $REF_COUNT"
test "$REF_COUNT" -gt 0

git -C career-os diff --check
git -C career-os status --short
```

## common-pitfalls self-check

- 수치 보고는 `rg`와 `wc -l` 출력만 사용한다.
- phase는 이전 phase 결과 없이 실행 가능해야 한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- 다른 사람의 dirty file을 되돌리거나 stage하지 않는다.
- legacy 제거는 반증 grep count 0으로 검증한다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다. prose만 출력하면 success로 잘못 처리된다.

- `primary.data_root` 계약만으로 정본 경로를 결정할 수 없다.
- legacy 파일이 정본으로 대체됐는지 판단할 근거가 없어서 삭제/유지가 모두 위험하다.
- docs/ADR/정책 문서 수정 없이는 구현이 불가능하다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- 검증 grep에서 runtime source legacy 경로가 남았다.
- legacy fallback을 추가했다.
- private 본문을 공개 fos-study 경로로 복사했다.
- docs/ADR/정책 문서를 수정했다.
