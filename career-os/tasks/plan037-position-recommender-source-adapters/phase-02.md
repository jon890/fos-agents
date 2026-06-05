# Phase 02 — Toss job-detail adapter 추가

**Model**: sonnet
**Status**: pending

---

## 목표

Toss career article feed를 발견 수단으로만 사용하고, CTA의 `job-detail` 페이지에서 JD와 지원 폼이 확인된 항목만 active/open 개별 공고로 수집한다.

**범위 외**: Naver/Kakao/Coupang 등 다른 회사 career adapter 추가는 후속 plan으로 분리한다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/AGENTS.md`
- `career-os/docs/adr.md` — ADR-039, ADR-043
- `career-os/docs/data-schema.md` — `data/runtime/live-position-postings.md`
- `career-os/scripts/position-recommender/collect_live_postings.ts`

---

## 작업 항목

### 1. Toss article feed discovery

기존 public feed endpoint를 사용해 article 목록을 읽는다.

- endpoint: `https://api-public.toss.im/api-public/v3/ipd-thor/api/v1/workspaces/13/posts`
- article 자체는 posting으로 렌더링하지 않는다.
- `bottomButtonConfig.landingUrl` 등 CTA 필드에서 `https://toss.im/career/job-detail?job_id=...` 형태의 URL만 추출한다.
- CTA가 job-detail이 아니면 제외한다.

### 2. Toss job-detail page parser

job-detail HTML을 fetch하고 Next `__NEXT_DATA__` JSON을 파싱한다.

채택 조건:

- job-detail HTTP 200
- title 또는 JD content 존재
- `applyType`, application form, 지원 버튼, requisitionId 중 하나 이상으로 지원 가능 근거가 있음
- 서버/backend 역할 필터 통과
- 계약직/인턴/프리랜서 필터 통과

채택된 Toss posting 필드:

- `source: "toss-careers"`
- `linkType: "direct_posting"`
- `postingStatus: "open"`
- `activeEvidence`: job-detail page + apply form 또는 applyType 근거
- `url`: job-detail URL
- `openedAt`: 값이 있으면만 채움. 없으면 빈 문자열.
- `closesAt`, `daysUntilClose`, `closeUrgency`: 마감 필드가 없으면 `no_deadline`

### 3. Toss 쿨다운 정책과 추천 입력 분리

수집기는 Toss 공고를 snapshot에 넣을 수 있다. 다만 추천 강력/즉시 지원 제외 쿨다운 판단은 LLM prompt/skill 정책이 담당한다.

중요: 쿨다운 때문에 수집에서 삭제하지 않는다. 수집기는 active/open 여부만 책임진다.

### 4. diagnostics 강화

Toss 관련 diagnostics에 다음을 남긴다.

- article candidates count
- job-detail URLs extracted count
- active/open job-detail accepted count
- rejected reason summary

diagnostics는 토큰을 과하게 쓰지 않도록 한 줄 요약 중심으로 한다.

---

## Critical Files

- `career-os/scripts/position-recommender/collect_live_postings.ts`

---

## 검증

보고 직전 반드시 아래 Bash 블록을 실행한다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun build career-os/scripts/position-recommender/collect_live_postings.ts --target=bun --outfile=/tmp/collect_live_postings.js
bun career-os/scripts/position-recommender/collect_live_postings.ts --source toss --output /tmp/live-position-toss.md
grep -q "requested_source: toss" /tmp/live-position-toss.md
! grep -Eq "link_type: (career_article|search_page)|posting_status: unknown|opened_at: unknown" /tmp/live-position-toss.md
if grep -q "source: toss-careers" /tmp/live-position-toss.md; then
  grep -q "link_type: direct_posting" /tmp/live-position-toss.md
  grep -q "posting_status: open" /tmp/live-position-toss.md
  grep -q "active_evidence:" /tmp/live-position-toss.md
  grep -q "job-detail" /tmp/live-position-toss.md
fi
```

---

## 금지 사항

- Toss career article URL을 공고 URL로 사용하지 말 것.
- job-detail 검증 전 Toss 항목을 snapshot에 넣지 말 것.
- LLM에게 active/open 여부 추정을 맡기지 말 것.
- 값 없는 `opened_at`에 `unknown` 문자열을 넣지 말 것.
- 외부 npm 의존성 추가 금지.

---

## Blocked / Failed 조건

- Toss public endpoint 또는 job-detail HTML이 차단되어 job-detail 검증이 불가능하면 `PHASE_BLOCKED: Toss job-detail source unavailable` 출력 후 exit 2.
- Toss article만 있고 job-detail URL이 하나도 없으면 실패가 아니라 diagnostics에 남기고 정상 종료한다.
- 검증 명령 중 하나라도 실패하면 `PHASE_FAILED: Toss job-detail adapter validation failed` 출력 후 exit 1.
