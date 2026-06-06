# Phase 04 — dashboard 전체 필드 표시와 화면 검증

**Model**: sonnet
**Status**: pending

---

## 목표

fos-career dashboard 화면에서 수집 공고가 실제로 보이는지 확인한다.
초기 화면에는 사용 가능한 모든 position 필드를 보여준다.

성공 기준은 파일이나 DB 저장이 아니라 dashboard 화면 표시다.

---

## 사전 cwd 설정

```bash
pwd
git status --short
test -n "${FOS_CAREER_REPO:-}" || { echo "PHASE_BLOCKED: FOS_CAREER_REPO not set"; exit 2; }
test -d "$FOS_CAREER_REPO" || { echo "PHASE_BLOCKED: fos-career repository missing"; exit 2; }
```

`<fos-career-repo>`는 실행자가 로컬 환경이나 기존 배포 notes에서 확인한다.
task 파일과 보고서에는 사용자 로컬 절대 경로를 쓰지 않는다.
phase 끝에서는 의도한 변경만 명시 stage하고 commit/push한다.
넓은 `git add .`는 쓰지 않는다.
관련 없는 dirty state를 다음 phase로 넘기지 않는다.
plan-and-build runner는 workspace env가 설정되어 있으면 notify_discord로 phase 진행 알림을 보낸다.
특별한 사용자 요약이 필요한 경우가 아니면 수동 알림을 중복하지 않는다.

---

## 관련 docs

실행 전 반드시 읽는다.

- `docs/data-schema.md`
- `docs/code-architecture.md`
- `tasks/plan039-fos-career-dashboard/phase-02.md`
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-03.md`
- `<fos-career-repo>/AGENTS.md`

---

## 작업 항목

### 1. positions 화면 데이터 연결 확인

fos-career positions 화면이 DB 또는 가져오기 결과를 읽도록 연결한다.
이미 연결되어 있으면 기존 구현을 유지한다.

확인 대상:

- positions route
- positions query
- DB schema
- type 정의
- error/loading/empty 상태

### 2. 전체 필드 표시

초기 표시에서는 숨김 정책을 정하지 않는다.
다음처럼 가능한 모든 필드를 화면에서 확인할 수 있게 한다.

- source
- external id
- link
- title 또는 role
- company
- location
- tags 또는 stack
- posting status
- link type
- collected at
- updated at
- raw fields
- source failure summary가 있으면 run summary 영역

raw fields는 표가 너무 넓어지면 펼침 영역이나 상세 영역으로 두어도 된다.
단, 사용자가 화면에서 접근할 수 있어야 한다.

### 3. dashboard 실행

```bash
cd "$FOS_CAREER_REPO"
npm run build
npm run start
```

이미 다른 포트가 쓰이면 충돌하지 않는 포트를 사용한다.
실행 포트는 결과 보고에 남긴다.

### 4. 화면 검증

브라우저 또는 HTTP 확인으로 `/dashboard/positions`에 접근한다.
로그인이 필요하면 기존 관리자 로그인 절차를 따른다.

확인할 것:

- 수집된 공고가 한 개 이상 보인다.
- source별 성공 공고가 보인다.
- 실패 source 요약이 보이거나 별도 보고에서 확인 가능하다.
- 전체 필드가 화면에서 확인 가능하다.
- 빈 화면, 에러 화면, 샘플 데이터만 보이는 상태가 아니다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
cd "$FOS_CAREER_REPO"
npm run build
git status --short
```

가능하면 화면 확인 증거를 함께 남긴다.

- 브라우저 스크린샷
- HTTP 응답 일부
- 화면에 보이는 position row count
- 화면에 보이는 대표 공고 1-3개

성공 기준:

- `/dashboard/positions` 화면에서 실제 수집 공고가 보인다.
- DB에만 있고 화면에 없는 상태가 아니다.
- 모든 사용 가능 필드가 화면에서 접근 가능하다.
- 새 source는 추가하지 않았다.
- phase 끝에서 fos-career의 의도한 변경만 commit/push하고 commit hash를 runner 기록에 남겼다.
- 관련 없는 dirty state를 다음 phase로 넘기지 않았다.

---

## Blocked / Failed 조건

- `FOS_CAREER_REPO`를 확인할 수 없으면 `PHASE_BLOCKED: FOS_CAREER_REPO not set`를 출력하고 exit 2.
- `<fos-career-repo>`가 없으면 `PHASE_BLOCKED: fos-career repository missing`를 출력하고 exit 2.
- 관리자 로그인 또는 세션 문제로 화면 접근이 불가능하면 `PHASE_BLOCKED: dashboard access unavailable`를 출력하고 exit 2.
- DB에는 row가 있는데 화면에 보이지 않으면 `PHASE_FAILED: positions not visible on dashboard`를 출력하고 exit 1.
- 화면이 샘플 데이터만 보여주면 `PHASE_FAILED: dashboard shows sample data instead of collected positions`를 출력하고 exit 1.
- 전체 필드를 확인할 수 없으면 `PHASE_FAILED: dashboard does not expose all available fields`를 출력하고 exit 1.
- unrelated dirty files 때문에 커밋 범위를 분리할 수 없으면 `PHASE_BLOCKED: commit scope unclear due to unrelated dirty files`를 출력하고 exit 2.
