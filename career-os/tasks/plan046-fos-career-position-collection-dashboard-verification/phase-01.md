# Phase 01 — 기존 수집 산출물과 dashboard DB/API 연결 읽기 전용 진단

**Model**: sonnet
**Status**: pending

---

## 목표

현재 career-os position 수집 산출물과 fos-career dashboard의 DB/API 연결 상태를 읽기 전용으로 확인한다.

이번 phase는 진단만 한다.
코드, DB 데이터, dashboard 화면, plan045, HUD 파일은 수정하지 않는다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 career-os repo-relative path와 `<fos-career-repo>`를 함께 확인한다.
`<fos-career-repo>`는 실행자가 로컬 환경이나 기존 배포 notes에서 확인한다.
task 파일과 보고서에는 사용자 로컬 절대 경로를 쓰지 않는다.

```bash
pwd
git status --short
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `AGENTS.md`
- `docs/data-schema.md` — `data/runtime/live-position-postings.md`
- `docs/flow.md` — `/position-recommender` 흐름
- `docs/code-architecture.md` — `scripts/position-recommender/` 구조와 fos-career 경계
- `tasks/plan039-fos-career-dashboard/index.json`
- `tasks/plan040-position-recommender-collector-modularization/index.json`

---

## 작업 항목

### 1. collector entrypoint와 source 목록 확인

```bash
ls scripts/position-recommender/collect_live_postings.ts
find scripts/position-recommender/live-postings/adapters -maxdepth 2 -type f | sort
rg -n "source|wanted|toss|selectAdapters|requestedSource" scripts/position-recommender
```

확인할 것:

- 기존 source 목록
- `--source all` 동작 여부
- source 실패가 어디에 기록되는지
- 수집 산출물 기본 경로

### 2. 기존 수집 산출물 확인

```bash
ls -l data/runtime/live-position-postings.md 2>/dev/null || true
sed -n '1,120p' data/runtime/live-position-postings.md 2>/dev/null || true
```

확인할 것:

- source별 수량
- source 오류 표시 여부
- 개별 공고의 필드 목록
- 중복 판단에 쓸 수 있는 source, external id, link 필드

### 3. fos-career 저장소와 DB/API 연결 확인

```bash
test -n "${FOS_CAREER_REPO:-}" || { echo "PHASE_BLOCKED: FOS_CAREER_REPO not set"; exit 2; }
test -d "$FOS_CAREER_REPO" || { echo "PHASE_BLOCKED: fos-career repository missing"; exit 2; }
find "$FOS_CAREER_REPO"/app "$FOS_CAREER_REPO"/lib "$FOS_CAREER_REPO"/db -maxdepth 3 -type f | sort
rg -n "positions|Position|DATABASE_URL|drizzle|mysql|career-os|frontdoor" "$FOS_CAREER_REPO"/app "$FOS_CAREER_REPO"/lib "$FOS_CAREER_REPO"/db "$FOS_CAREER_REPO"/docs
```

확인할 것:

- dashboard가 현재 어떤 파일 또는 DB에서 positions 데이터를 읽는지
- DB schema에 수집 공고를 담을 table이 있는지
- dashboard API 또는 server component가 전체 필드를 표시할 수 있는지
- 수동으로 실행할 가져오기 도구를 둘 자연스러운 위치

### 4. 진단 메모 작성

이 phase가 끝나면 다음 내용을 phase 결과로 보고한다.
별도 파일 작성은 하지 않는다.

- 기존 source 목록
- 기존 산출물 경로와 필드 목록
- fos-career의 현재 positions 표시 방식
- 가져오기 도구가 필요한지 여부
- phase 03에서 손댈 후보 파일

---

## 검증

보고 직전 반드시 실행한다.

```bash
git diff --name-only
git status --short
```

성공 기준:

- source 목록과 collector output 구조를 확인했다.
- fos-career DB/API/dashboard 연결 방식을 확인했다.
- 파일 변경이 없다.
- 읽기 전용 phase이므로 commit 대상이 없고 clean/no-change로 보고했다.
- plan-and-build runner의 기본 phase 진행 알림 외에 수동 알림을 중복하지 않았다.

---

## Blocked / Failed 조건

- `FOS_CAREER_REPO`를 확인할 수 없으면 `PHASE_BLOCKED: FOS_CAREER_REPO not set`를 출력하고 exit 2.
- `<fos-career-repo>`가 없으면 `PHASE_BLOCKED: fos-career repository missing`를 출력하고 exit 2.
- collector entrypoint가 없으면 `PHASE_BLOCKED: collector entrypoint missing`를 출력하고 exit 2.
- dashboard 연결 상태를 읽기 전용으로 판단할 수 없으면 `PHASE_BLOCKED: dashboard data path unclear`를 출력하고 exit 2.
- 파일이 변경되면 `PHASE_FAILED: read-only diagnosis changed files`를 출력하고 exit 1.
