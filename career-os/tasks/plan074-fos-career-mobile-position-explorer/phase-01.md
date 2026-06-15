# Phase 01 — 모바일 dashboard shell과 네비게이션 정리

**Model**: sonnet
**Status**: pending

## 목표

fos-career dashboard shell을 모바일에서 하단 네비게이션 중심으로 사용할 수 있게 정리한다.
기존 desktop layout은 유지하면서 모바일 1급 경로를 `홈`, `공고`, `후보`, `지원`, `더보기`로 고정한다.

**범위 외**: `/dashboard/positions` 검색/필터 구현, 추천 후보 ingest 변경, DB schema 변경, career-os docs/ADR 수정.

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

- `career-os/AGENTS.md`의 Docs-first and Task Files, Background Execution, Validation and Git
- `career-os/docs/adr.md`의 ADR-082
- `career-os/docs/code-architecture.md`의 fos-career 웹 대시보드 섹션
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 현재 shell 구조와 dirty state 확인

`~/services/fos-career`에서 `git status --short`, 현재 branch, dashboard layout 파일을 확인한다.
unrelated dirty 변경이 있으면 건드리지 않고 phase 보고에 분리한다.

### 2. 모바일 하단 네비게이션 추가

`app/dashboard/layout.tsx`와 필요한 component/CSS를 기존 패턴에 맞춰 수정한다.
모바일 하단 네비게이션은 `홈`, `공고`, `후보`, `지원`, `더보기`를 안정된 크기의 tap target으로 제공한다.

### 3. 더보기 또는 햄버거 메뉴 구성

리포트, 소스 진단, 우선 행동, 면접 hub 같은 2급 경로는 더보기 또는 햄버거 메뉴에서 접근하게 한다.
desktop navigation은 기존 사용성을 깨지 않게 유지한다.

### 4. responsive spacing 정리

dashboard content가 하단 네비게이션에 가리지 않도록 padding과 safe-area 처리를 추가한다.
텍스트 겹침, 가로 overflow, nested card 구조가 생기지 않게 확인한다.

### 5. phase commit

의도한 fos-career shell 변경만 stage하고 commit한다.
career-os task 파일이나 docs는 이 phase commit 범위에 포함하지 않는다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `app/dashboard/layout.tsx` | 모바일 shell, desktop navigation 보존 |
| fos-career | `app/globals.css` | safe-area, responsive spacing, navigation 상태 |
| fos-career | `app/dashboard/page.tsx` | 홈 경로 link 표시가 shell 변경과 맞지 않으면 최소 수정 |

읽기 전용 확인 파일:

- `career-os/docs/adr.md`
- `career-os/docs/code-architecture.md`
- `career-os/tasks/plan074-fos-career-mobile-position-explorer/index.json`
- `~/services/fos-career/AGENTS.md`

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

grep -R "공고" -n app/dashboard | head
grep -R "더보기\\|후보\\|지원" -n app/dashboard app/globals.css | head -20

git diff --cached --name-only
git status --short
```

가능하면 desktop/mobile viewport에서 `/dashboard`를 직접 열어 navigation overflow와 content 가림이 없는지 확인한다.
브라우저 확인을 못 하면 그 이유를 phase 보고에 남긴다.

---

## 성공 기준

- 모바일 dashboard에서 `홈`, `공고`, `후보`, `지원`, `더보기`가 하단 네비게이션으로 보인다.
- 리포트, 소스 진단, 우선 행동, 면접 hub는 더보기 또는 햄버거 메뉴에서 접근할 수 있다.
- desktop dashboard navigation은 기존 경로 접근성을 잃지 않는다.
- `pnpm exec tsc --noEmit`, `pnpm build`가 통과한다.
- career-os docs/ADR/AGENTS는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 모바일 shell 구조가 새 routing 정책 결정 또는 docs/ADR 변경을 요구한다.
- fos-career에 unrelated dirty 변경이 있어 shell 변경을 안전하게 분리할 수 없다.
- DB schema 또는 인증 흐름 변경 없이는 navigation을 구현할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 하단 네비게이션 없이 shell 개선 완료로 보고하려는 경우.
- `pnpm exec tsc --noEmit` 또는 `pnpm build`를 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.
- career-os docs/ADR/AGENTS를 수정한 경우.

---

## common-pitfalls self-check

- [ ] phase 첫 bash가 `~/services/fos-career`로 이동한다.
- [ ] 성공 기준은 build, grep, git status exit code로 판정 가능하다.
- [ ] career-os docs/ADR 수정은 범위 밖이다.
- [ ] unrelated dirty 변경을 stage하지 않는다.
- [ ] mobile text와 button 크기는 viewport width 기반 font scaling 없이 처리한다.
