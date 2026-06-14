# Phase 07 — legacy frontdoor cleanup과 compatibility 정리

**Model**: sonnet
**Status**: pending

---

## 목표

DB import와 diff 검증이 끝난 뒤 legacy `frontdoor-queue.jsonl` write/read path, 새 workflow 용어, API compatibility를 정리하고 삭제 가능성을 검증한다.

**범위 외**: DB schema 추가, report route 신규 구현, worker 신규 구현, career-os docs/ADR 수정.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-081
- `career-os/docs/data-schema.md`의 legacy frontdoor queue와 user_position_action_requests
- `career-os/docs/code-architecture.md`의 migration 전 legacy 파일 목록
- `career-os/docs/flow.md`의 Application Frontdoor Queue legacy 섹션
- `career-os/scripts/application-agent/*`
- `/home/bifos/services/fos-career/app/api/priority/*`
- `/home/bifos/services/fos-career/app/api/applications/*`
- `/home/bifos/services/fos-career/lib/career-os/adapter.ts`

---

## 작업 항목

### 1. import diff 완료 확인

Phase 03 산출 diff 검증 결과를 확인한다.
누락, 중복, state mismatch가 있으면 삭제 정리 없이 `PHASE_BLOCKED`로 종료한다.

### 2. legacy write path 제거

새 daily path에서 `frontdoor-queue.jsonl`을 갱신하지 않게 한다.
DB ingest가 성공해야 recommendation freshness로 본다.

### 3. dashboard read path 전환

fos-career dashboard의 지원 후보 표시는 DB를 읽게 하고, legacy adapter read는 migration compatibility 또는 fallback으로만 남긴다.

### 4. API compatibility 정리

`recordType: frontdoor_queue`를 받던 legacy priority/application action API가 새 application candidate API와 충돌하지 않게 정리한다.
완전 삭제가 안전하지 않으면 compatibility status와 제거 조건을 코드 주석 또는 task evidence에 남긴다.

### 5. phase commit

legacy cleanup과 compatibility 정리만 stage하고 commit한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/run_daily_with_claude.ts` | legacy queue refresh 제거 또는 compatibility 분리 |
| `career-os/scripts/application-agent/*frontdoor*` | 삭제 또는 legacy-only 표시 |
| `/home/bifos/services/fos-career/lib/career-os/adapter.ts` | legacy read fallback 축소 |
| `/home/bifos/services/fos-career/app/api/*` | recordType compatibility 정리 |
| `/home/bifos/services/fos-career/app/dashboard/*` | DB read path 전환 확인 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun build --target bun --outfile /tmp/plan073-run-daily-check.js career-os/scripts/position-recommender/run_daily_with_claude.ts
rg -n "frontdoor-queue.jsonl|frontdoor_queue|Frontdoor Queue|frontdoor queue" career-os/scripts career-os/.claude /home/bifos/services/fos-career/app /home/bifos/services/fos-career/lib /home/bifos/services/fos-career/scripts || true

cd /home/bifos/services/fos-career
pnpm exec tsc --noEmit
pnpm build
git diff --check
git status --short
```

잔재 grep 결과는 허용 사유가 있는 legacy compatibility, docs, migration import path만 남아야 한다.

---

## 성공 기준

- 새 recommendation workflow가 legacy `frontdoor-queue.jsonl`을 쓰지 않는다.
- fos-career dashboard의 지원 후보 표시는 DB 정본을 읽는다.
- `frontdoor queue`는 새 사용자 화면과 새 workflow 용어로 노출되지 않는다.
- legacy API compatibility가 남는 경우 제거 조건과 제한이 명확하다.
- `frontdoor-queue.jsonl` 실제 삭제는 import diff 통과 뒤 수행된다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- Phase 03 diff 검증이 없거나 누락/중복/mismatch가 남아 있다.
- legacy reader를 제거하면 아직 필요한 dashboard 또는 processor가 깨진다.
- `recordType` compatibility 제거 여부가 새 결정 없이는 판단 불가능하다.
- 구현 중 career-os docs/ADR 수정 필요가 드러난다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- DB import 검증 없이 legacy 파일을 삭제한 경우.
- 새 화면이나 새 workflow에 `frontdoor queue` 용어를 노출한 경우.
- 검증 명령을 실행하지 못한 경우.
- unrelated dirty 파일을 stage하거나 revert한 경우.

---

## common-pitfalls self-check

- [ ] 성공 기준은 `bun build --target bun`, `pnpm`, `rg`로 판정 가능하다.
- [ ] 삭제는 import diff 통과 뒤에만 한다.
- [ ] docs/ADR 수정은 범위 밖이다.
- [ ] legacy compatibility와 새 workflow를 분리한다.
- [ ] 첫 bash 블록에서 ai-nodes 루트로 이동한다.
