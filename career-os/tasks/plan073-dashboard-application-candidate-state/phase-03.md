# Phase 03 — report ingest와 legacy import diff

**Model**: sonnet
**Status**: completed

---

## 목표

position recommendation 결과를 structured recommendation item으로 만들고 fos-career DB에 ingest하며, legacy `frontdoor-queue.jsonl`을 import한 뒤 diff 검증과 삭제 계획을 남긴다.

**범위 외**: dashboard route 구현, card click action, outbox worker, legacy 파일 실제 삭제, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/flow.md`의 `/position-recommender`와 Application Candidate State
- `career-os/docs/data-schema.md`의 `position_recommendation_runs`, `application_candidates`, legacy frontdoor queue
- `career-os/docs/adr.md`의 ADR-081
- `career-os/scripts/position-recommender/run_daily_with_claude.ts`
- `career-os/scripts/position-recommender/render_report_html.ts`
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`

---

## 작업 항목

### 1. structured recommendation item contract 구현

position recommendation run이 Markdown/HTML report와 함께 DB ingest 가능한 structured item을 생성하도록 career-os 쪽 최소 산출 경로를 구현한다.
필드는 candidate key 생성에 필요한 `source`, `company`, `title`, `postingUrl`, `normalizedPostingUrl`, `closeDate`, 추천 snapshot을 포함한다.

### 2. fos-career ingest command 구현

fos-career에 structured item을 읽어 `position_recommendation_runs`, `application_candidates`, `application_candidate_states`를 upsert하는 command 또는 script를 추가한다.
같은 공고는 `normalizedPostingUrl` hash를 우선하고, 없거나 불안정하면 `company + title + source + closeDate` fallback hash를 사용한다.

### 3. legacy frontdoor import 구현

`data/runtime/application-agent/frontdoor-queue.jsonl`을 DB 후보 상태로 import하는 compatibility path를 만든다.
이 path는 migration용이며 새 workflow 용어로 노출하지 않는다.

### 4. diff 검증 리포트 생성

import 전후 candidate 수, key match, 누락, 중복, state mapping을 비교하는 diff 검증 command를 만든다.
검증 산출물은 task evidence 또는 runtime 경로에 두되, docs/ADR에 쓰지 않는다.

### 5. phase commit

career-os ingest 산출 코드와 fos-career import command만 stage하고 commit한다.
legacy 파일 삭제는 이 phase에서 하지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/run_daily_with_claude.ts` | structured item 생성 연결 |
| `career-os/scripts/position-recommender/*` | item renderer 또는 helper 추가 |
| `/home/bifos/services/fos-career/scripts/*` | DB ingest/import/diff command 추가 |
| `/home/bifos/services/fos-career/package.json` | pnpm script 추가가 필요하면 최소 변경 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun build --target bun --outfile /tmp/plan073-run-daily-check.js career-os/scripts/position-recommender/run_daily_with_claude.ts
cd /home/bifos/services/fos-career
pnpm exec tsc --noEmit
pnpm build
rg -n "normalizedPostingUrl|candidateKey|position_recommendation_runs|application_candidates|frontdoor-queue" scripts lib app db
git diff --check
git status --short
```

가능하면 fixture 또는 최근 report로 smoke를 추가 실행한다.

```bash
cd /home/bifos/services/fos-career
pnpm run ingest:position-recommendations -- --dry-run
```

---

## 성공 기준

- position recommendation run이 structured recommendation item을 만들 수 있다.
- fos-career ingest가 DB upsert와 candidate state 갱신을 수행한다.
- legacy frontdoor import와 diff 검증 command가 있다.
- `frontdoor-queue.jsonl`은 삭제하지 않고 삭제 가능 여부만 검증한다.
- `pnpm exec tsc --noEmit`, `pnpm build`, 관련 `bun build --target bun` 검증이 통과한다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- recommendation item 필드가 docs 결정만으로 부족해 새 데이터 계약 결정이 필요하다.
- frontdoor queue legacy 상태를 ADR-081 state/stage로 매핑할 수 없다.
- DB 접속 없이는 dry-run도 만들 수 없고 diff 검증 기준을 확정할 수 없다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- HTML 리포트를 action source로 사용하는 구현을 만든 경우.
- diff 검증 없이 legacy import를 성공 처리한 경우.
- legacy `frontdoor-queue.jsonl`을 삭제한 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [x] 성공 기준은 `bun build --target bun`, `pnpm`, `rg`로 판정 가능하다.
- [x] 새 workflow 용어로 frontdoor queue를 쓰지 않는다.
- [x] docs/ADR 수정은 범위 밖이다.
- [x] legacy 삭제는 검증 뒤 후속 phase 책임이다.
- [x] 첫 bash 블록에서 ai-nodes 루트로 이동한다.

---

## 완료 기록

- 완료 시각: 2026-06-14T15:44:37Z
- career-os commit: `188e01f feat(career-os): 포지션 추천 structured item 산출 추가`
- fos-career commit: `a09823a feat(fos-career): 지원 후보 ingest 명령 추가`
- 변경 요약:
  - position recommendation run이 날짜별 `items.json`과 runtime mirror를 생성하도록 structured item 산출을 연결했다.
  - fos-career에 `ingest:position-recommendations`, `import:legacy-frontdoor`, `diff:application-candidates` pnpm command를 추가했다.
  - ingest upsert가 기존 `held`, `excluded`, `started`, `closed` 상태를 daily recommendation으로 덮어쓰지 않도록 보존 로직을 보강했다.
- 검증:
  - `bun build --target bun --outfile /tmp/plan073-run-daily-check.js career-os/scripts/position-recommender/run_daily_with_claude.ts`
  - `pnpm exec tsc --noEmit`
  - `DATABASE_URL='mysql://user:pass@127.0.0.1:3306/fos_career' SESSION_SECRET='0123456789abcdef0123456789abcdef' pnpm build`
  - `git diff --check`
  - fixture 기반 `ingest:position-recommendations --dry-run`, `import:legacy-frontdoor --dry-run`, `diff:application-candidates --dry-run`
- 비고:
  - env 없이 `pnpm build`는 기존 app 요구사항인 `DATABASE_URL` 누락으로 실패하므로 dummy env를 주입해 build를 확인했다.
  - legacy `frontdoor-queue.jsonl`은 이 phase에서 삭제하지 않았다.
