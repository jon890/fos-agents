# Phase 05 — 최종 검증과 source 실패 요약 보고

**Model**: haiku
**Status**: pending

---

## 목표

collector 실행부터 dashboard 화면 표시까지 이어진 결과를 최종 검증한다.
실패한 source와 성공한 source를 함께 요약한다.

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
읽기 전용 검증 phase이므로 변경을 남기지 않는다.
plan-and-build runner는 workspace env가 설정되어 있으면 notify_discord로 phase 진행 알림을 보낸다.
특별한 사용자 요약이 필요한 경우가 아니면 수동 알림을 중복하지 않는다.

---

## 관련 docs

실행 전 반드시 읽는다.

- `tasks/plan046-fos-career-position-collection-dashboard-verification/index.json`
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-01.md`
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-02.md`
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-03.md`
- `tasks/plan046-fos-career-position-collection-dashboard-verification/phase-04.md`
- `../skills/plan-and-build/references/common-pitfalls.md`

---

## 작업 항목

### 1. end-to-end 증거 확인

다음을 확인한다.

- phase 02 수집 output
- phase 02 source 실패 기록
- phase 03 가져오기 도구 실행 결과
- phase 04 dashboard 화면 표시 증거

### 2. source별 결과 요약

source별로 다음을 정리한다.

- 실행 여부
- 성공 공고 수
- 실패 여부
- 실패 원인
- dashboard에 보이는 대표 공고

실패한 source가 있어도 성공한 source가 dashboard에 보이면 plan 목표는 부분 성공으로 볼 수 있다.
다만 실패 source는 반드시 남은 작업으로 기록한다.

### 3. 필드 표시 요약

dashboard에서 확인 가능한 필드를 정리한다.

숨길 필드는 이 phase에서 결정하지 않는다.
추후 사용자와 논의할 후보만 남긴다.

### 4. 변경 범위와 커밋 가능성 점검

career-os와 fos-career를 각각 확인한다.

```bash
git status --short
cd "$FOS_CAREER_REPO"
git status --short
```

unrelated 변경이 있으면 커밋하지 않는다.
이 phase 자체는 읽기 전용이므로 commit 대상이 없고 clean/no-change로 보고한다.
이전 쓰기 phase의 commit hash가 runner 기록에 남았는지 확인한다.

---

## 검증

보고 직전 반드시 실행한다.

```bash
# career-os
git status --short
test -s data/runtime/plan046/live-position-postings-all.md
grep -q "link_type: direct_posting" data/runtime/plan046/live-position-postings-all.md

# fos-career
cd "$FOS_CAREER_REPO"
npm run build
git status --short
```

성공 기준:

- 실제 수집 공고가 dashboard 화면에 보인다는 증거가 있다.
- source 실패 요약이 있다.
- 전체 필드 표시 여부가 정리되어 있다.
- open decision이 분리되어 있다.
- 읽기 전용 phase로 변경을 남기지 않았다.
- 이전 쓰기 phase의 commit/push hash 또는 보류 사유가 확인된다.

---

## Blocked / Failed 조건

- `FOS_CAREER_REPO`를 확인할 수 없으면 `PHASE_BLOCKED: FOS_CAREER_REPO not set`를 출력하고 exit 2.
- `<fos-career-repo>`가 없으면 `PHASE_BLOCKED: fos-career repository missing`를 출력하고 exit 2.
- dashboard 화면 표시 증거가 없으면 `PHASE_FAILED: dashboard visibility evidence missing`를 출력하고 exit 1.
- source 실패 여부를 확인할 수 없으면 `PHASE_BLOCKED: source failure summary unavailable`를 출력하고 exit 2.
- 성공 source 공고가 dashboard에 하나도 없으면 `PHASE_FAILED: no collected positions visible on dashboard`를 출력하고 exit 1.
- unrelated dirty files 때문에 커밋 범위를 분리할 수 없으면 `PHASE_BLOCKED: commit scope unclear due to unrelated dirty files`를 출력하고 exit 2.
