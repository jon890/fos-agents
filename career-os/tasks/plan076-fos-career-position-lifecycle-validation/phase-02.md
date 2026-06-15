# Phase 02 - 수동 닫힘 처리

**Model**: sonnet
**Status**: pending

---

## 목표

`/dashboard/positions`에서 사용자가 공고를 수동으로 닫을 수 있게 한다.
사유 입력은 필수다.
성공 시 `collected_positions.postingStatus`를 갱신하고 `position_status_events`에 `manual_closed` 이벤트를 남긴다.

**범위 외**: validator 자동 닫힘, 재수집 자동 재오픈, 공고 상세 페이지, career-os docs/ADR 수정, plan075 산출물 수정.

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
- `career-os/docs/prd.md`의 plan076 섹션
- `career-os/docs/flow.md`의 수동 닫기 흐름
- `career-os/docs/data-schema.md`의 `position_status_events`
- `career-os/docs/code-architecture.md`의 plan076 lifecycle 구조
- `career-os/tasks/plan076-fos-career-position-lifecycle-validation/phase-01.md`
- `~/services/fos-career/AGENTS.md`

---

## 작업 항목

### 1. 기존 positions route와 auth 경계 확인

`/dashboard/positions`의 loader/action/API 구조와 관리자 세션 검증 방식을 확인한다.
권한 없는 요청은 상태를 바꾸면 안 된다.

### 2. 수동 닫힘 액션 추가

목록 행 액션 또는 modal을 추가한다.
사용자-facing label은 한국어를 우선한다.

예시 표현:

- 닫힘 처리
- 닫힘 사유
- 상태
- 검증

### 3. 사유 필수 검증

빈 사유, 공백 사유, 너무 짧은 사유를 거절한다.
거절 응답도 한국어 메시지를 우선한다.

### 4. transaction 처리

성공 시 같은 transaction 안에서 처리한다.

- `collected_positions.postingStatus`를 `closed`로 갱신
- `position_status_events`에 `manual_closed` 기록
- `previousStatus`, `nextStatus`, `reason`, `actorAdminUserId`, `sourceId`, `collectionRunId` 저장

### 5. audit와 중복 처리

이미 닫힌 공고를 다시 닫으려는 요청은 idempotent하게 처리하거나 명확히 거절한다.
선택한 동작은 phase 보고에 남긴다.

---

## Critical Files

| 저장소 | 파일 | 변경 |
|---|---|---|
| fos-career | `app/dashboard/positions*` 또는 해당 route | 수동 닫힘 UI |
| fos-career | `app/api/*positions*` 또는 해당 action | 사유 필수 검증과 transaction |
| fos-career | `lib/*position*` 또는 기존 DB helper | status event write helper |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"
cd ~/services/fos-career

pnpm exec tsc --noEmit
pnpm build

rg -n "닫힘 처리|닫힘 사유|manual_closed|position_status_events|actorAdminUserId|postingStatus" app lib db scripts
rg -n "submit|upload|publish|external apply" app lib scripts && true
git diff --check
git status --short
```

---

## 성공 기준

- `/dashboard/positions`에서 공고별 수동 닫힘 action을 사용할 수 있다.
- 닫힘 사유가 필수이며 비어 있으면 상태가 바뀌지 않는다.
- 성공 시 `collected_positions.postingStatus`와 `position_status_events`가 같은 transaction으로 갱신된다.
- 권한 없는 요청은 거절된다.
- 사용자-facing 버튼, modal, 오류 문구는 한국어를 우선한다.
- 외부 지원, 업로드, 로그인, 공개 발행 동작은 추가하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- 관리자 세션 검증 경계를 찾을 수 없다.
- phase-01 schema가 적용되지 않아 event 기록을 구현할 수 없다.
- 수동 닫힘 처리 방식이 ADR-084에 없는 새 정책 결정을 요구한다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- 사유 없이 닫힘 처리가 성공하는 경우.
- row status만 바꾸고 `manual_closed` 이벤트를 남기지 않는 경우.
- 권한 없는 요청으로 상태가 바뀌는 경우.
- 공고 상세 페이지를 새로 만드는 경우.
- plan075 산출물 또는 career-os docs/ADR/AGENTS를 수정한 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [ ] 첫 bash 블록이 `cd "$(git rev-parse --show-toplevel)"`로 시작한다.
- [ ] 사유 필수 검증을 서버 쪽에서 수행한다.
- [ ] row update와 event write가 같은 transaction이다.
- [ ] 사용자-facing 표현은 한국어 우선이다.
- [ ] 공고 상세 페이지를 만들지 않는다.
