# Phase 03 — fos-career prep.md 표시와 질문 파싱

**Model**: sonnet
**Status**: pending

---

## 목표

`/home/bifos/services/fos-career` dashboard와 adapter/UI를 `career-os/config/mvp-target.json`의 `primary.data_root/interview/prep.md` 중심으로 전환한다.
면접 hub는 여러 markdown asset card 대신 `prep.md`를 primary markdown으로 보여주고, 예상 질문 드롭다운은 `prep.md`의 질문 섹션에서 파싱한다.

**범위 외**: career-os 내부 skill/processor 변경은 Phase 02, legacy split 파일 삭제는 Phase 04에서 수행한다. request result visibility 개선과 DB schema 확장은 이번 plan 범위 밖이다.

---

## 강제 경계

- `/home/bifos/services/fos-career`는 career-os와 별도 git repo다. 각 repo의 dirty state를 따로 확인하고 intended files만 수정한다.
- dashboard는 career-os 파일을 read-only로 읽는다. writable mount를 추가하지 않는다.
- processor만 필요한 경우 host-side writable checkout에서 허용된 작업을 수행한다.
- private 문서 본문, 면접 답변 전문, 상세 피드백, command stdout 전체를 request result/audit log/Discord에 복사하지 않는다.
- docs/ADR/정책 문서는 수정하지 않는다.
- 별도 DB 컨테이너를 새로 만들지 않는다.

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

- `career-os/docs/adr.md`의 ADR-061, ADR-062, ADR-063
- `career-os/docs/data-schema.md`의 position home 구조
- `career-os/docs/flow.md`의 dashboard와 processor request 흐름
- `career-os/docs/code-architecture.md`의 fos-career 별도 repo 경계
- `career-os/docs/prd.md`의 plan060 면접 hub 범위
- `/home/bifos/services/fos-career`의 README, package scripts, career-os adapter, interview hub 관련 파일

---

## 작업 항목

### 1. fos-career adapter 조사

`/home/bifos/services/fos-career`에서 career-os root, mvp-target, interview hub, markdown view link, question dropdown, request processor 관련 파일을 찾는다.
split 파일 경로는 runtime source 또는 primary UI asset이면 제거하고, fixture/history라면 보고에 이유를 남긴다.

### 2. primary markdown projection 전환

adapter가 `config/mvp-target.json`을 읽고 `primary.data_root/interview/prep.md`를 primary markdown으로 resolve하게 한다.
하드코딩된 CJ푸드빌 경로가 필요하면 config에서 온 display value로만 사용하고, source path fallback으로 쓰지 않는다.

### 3. 예상 질문 파서 구현 또는 교체

질문 dropdown은 `prep.md`의 `예상 질문 드릴` 섹션에서 Markdown list 또는 numbered list를 파싱한다.
질문 섹션이 없거나 질문이 비어 있으면 dashboard가 빈 상태를 보여주고, legacy split 파일로 fallback하지 않는다.

### 4. markdown 보기 링크 정리

면접 hub의 markdown 보기 링크와 asset card 구성을 `prep.md` 중심으로 정리한다.
답변 기록과 피드백 기록은 별도 데이터/DB 흐름으로 유지하되, `prep.md`와 같은 primary asset card로 섞지 않는다.

### 5. build와 read-only mount 확인

repo의 package manager와 scripts를 확인하고 표준 build 또는 typecheck를 실행한다.
Docker compose나 env에서 dashboard career-os mount가 read-only인지 확인한다.

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw count를 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
python3 -m json.tool career-os/config/mvp-target.json >/tmp/plan062-mvp-target.json

rg -n "interview/prep\\.md|prepMarkdown|prepPath|primaryMarkdown|mvp-target|data_root" \
  /home/bifos/services/fos-career \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/coverage/**' \
  | tee /tmp/plan062-fos-career-prep-refs.txt
PREP_REF_COUNT=$(wc -l </tmp/plan062-fos-career-prep-refs.txt)
echo "[fos-career prep refs] $PREP_REF_COUNT"
test "$PREP_REF_COUNT" -gt 0

rg -n "current-practice\\.md|interview/reports|interview-prep-10-day-java-materials\\.md|data/prep|strategy\\.md|checklist\\.md" \
  /home/bifos/services/fos-career \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  -g '!**/coverage/**' \
  | tee /tmp/plan062-fos-career-split-primary-refs.txt
SPLIT_COUNT=$(wc -l </tmp/plan062-fos-career-split-primary-refs.txt)
echo "[fos-career split primary refs] $SPLIT_COUNT"
test "$SPLIT_COUNT" -eq 0

rg -n ":ro|read_only|readonly|CAREER_OS_ROOT" \
  /home/bifos/services/fos-career/docker-compose*.yml \
  /home/bifos/services/fos-career/.env.example \
  /home/bifos/services/fos-career 2>/tmp/plan062-readonly-rg.err \
  -g '!**/node_modules/**' \
  -g '!**/.next/**' \
  -g '!**/dist/**' \
  | tee /tmp/plan062-fos-career-readonly-refs.txt || true
READONLY_COUNT=$(wc -l </tmp/plan062-fos-career-readonly-refs.txt)
echo "[fos-career readonly refs] $READONLY_COUNT"

git -C /home/bifos/services/fos-career diff --check
git -C /home/bifos/services/fos-career status --short
```

fos-career 표준 build 또는 typecheck:

```bash
cd /home/bifos/services/fos-career
npm run build
```

`npm run build`가 repo 표준이 아니면 `package.json`을 읽고 가장 가까운 build/typecheck/smoke 명령으로 대체하되, 대체 이유와 출력 요약을 보고한다.

---

## common-pitfalls self-check

- `/home/bifos/services/fos-career`는 명시적으로 포함된 별도 repo이므로 git 상태와 수정 범위를 따로 보고한다.
- 수치 보고는 실측 grep count만 사용한다.
- legacy fallback을 추가하지 않는다.
- read-only mount 원칙을 유지한다.
- docs/ADR/정책 문서는 수정하지 않는다.
- 첫 bash 블록에 `cd "$(git rev-parse --show-toplevel)"`가 있다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- fos-career가 현재 career-os root나 mvp-target 파일에 접근할 방법이 없다.
- 질문 dropdown이 legacy split 파일 없이는 구현 불가능한 UI 구조다.
- writable dashboard mount 없이는 구현이 불가능하다.
- docs/ADR/정책 문서 수정 없이는 `prep.md` primary projection을 적용할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`을 실행한다.

- dashboard primary markdown source로 split 파일 경로가 남았다.
- 질문 dropdown이 `prep.md` 대신 legacy split 파일을 파싱한다.
- dashboard에 writable career-os mount를 추가했다.
- request/audit에 private 본문이나 command stdout 전체를 저장했다.
