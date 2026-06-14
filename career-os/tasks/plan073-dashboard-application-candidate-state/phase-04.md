# Phase 04 — reports route와 DB 상태 카드

**Model**: sonnet
**Status**: completed

---

## 목표

fos-career dashboard에 `/dashboard/reports`, `/dashboard/reports/position/latest`, `/dashboard/reports/position/[date]` route를 만들고, 읽기용 HTML preview와 DB 정본 상태 카드를 함께 보여준다.

**범위 외**: card click action mutation, worker, legacy cleanup, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `/home/bifos/services/fos-career/AGENTS.md`
- `/home/bifos/services/fos-career/app/dashboard/page.tsx`
- `/home/bifos/services/fos-career/app/dashboard/layout.tsx`
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`
- `career-os/docs/code-architecture.md`의 fos-career route 구조
- `career-os/docs/flow.md`의 Application Candidate State

Next route 또는 server component API가 헷갈리면 `/home/bifos/services/fos-career/node_modules/next/dist/docs/`의 관련 문서를 읽는다.

---

## 작업 항목

### 1. report 목록 route

`/dashboard/reports`에서 position recommendation run 목록을 DB 기준으로 보여준다.
상태별 후보 수, report date, ingest 상태, HTML preview link를 표시한다.

### 2. latest redirect 또는 page

`/dashboard/reports/position/latest`를 최신 `position_recommendation_runs` 기준으로 구현한다.
최신 run이 없으면 빈 상태를 보여주고 legacy runtime markdown을 action source로 쓰지 않는다.

### 3. 날짜별 report page

`/dashboard/reports/position/[date]`에서 해당 날짜 HTML report를 읽기용 preview로 보여주고, 같은 화면에 DB의 지원 후보 카드 목록을 state/stage와 결합해 표시한다.

### 4. 화면 용어 정리

화면에는 `지원 후보`, `보류`, `제외`, `지원 준비 중`, `지원 시작`을 사용한다.
새 workflow label로 `frontdoor queue`를 노출하지 않는다.

### 5. phase commit

dashboard route와 필요한 DB query/helper만 stage하고 commit한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `/home/bifos/services/fos-career/app/dashboard/reports/page.tsx` | 신규 |
| `/home/bifos/services/fos-career/app/dashboard/reports/position/latest/page.tsx` | 신규 또는 redirect 구현 |
| `/home/bifos/services/fos-career/app/dashboard/reports/position/[date]/page.tsx` | 신규 |
| `/home/bifos/services/fos-career/app/dashboard/page.tsx` | dashboard link와 요약 갱신 |
| `/home/bifos/services/fos-career/lib/*` | DB query helper가 필요하면 최소 추가 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd /home/bifos/services/fos-career

pnpm exec tsc --noEmit
pnpm build
rg -n "지원 후보|지원 시작" app lib
rg -n "frontdoor queue|Frontdoor Queue" app lib && exit 1 || true
git diff --check
git status --short
```

`frontdoor queue` 또는 `Frontdoor Queue`가 새 route 사용자 표시 문자열에 남으면 실패다.

---

## 성공 기준

- `/dashboard/reports`, `/dashboard/reports/position/latest`, `/dashboard/reports/position/[date]`가 존재한다.
- HTML report는 읽기용 preview로만 표시된다.
- action 가능한 상태는 DB `application_candidate_states`에서 온다.
- excluded는 기본 숨김, held는 보류 섹션, started는 다시 클릭 불가 상태로 표시된다.
- `pnpm exec tsc --noEmit`와 `pnpm build`가 통과한다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- route UX가 docs 결정 밖의 새로운 사용자 행동 결정을 요구한다.
- HTML preview를 안전하게 표시할 방법이 없어 action source와 혼동될 위험이 있다.
- Next 16 route convention 확인 없이는 구현할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- HTML preview 또는 Markdown parse 결과를 action source로 쓰는 경우.
- 새 사용자 표시 문자열에 `frontdoor queue`를 노출한 경우.
- 검증 명령을 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [x] 성공 기준은 `pnpm`, `rg`, `git diff --check`로 판정 가능하다.
- [x] dashboard 화면은 SaaS 운영 화면처럼 조용하고 밀도 있게 구성한다.
- [x] 카드 전체 클릭 action은 다음 phase 책임이다.
- [x] docs/ADR 수정은 범위 밖이다.
- [x] 첫 bash 블록에서 ai-nodes 루트로 이동한다.

---

## 완료 기록

- 완료 시각: 2026-06-14T15:57:57Z
- fos-career commit: `4d03f15 feat(fos-career): 지원 후보 리포트 route 추가`
- 변경 요약:
  - `/dashboard/reports`, `/dashboard/reports/position/latest`, `/dashboard/reports/position/[date]` route를 추가했다.
  - 날짜별 화면에서 sandboxed HTML read-only preview와 DB `application_candidate_states` 기반 지원 후보 카드를 함께 표시한다.
  - 홈 dashboard의 추천 후보 count도 legacy queue가 아니라 최신 DB report의 `recommended` count 기준으로 보정했다.
  - 사용자 화면에서 `frontdoor queue` 표현과 구현 단계 노출 문구를 제거했다.
- 검증:
  - `pnpm exec tsc --noEmit`
  - `DATABASE_URL='mysql://user:pass@127.0.0.1:3306/fos_career' SESSION_SECRET='0123456789abcdef0123456789abcdef' pnpm build`
  - `rg -n "지원 후보|지원 시작" app lib`
  - `rg -n "frontdoor queue|Frontdoor Queue" app lib && exit 1 || true`
  - `git diff --check`
- 비고:
  - env 없이 `pnpm build`는 기존 app 요구사항인 `DATABASE_URL` 누락으로 실패하므로 dummy env를 주입해 build를 확인했다.
  - 카드 mutation/action은 phase 05 책임이라 구현하지 않았다.
