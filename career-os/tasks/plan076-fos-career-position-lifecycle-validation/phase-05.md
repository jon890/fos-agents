# Phase 05 - positions UI와 진단 polish

**Model**: sonnet
**Status**: pending

---

## 목표

`/dashboard/positions`를 전체 누적 공고 pool 운영 화면으로 다듬는다.
latest/new/past/source/recommendation/status 필터와 검증 요약을 제공한다.
사용자-facing 표현은 한국어를 우선한다.

**범위 외**: 공고 상세 페이지, source adapter 구현/수정, validator cron 자동 apply, career-os docs/ADR 수정, plan075 산출물 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-084
- `career-os/docs/prd.md`의 plan076 사용자-facing 표현 원칙
- `career-os/docs/flow.md`의 표시 규칙
- `career-os/docs/data-schema.md`의 event label 표시 규칙
- `career-os/docs/code-architecture.md`의 plan076 lifecycle 구조
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-02.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-03.md`
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-04.md`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 전체 누적 pool 기본 표시 확인

`/dashboard/positions`가 latest run 전용 snapshot이 아니라 전체 누적 공고 pool을 보여주도록 확인한다.
latest run 밖 과거 공고는 필터로 숨길 수 있어도 기본 데이터 모델에서 사라지면 안 된다.

### 2. 필터 추가 또는 정리

다음 필터를 제공한다.

- 최신
- 신규
- 과거
- 수집처
- 추천 여부
- 상태

query parameter와 UI state가 reload 뒤에도 자연스럽게 유지되도록 한다.

### 3. 검증 요약 표시

최근 validator 실행 또는 상태 이벤트 요약을 화면에 표시한다.
예시 표현:

- 검증 요약
- 닫힘 처리
- 재오픈
- 검증 보류
- 수집처

### 4. 한국어 label 정리

버튼, badge, empty state, filter label, 상태 설명은 한국어를 우선한다.
내부 enum과 raw log는 필요한 경우 보조 텍스트 또는 개발자용 영역에 둔다.

### 5. 모바일/반응형 확인

plan074 이후 모바일 화면이 깨지지 않게 한다.
텍스트가 버튼이나 badge 안에서 겹치지 않도록 확인한다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `/dashboard/positions` page/components | 필터, 요약, label polish |
| fos-career | position query helper | latest/new/past/source/recommendation/status filter |
| fos-career | label mapper | event/status 한국어 label |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

rg -n "최신|신규|과거|수집처|추천|상태|검증 요약|닫힘 처리|재오픈|검증 보류" app lib
rg -n "detail page|position detail|/dashboard/positions/" app lib && true
git diff --check
git status --short
```

---

## 성공 기준

- `/dashboard/positions`가 전체 누적 공고 pool을 기본으로 표시한다.
- latest/new/past/source/recommendation/status 필터가 동작한다.
- 상태 이벤트와 validator 실행 요약이 사용자가 이해할 수 있는 한국어로 표시된다.
- 내부 enum과 raw source 값은 필요한 경우 보조 정보로만 노출된다.
- 공고 상세 페이지를 만들지 않는다.
- 모바일/좁은 화면에서 주요 label과 버튼 텍스트가 겹치지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- latest/new/past 계산에 필요한 `collected_position_run_items` 데이터를 읽을 수 없다.
- 추천 여부와 collection run 연결을 확인할 수 없다.
- UI 요구가 공고 상세 페이지 구현 없이는 충족 불가능하다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- latest run 밖 과거 공고가 화면 데이터에서 사라지는 경우.
- 필터 label이 영어 내부 enum 중심으로만 표시되는 경우.
- 공고 상세 페이지를 새로 만드는 경우.
- 검증 요약 없이 상태 변경을 숨기는 경우.
- plan075 산출물 또는 career-os docs/ADR/AGENTS를 수정한 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] 전체 누적 pool을 유지한다.
- [ ] latest/new/past는 run item 기반이다.
- [ ] 사용자-facing label은 한국어 우선이다.
- [ ] 공고 상세 페이지를 만들지 않는다.
