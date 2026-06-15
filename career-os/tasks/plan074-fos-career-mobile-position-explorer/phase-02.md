# Phase 02 — 전체 공고 탐색 화면 개선

**Model**: sonnet
**Status**: pending

## 목표

`/dashboard/positions`를 `collected_positions` 전체 풀 탐색 화면으로 개선한다.
검색, source/status/urgency 필터, 정렬, source diagnostics 접힘 영역, 모바일 카드 UX를 제공한다.

**범위 외**: 모바일 shell 전면 재작업, 추천 후보 추출 로직 변경, DB schema 변경, 외부 채용 사이트 자동화, career-os docs/ADR 수정.

---

## 사전 cwd 설정

본 phase의 주 변경 저장소는 fos-career다.
첫 bash에서 fos-career로 이동한다.

```bash
cd ~/services/fos-career
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/prd.md`의 plan074 섹션
- `career-os/docs/flow.md`의 fos-career mobile dashboard and position exploration 섹션
- `career-os/docs/data-schema.md`의 `collected_positions`, recommendation item 관련 섹션
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. positions 데이터 경계 확인

`app/dashboard/positions/page.tsx`, `lib/career-os/adapter.ts`, `lib/career-os/source-diagnostics.ts`, DB schema를 읽는다.
전체 공고 풀과 추천 후보 DB item을 어떤 key로 연결할 수 있는지 확인한다.

### 2. 검색, 필터, 정렬 UI 구현

`/dashboard/positions`에 검색어, source, posting status, close urgency, 정렬 control을 추가한다.
서버 컴포넌트 또는 client 컴포넌트 선택은 기존 Next App Router 패턴에 맞춘다.

### 3. 모바일 카드 UX 정리

모바일 카드에는 제목, 회사, source, 마감, 상태, 핵심 skill/tag를 먼저 보여준다.
긴 원문, description, source diagnostics는 기본 접힘으로 둔다.

### 4. 추천 후보 badge 또는 link 추가

추천 후보로 승격된 공고를 전체 공고 목록에서도 badge 또는 후보 리포트 link로 드러낸다.
연결 key가 불충분하면 best-effort 표시를 구현하고 누락 조건을 phase 보고에 남긴다.

### 5. phase commit

의도한 fos-career positions 화면 변경만 stage하고 commit한다.
career-os task 파일이나 docs는 이 phase commit 범위에 포함하지 않는다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `app/dashboard/positions/page.tsx` | 전체 공고 탐색 UI, 검색/필터/정렬, 모바일 카드 |
| fos-career | `lib/career-os/adapter.ts` | positions projection 보강이 필요할 때만 최소 수정 |
| fos-career | `lib/career-os/source-diagnostics.ts` | source diagnostics 접힘 표시용 데이터 정리 |
| fos-career | `lib/reports/position-reports.ts` | 추천 후보 link 계산이 기존 helper에 맞을 때만 최소 수정 |
| fos-career | `app/globals.css` | positions 화면 responsive 스타일 |

읽기 전용 확인 파일:

- `career-os/docs/prd.md`
- `career-os/docs/flow.md`
- `career-os/docs/data-schema.md`
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

grep -R "source" -n app/dashboard/positions lib/career-os | head -20
grep -R "urgency\\|status\\|diagnostic\\|추천" -n app/dashboard/positions lib | head -30

git diff --cached --name-only
git status --short
```

가능하면 `/dashboard/positions`를 desktop/mobile viewport에서 확인한다.
검색/필터/정렬 조작, diagnostics 접힘, card overflow 여부를 phase 보고에 요약한다.

---

## 성공 기준

- `/dashboard/positions`가 전체 수집 공고 풀 탐색 화면으로 동작한다.
- 검색, source/status/urgency 필터, 정렬 control이 제공된다.
- source diagnostics와 긴 원문 필드는 모바일에서 기본 접힘이다.
- 추천 후보로 승격된 공고는 badge 또는 후보 리포트 link로 구분된다.
- `pnpm exec tsc --noEmit`, `pnpm build`가 통과한다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 전체 공고와 추천 후보를 연결하려면 새 DB schema 또는 새 canonical key 결정이 필요하다.
- positions 화면이 collector snapshot과 DB 중 어느 source를 정본으로 볼지 문서 결정이 더 필요하다.
- fos-career에 unrelated dirty 변경이 있어 positions 변경을 안전하게 분리할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 검색/필터/정렬 중 하나 이상 없이 완료 보고하려는 경우.
- source diagnostics가 모바일에서 항상 펼쳐져 긴 화면을 만드는 경우.
- `pnpm exec tsc --noEmit` 또는 `pnpm build`를 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] phase 첫 bash가 `~/services/fos-career`로 이동한다.
- [ ] 전체 공고와 추천 후보의 책임 차이를 phase 본문이 다시 섞지 않는다.
- [ ] 성공 기준은 build, grep, git status exit code로 판정 가능하다.
- [ ] career-os docs/ADR 수정은 범위 밖이다.
- [ ] mobile card에 긴 원문을 기본 펼침으로 두지 않는다.
