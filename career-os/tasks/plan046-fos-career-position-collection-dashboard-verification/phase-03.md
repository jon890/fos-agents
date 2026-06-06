# Phase 03 — 필요 시 collector output을 dashboard DB로 옮기는 최소 가져오기 도구 구현

**Model**: sonnet
**Status**: pending

---

## 목표

collector output이 fos-career dashboard DB에 아직 연결되어 있지 않다면 최소 가져오기 도구를 구현한다.

가져오기 도구는 수집 결과 파일을 읽어서 fos-career DB에 넣는 CLI 수동 실행 도구다.
첫 실행은 dashboard 버튼이 아니라 명령줄에서 한다.

---

## 사전 cwd 설정

```bash
pwd
git status --short
test -n "${FOS_CAREER_REPO:-}" || { echo "PHASE_BLOCKED: FOS_CAREER_REPO not set"; exit 2; }
test -d "$FOS_CAREER_REPO" || { echo "PHASE_BLOCKED: fos-career repository missing"; exit 2; }
test -s data/runtime/plan046/live-position-postings-all.md || { echo "PHASE_BLOCKED: phase 02 collection output missing"; exit 2; }
```

`<fos-career-repo>`는 실행자가 로컬 환경이나 기존 배포 notes에서 확인한다.
task 파일과 보고서에는 사용자 로컬 절대 경로를 쓰지 않는다.
필요하면 `CAREER_OS_REPO="$(pwd)"`처럼 현재 workspace root를 변수로 잡아 쓴다.
phase 끝에서는 의도한 변경만 명시 stage하고 commit/push한다.
넓은 `git add .`는 쓰지 않는다.
관련 없는 dirty state를 다음 phase로 넘기지 않는다.
plan-and-build runner는 workspace env가 설정되어 있으면 notify_discord로 phase 진행 알림을 보낸다.
특별한 사용자 요약이 필요한 경우가 아니면 수동 알림을 중복하지 않는다.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/data-schema.md` — 수집 공고 필드와 dashboard DB 경계
- `docs/flow.md` — collector output 흐름
- `docs/code-architecture.md` — fos-career 분리 경계
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-01.md`
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-02.md`
- `<fos-career-repo>/AGENTS.md`
- `<fos-career-repo>/README.md`

---

## 작업 항목

### 1. 가져오기 도구 필요 여부 판단

먼저 fos-career가 이미 collector output을 DB 또는 화면으로 읽는지 확인한다.

```bash
rg -n "live-position-postings|position-postings|positions|source|external|link" "$FOS_CAREER_REPO"/app "$FOS_CAREER_REPO"/lib "$FOS_CAREER_REPO"/db "$FOS_CAREER_REPO"/docs
```

이미 충분한 연결이 있으면 구현하지 않는다.
그 경우 이 phase는 "가져오기 도구 불필요"로 보고하고 phase 04로 넘긴다.

### 2. 최소 DB 저장 구조 확인 또는 보강

필요하면 fos-career DB에 수집 공고 table을 추가한다.
가능한 한 기존 Drizzle/MySQL 구조를 따른다.

필수 저장 기준:

- source
- external id가 있으면 external id
- external id가 없으면 link
- title 또는 role
- company
- location
- tags 또는 stack
- posting status
- link type
- raw fields
- collected at
- source error summary가 있으면 별도 기록 또는 import run metadata

중복 처리는 `source + external id`를 우선하고, 없으면 `source + link` 기준으로 갱신 삽입한다.

### 3. collector output 파서 구현

`data/runtime/plan046/live-position-postings-all.md`를 읽어 DB row로 바꾼다.
markdown 문자열을 억지로 추측하기보다 기존 renderer 포맷을 읽고 안정적인 marker를 기준으로 파싱한다.
renderer 포맷이 불충분하면 이번 phase에서 구조화 output 옵션을 추가할지 판단한다.

구조화 output 옵션 추가가 필요하면 collector의 기존 markdown output은 유지한다.
새 옵션은 가져오기 도구 입력용으로만 추가한다.

### 4. CLI 수동 실행 도구 구현

권장 형태:

```bash
cd "$FOS_CAREER_REPO"
CAREER_OS_REPO="<career-os-repo>"
npm run import:positions -- --input "$CAREER_OS_REPO/data/runtime/plan046/live-position-postings-all.md"
```

실제 package manager와 script 이름은 fos-career 기존 관례에 맞춘다.
사용자에게 보이는 설명에는 "가져오기 도구"라고 쓴다.

### 5. 첫 수동 실행

```bash
cd "$FOS_CAREER_REPO"
# 실제 script 이름으로 바꿔 실행한다.
CAREER_OS_REPO="<career-os-repo>"
npm run import:positions -- --input "$CAREER_OS_REPO/data/runtime/plan046/live-position-postings-all.md"
```

실행 결과로 다음을 확인한다.

- inserted 수
- updated 수
- skipped 수
- source error summary 기록 여부
- 실패 시 원인

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd "$FOS_CAREER_REPO"
npm run build

# 실제 DB 확인 명령은 구현한 schema와 script에 맞춰 조정한다.
rg -n "import:positions|positions|external|source" package.json db lib app
git status --short
```

성공 기준:

- 필요한 경우 수동 실행 가능한 가져오기 도구가 있다.
- 성공한 source의 공고가 fos-career DB에 들어갔다.
- 실패 source 정보가 사라지지 않았다.
- 중복 기준이 source와 external id 또는 link를 사용한다.
- dashboard 버튼으로 수집 실행을 만들지 않았다.
- phase 끝에서 fos-career의 의도한 변경만 commit/push하고 commit hash를 runner 기록에 남겼다.
- career-os 변경이 있으면 의도한 파일만 별도 commit/push했거나, 변경 없음으로 보고했다.
- 관련 없는 dirty state를 다음 phase로 넘기지 않았다.

---

## Blocked / Failed 조건

- `FOS_CAREER_REPO`를 확인할 수 없으면 `PHASE_BLOCKED: FOS_CAREER_REPO not set`를 출력하고 exit 2.
- `<fos-career-repo>`가 없으면 `PHASE_BLOCKED: fos-career repository missing`를 출력하고 exit 2.
- phase 02 수집 산출물이 없으면 `PHASE_BLOCKED: phase 02 collection output missing`를 출력하고 exit 2.
- DB 연결 정보가 없어 수동 실행을 검증할 수 없으면 `PHASE_BLOCKED: dashboard database unavailable`를 출력하고 exit 2.
- collector output에서 공고 row를 안정적으로 만들 수 없으면 `PHASE_BLOCKED: collector output format insufficient for import`를 출력하고 exit 2.
- 수동 실행 후 DB에 성공 공고가 없으면 `PHASE_FAILED: imported position rows missing`를 출력하고 exit 1.
- unrelated dirty files 때문에 커밋 범위를 분리할 수 없으면 `PHASE_BLOCKED: commit scope unclear due to unrelated dirty files`를 출력하고 exit 2.
