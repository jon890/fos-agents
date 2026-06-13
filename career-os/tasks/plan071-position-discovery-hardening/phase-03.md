# Phase 03 — 대상 source discovery 확대

**Model**: sonnet
**Status**: pending

---

## 목표

Toss, Wanted, 카카오계열, NAVER계열, Coupang의 discovery coverage를 넓힌다.
새 source는 official listing/API/sitemap이 확인된 범위에서만 추가한다.
daily 기본값 활성은 shadow 또는 명시 옵션 검증 뒤로 제한한다.

**범위 외**: docs/ADR/정책 문서 수정, 새 외부 의존성 도입, 지원서 원문 외부 전송, 공식 근거 없는 scraper 추가.

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

- `career-os/docs/adr.md`의 ADR-074와 ADR-079
- `career-os/docs/flow.md`의 position source coverage 섹션
- `career-os/docs/code-architecture.md`의 live postings adapter 구조
- `career-os/docs/data-schema.md`의 posting source fields와 diagnostics
- `career-os/tasks/plan071-position-discovery-hardening/artifacts/discovery-audit.md`

---

## 작업 항목

### 1. Toss/Wanted coverage 보강

Toss adapter는 공식 listing/API가 이미 있으면 backend, platform, AI, data, infra 계열 직무 필터를 보강한다.
Wanted adapter는 broad scan과 target keyword discovery를 구분해 유지한다.
Wanted 개별 공고 URL seed는 되살리지 않는다.

### 2. 카카오계열 coverage 보강

카카오계열 source는 공식 listing/API/sitemap이 확인되는 계열사만 adapter 또는 keyword target으로 추가한다.
최소 검토 대상은 KakaoPay, KakaoPaySec, KakaoMobility이며, 추가 계열사는 공식 entrypoint가 확인될 때만 shadow source로 둔다.

### 3. NAVER계열 coverage 보강

NAVER Careers adapter의 공식 listing/API/sitemap discovery를 확인한다.
NAVER Cloud, NAVER Financial, Webtoon 등 계열사는 공식 entrypoint가 확인된 경우에만 추가한다.
확인되지 않은 계열사는 Wanted keyword discovery fallback 후보로만 남긴다.

### 4. Coupang coverage 보강

Coupang Careers 공식 listing/API/sitemap 접근 가능성을 확인한다.
fetch 차단이나 HTML 차단이 있으면 Wanted target keyword discovery fallback을 유지한다.
공식 direct source가 안정적으로 확인되기 전에는 daily 기본값에 새 direct source를 켜지 않는다.

### 5. source registry와 diagnostics 정리

`adapters/index.ts`, `policy.ts`, `types.ts`, `validator.ts`, `render.ts` 중 필요한 파일만 수정한다.
source별 count, AI 관련 count, stale/drop 사유가 snapshot에 드러나게 한다.
daily 기본값 변경이 필요하면 이 phase에서는 `PHASE_BLOCKED`로 보고한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` | discovery coverage 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/wanted.ts` | broad와 target keyword discovery 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaopay.ts` | 공식 entrypoint 기반 coverage 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaopay-securities.ts` | 공식 entrypoint 기반 coverage 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts` | 공식 entrypoint 기반 coverage 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/naver-careers.ts` | NAVER계열 discovery 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/coupang-careers.ts` | Coupang discovery 또는 fallback 보강 |
| `career-os/scripts/position-recommender/live-postings/adapters/index.ts` | 필요 시 shadow source 등록 |
| `career-os/scripts/position-recommender/live-postings/policy.ts` | AI/backend/platform keyword 보강 |
| `career-os/scripts/position-recommender/live-postings/types.ts` | 필요 시 diagnostics 타입 보강 |
| `career-os/scripts/position-recommender/live-postings/validator.ts` | stale/open guard 유지 또는 보강 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun --check career-os/scripts/position-recommender/collect_live_postings.ts
find career-os/scripts/position-recommender/live-postings -name '*.ts' -print0 \
  | xargs -0 -n1 bun --check

echo "[source registry]"
rg -n "toss|wanted|kakao|naver|coupang" \
  career-os/scripts/position-recommender/live-postings/adapters \
  career-os/scripts/position-recommender/live-postings/policy.ts

echo "[posting-like url candidates]"
rg -n "greetinghr\\.com/.*/o/[0-9]+|job_posting/[A-Za-z0-9]+|wanted\\.co\\.kr/wd/[0-9]+|jobs/[0-9]+|requisitionId=|gh_jid=" \
  career-os/scripts/position-recommender/live-postings || true

git -C career-os diff --check
git -C career-os status --short
```

가능하면 아래 smoke를 실행한다.
collector smoke는 반드시 temp output을 사용한다.
`collect_live_postings.ts`는 `--help` / `--dry-run` 전용 모드가 아니므로 사용하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"

for source in toss wanted naver-careers coupang-careers all; do
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

- 대상 source의 discovery 폭이 공식 entrypoint 또는 keyword discovery 기반으로 넓어진다.
- 개별 공고 URL seed는 되살아나지 않는다.
- 새 source는 shadow 또는 명시 옵션 검증 상태로 남고 daily 기본값에 즉시 켜지지 않는다.
- source별 diagnostics가 수집량, AI 관련 후보, stale/drop 사유를 확인할 수 있게 유지 또는 보강된다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 새 source 추가가 docs/ADR/정책 문서 변경을 요구한다.
- 공식 listing/API/sitemap 확인 없이 direct source를 추가해야 한다.
- daily 기본값 활성 여부를 사용자와 논의해야 한다.
- 새 외부 의존성 없이는 필요한 discovery를 구현할 수 없다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.
prose만 출력하면 success로 잘못 처리될 수 있다.

- 개별 공고 URL seed가 다시 추가된다.
- `bun --check` 또는 `git diff --check`가 실패한다.
- shadow로 두어야 할 source가 daily 기본값으로 켜진다.
- docs/ADR/정책 문서를 수정했다.
- Discord 또는 외부 서비스로 개인정보나 지원서 원문을 보냈다.

---

## common-pitfalls self-check

- [ ] source 수와 수집량은 실측 명령 또는 smoke stdout으로 남겼다.
- [ ] 성공 기준은 `rg`, `bun --check`, `git diff --check`로 검증 가능하다.
- [ ] 이 phase는 phase 01 산출물과 기존 docs만 입력으로 가정한다.
- [ ] 다른 워크스페이스 경로를 수정하지 않는다.
- [ ] docs/ADR/정책 문서를 수정하지 않는다.
- [ ] 새 외부 의존성을 추가하지 않는다.
- [ ] first bash에서 ai-nodes 루트로 이동한다.
- [ ] PHASE_BLOCKED와 PHASE_FAILED는 Bash 도구로 직접 실행한다.
