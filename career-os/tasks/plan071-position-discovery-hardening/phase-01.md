# Phase 01 — 수집기 감사와 기준선 기록

**Model**: sonnet
**Status**: pending

---

## 목표

현재 `position-recommender` live posting adapter의 discovery 경로와 개별 공고 URL seed를 감사한다.
구현 코드 수정 전에 source별 기준선 수집량과 diagnostics를 남긴다.

**범위 외**: adapter 구현 수정, docs/ADR/정책 문서 수정, daily 기본값 변경, commit/push.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-074와 ADR-079
- `career-os/docs/flow.md`의 position source coverage 섹션
- `career-os/docs/code-architecture.md`의 `position-recommender` live postings 구조
- `career-os/docs/data-schema.md`의 position source diagnostics 관련 필드
- `career-os/scripts/position-recommender/live-postings/adapters/README.md`
- `career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md`

---

## 작업 항목

### 1. adapter inventory 작성

`career-os/scripts/position-recommender/live-postings/adapters/` 아래 adapter 파일을 열어 source key, discovery mode, URL 상수, keyword 목록, source diagnostics 출력을 확인한다.
Toss, Wanted, 카카오계열, NAVER계열, Coupang을 우선 감사한다.

### 2. 개별 공고 URL seed 탐지

adapter 파일에서 detail posting URL로 보이는 하드코딩 값을 찾는다.
root 채용 사이트, listing endpoint, API endpoint, sitemap URL은 제거 대상이 아니다.
개별 공고 URL인지 애매하면 `PHASE_BLOCKED`가 아니라 감사 산출물의 "확인 필요"로 남긴다.

### 3. 기준선 수집량 측정

기존 collector가 제공하는 source별 실행 옵션을 확인한다.
가능하면 source별 실행과 `--source all` 실행을 모두 수행한다.
실제 runtime 파일을 오염시키는 명령이면 temp output 또는 dry-run 옵션만 사용한다.

### 4. 감사 산출물 작성

`career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md`를 채운다.
수치 옆에는 사용한 명령 또는 stdout raw 값을 남긴다.
실패한 source는 실패 모드와 stderr 요약을 기록한다.

### 5. 변경 범위 확인

본 phase가 수정할 수 있는 파일은 감사 산출물뿐이다.
`scripts/`, `docs/`, `config/`, `data/runtime/` 변경이 남으면 원인을 확인하고 정리한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md` | 감사 결과 작성 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

rg -n "https?://[^\"'` ]+" career-os/scripts/position-recommender/live-postings/adapters

bun --check career-os/scripts/position-recommender/collect_live_postings.ts
find career-os/scripts/position-recommender/live-postings/adapters -name '*.ts' -print0 \
  | xargs -0 -n1 bun --check

test -s career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md
rg -n "제거 대상 개별 공고 URL seed|기준선 snapshot|PHASE_BLOCKED 후보" \
  career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md

git -C career-os diff --check -- tasks/plan071-position-discovery-hardening
git -C career-os status --short
```

collector 실행은 반드시 temp output을 사용한다.
`collect_live_postings.ts`는 `--help` / `--dry-run` 전용 모드가 아니므로 사용하지 않는다.
temp output 실행도 외부 호출이 과도하거나 runtime 오염 위험이 있으면 실행하지 말고 감사 산출물에 이유를 남긴다.

```bash
cd "$(git rev-parse --show-toplevel)"

tmp="$(mktemp)"
bun career-os/scripts/position-recommender/collect_live_postings.ts --source all --output "$tmp"
wc -l "$tmp"
rg -n "source_counts|source_diagnostics|source_errors|source:" "$tmp" || true
rm -f "$tmp"
```

---

## 성공 기준

- adapter별 discovery entrypoint와 개별 공고 URL seed 현황이 산출물에 기록된다.
- source별 또는 전체 기준선 수집량이 실측 명령과 함께 기록된다.
- 구현 코드, docs, policy 문서는 수정하지 않는다.
- phase 02에서 제거할 대상과 유지할 root/listing/API/sitemap entrypoint가 구분된다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- collector 실행이 runtime 파일을 오염시키는지 확인할 수 없다.
- ADR-079와 충돌하는 정책 판단이 필요하다.
- 감사 산출물만 수정하는 범위를 지키면서 기준선을 남길 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 감사 산출물이 비어 있거나 실측 명령 없이 수치가 들어간다.
- `scripts/`, `docs/`, `config/`, `data/runtime/` 변경이 남는다.
- `bun --check` 또는 `git diff --check`가 실패한다.

---

## common-pitfalls self-check

- [ ] 수집량과 URL 개수는 `rg`, `wc`, collector stdout 같은 실측 근거를 함께 남겼다.
- [ ] 성공 기준은 `test`, `rg`, `bun --check`, `git diff --check`로 검증 가능하다.
- [ ] 이 phase는 이전 phase 없이 실행 가능하다.
- [ ] 다른 워크스페이스 경로를 수정하지 않는다.
- [ ] docs/ADR/정책 문서를 수정하지 않는다.
- [ ] 첫 bash 블록에서 ai-nodes 루트로 이동한다.
- [ ] PHASE_BLOCKED와 PHASE_FAILED는 Bash 도구로 직접 실행한다.
