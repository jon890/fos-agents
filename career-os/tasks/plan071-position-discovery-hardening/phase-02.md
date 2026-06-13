# Phase 02 — 개별 공고 URL seed 제거

**Model**: sonnet
**Status**: pending

---

## 목표

Wanted, KakaoPay, KakaoPaySec 등 adapter에 남은 개별 공고 URL seed를 제거한다.
root entrypoint URL은 유지하고 listing/API/keyword/sitemap 기반 discovery로 대체한다.

**범위 외**: 새 회사 source 대량 추가, daily 기본값 확대, docs/ADR/정책 문서 수정, 개인정보 또는 지원서 원문 외부 전송.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: /home/bifos/ai-nodes
```

---

## 관련 docs와 입력

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-079
- `career-os/docs/flow.md`의 position source coverage 섹션
- `career-os/scripts/position-recommender/live-postings/adapters/README.md`
- `career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md`

---

## 작업 항목

### 1. 제거 대상 확정

phase 01 감사 산출물의 "제거 대상 개별 공고 URL seed"를 기준으로 수정 대상을 확정한다.
개별 공고 URL인지 애매한 값은 임의 제거하지 말고 `PHASE_BLOCKED`로 보고한다.

### 2. Wanted target URL seed 제거

`career-os/scripts/position-recommender/live-postings/adapters/wanted.ts`에서 개별 공고 URL seed가 있으면 제거한다.
회사명, 직무명, keyword, Wanted search/listing endpoint 기반 discovery는 유지하거나 보강한다.

### 3. 카카오계열 개별 공고 URL seed 제거

`kakaopay.ts`, `kakaopay-securities.ts`, `kakaomobility.ts` 등 카카오계열 adapter의 개별 공고 URL seed를 제거한다.
회사별 공식 listing/API/sitemap entrypoint가 확인되는 경우 그 entrypoint만 남긴다.
확인되지 않는 경우에는 keyword discovery fallback을 사용하되 daily 기본값 확대는 하지 않는다.

### 4. naming과 diagnostics 정리

기존 `KNOWN_TARGET_URLS` 같은 이름이 개별 공고 URL seed를 뜻했다면 제거한다.
root entrypoint를 담는 상수는 `DISCOVERY_ENTRYPOINTS`, `LISTING_ENDPOINTS`, `SEARCH_KEYWORDS`처럼 의미가 드러나는 이름으로 정리한다.
drop/stale diagnostics가 있으면 제거된 seed URL을 전제로 하지 않게 고친다.

### 5. 반증 검증 추가

adapter 파일에 개별 공고 URL 패턴이 남지 않았는지 grep 기반으로 확인한다.
root/listing/API/sitemap URL은 허용 목록으로 따로 설명한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` | 개별 공고 URL seed 제거 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaopay.ts` | 개별 공고 URL seed 제거 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaopay-securities.ts` | 개별 공고 URL seed 제거 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts` | 필요 시 개별 공고 URL seed 제거 |
| `career-os/scripts/position-recommender/live-postings/adapters/README.md` | 기존 정책 문서라서 수정하지 않는다. 필요하면 PHASE_BLOCKED |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun --check career-os/scripts/position-recommender/collect_live_postings.ts
find career-os/scripts/position-recommender/live-postings/adapters -name '*.ts' -print0 \
  | xargs -0 -n1 bun --check

echo "[adapter urls]"
rg -n "https?://[^\"'` ]+" career-os/scripts/position-recommender/live-postings/adapters

echo "[posting-like url candidates]"
rg -n "greetinghr\\.com/.*/o/[0-9]+|job_posting/[A-Za-z0-9]+|wanted\\.co\\.kr/wd/[0-9]+|jobs/[0-9]+|requisitionId=|gh_jid=" \
  career-os/scripts/position-recommender/live-postings/adapters || true

git -C career-os diff --check
git -C career-os status --short
```

가능하면 안전한 source별 collector smoke를 실행한다.
collector smoke는 반드시 temp output을 사용한다.
`collect_live_postings.ts`는 `--dry-run` 전용 모드가 아니므로 사용하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"

for source in wanted kakaopay kakaopay-securities; do
  tmp="$(mktemp)"
  echo "[source smoke] $source -> $tmp"
  bun career-os/scripts/position-recommender/collect_live_postings.ts --source "$source" --output "$tmp"
  wc -l "$tmp"
  rg -n "source_counts|source_diagnostics|source_errors|source:" "$tmp" || true
  rm -f "$tmp"
done
```

---

## 성공 기준

- 개별 공고 URL seed가 adapter에서 제거된다.
- root 채용 사이트, listing endpoint, API endpoint, sitemap URL만 상수로 남는다.
- 제거 후에도 adapter가 TypeScript check를 통과한다.
- source별 smoke에서 discovery 실패가 전체 runner success로 숨지 않는다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- phase 01 산출물 없이 제거 대상을 확정할 수 없다.
- 개별 공고 URL인지 root/listing/API/sitemap entrypoint인지 판단할 수 없다.
- seed 제거가 docs/ADR/정책 문서 변경을 요구한다.
- 새 외부 의존성 없이는 대체 discovery를 구성할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- hardcoded posting URL 후보가 설명 없이 남는다.
- `bun --check` 또는 `git diff --check`가 실패한다.
- docs/ADR/정책 문서를 수정했다.
- Discord 또는 외부 서비스로 개인정보나 지원서 원문을 보냈다.

---

## common-pitfalls self-check

- [ ] 제거 대상 URL은 phase 01 산출물과 grep 결과로 확인했다.
- [ ] 성공 기준은 `rg`, `bun --check`, `git diff --check`로 검증 가능하다.
- [ ] 이 phase는 phase 01 산출물 경로만 입력으로 가정한다.
- [ ] 다른 워크스페이스 경로를 수정하지 않는다.
- [ ] docs/ADR/정책 문서를 수정하지 않는다.
- [ ] 새 외부 의존성을 추가하지 않는다.
- [ ] first bash에서 ai-nodes 루트로 이동한다.
- [ ] PHASE_BLOCKED와 PHASE_FAILED는 Bash 도구로 직접 실행한다.
