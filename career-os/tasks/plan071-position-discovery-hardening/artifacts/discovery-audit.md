# plan071 discovery audit

Phase 01 실행자가 채우는 감사 산출물이다.
실측 없이 수치를 쓰지 않는다.

## 감사 일시

- 실행 일시 UTC: 2026-06-13T16:06:23Z
- 실행 commit: 34059e8b99d90832b10a7a50ff580d448849ab6e
- 실행 명령: `bun career-os/scripts/position-recommender/collect_live_postings.ts --source all` (runtime 파일 자동 기록됨 — bun --check 시 의도치 않게 실행, data/runtime/ 내용 변경 없음 확인: `git status --short` 기준 index.json만 modified)

## adapter별 현황

| source | adapter 파일 | discovery entrypoint | 개별 공고 URL seed | 현재 수집량 | AI 관련 공고 수 | source diagnostics | 조치 |
|---|---|---|---|---:|---:|---|---|
| toss | `adapters/toss.ts` | `TOSS_JOB_GROUPS_API` (공식 API) + `TOSS_POSTS_API` (기사 CTA 발견) + `TOSS_FEED_URLS` [2개, listing/feed] | 없음 | 85 | 다수 (AI/Agent/Platform 태그) | toss-careers:partial collected=86 skipped=343 failed=12 — http=12 실패 (일부 job-detail URL 404/차단 추정) | 유지. 개별 공고 URL seed 없음 |
| wanted | `adapters/wanted.ts` | broad scan (navigation API) + `WANTED_TARGET_KEYWORDS` [22개 키워드] | `WANTED_TARGET_URLS` [4개] — wd/344103, wd/360452, wd/356931, wd/364006 | 24 | 다수 (target-keyword/broad) | wanted:ok collected=25 imported=24 skipped=15 failed=0 | **WANTED_TARGET_URLS 4개 제거 대상 (ADR-079)** |
| kakaopay | `adapters/kakaopay.ts` | `LISTING_URL` = `https://kakaopay.career.greetinghr.com/ko/main` | `KNOWN_TARGET_URLS` [3개] — /ko/o/192129, /ko/o/202310, /ko/o/144295 | 2 | 2 (상세 확인 필요) | kakaopay:partial collected=2 skipped=16 **failed=1** — `/o/144295: HTTP 404` (stale 확인) | **KNOWN_TARGET_URLS 3개 제거 대상 (ADR-079). /o/144295는 이미 404 stale 확인** |
| kakaopay-securities | `adapters/kakaopay-securities.ts` | `LISTING_URLS` [2개, / 와 /job_posting] | `KNOWN_TARGET_URLS` [2개] — /job_posting/Rtv75CLr, /job_posting/iWWBkQ7Z | 2 | 2 (AI Agent/Platform JD 포함) | kakaopay-securities:ok collected=2 skipped=3 failed=0 | **KNOWN_TARGET_URLS 2개 제거 대상 (ADR-079)** |
| kakaomobility | `adapters/kakaomobility.ts` | `LISTING_URL` = `https://kakaomobility.career.greetinghr.com/ko/guide` | 없음 | 5 | 포함 가능 | kakaomobility:ok collected=5 skipped=18 failed=0 | 유지. 개별 공고 URL seed 없음 |
| naver-careers | `adapters/naver-careers.ts` | `LISTING_URL` = `https://recruit.navercorp.com/rcrt/list.do` | 없음 | 0 | 0 | naver-careers:ok collected=0 skipped=10 failed=0 — listing fetch 성공, 10건 모두 isServerRole/isNonServerTitle 필터 탈락 | 유지. 개별 공고 URL seed 없음. 0건은 현재 공개 공고 중 서버 역할 필터 통과 없음. |
| coupang-careers | `adapters/coupang-careers.ts` | `SITEMAP_URL` = `https://www.coupang.jobs/sitemap.xml` (공식 sitemap root) | 없음 | 8 | 포함 가능 | coupang-careers:ok collected=8 skipped=4267 failed=0 | 유지. sitemap root는 entrypoint — 개별 공고 URL seed 아님 |

## 하드코딩 URL 후보

`rg` 실측 결과 (`rg -n "https?://[^\"'\`\s]+" career-os/scripts/position-recommender/live-postings/adapters --with-filename`):

```text
kakaomobility.ts:14:  const HOST = "https://kakaomobility.career.greetinghr.com";
kakaopay.ts:14:      const HOST = "https://kakaopay.career.greetinghr.com";
naver-careers.ts:14: const HOST = "https://recruit.navercorp.com";
kakaopay-securities.ts:14: const HOST = "https://career.kakaopaysec.com";

# 개별 공고 URL seed — 제거 대상 (ADR-079)
wanted.ts:19:  "https://www.wanted.co.kr/wd/344103",
wanted.ts:20:  "https://www.wanted.co.kr/wd/360452",
wanted.ts:21:  "https://www.wanted.co.kr/wd/356931",
wanted.ts:22:  "https://www.wanted.co.kr/wd/364006",

# Wanted API 동적 URL — 유지 (entrypoint/API)
wanted.ts:55:  fetch(`https://www.wanted.co.kr/api/v4/jobs/${pid}`, ...)
wanted.ts:73:  fetch(`https://www.wanted.co.kr/api/chaos/search/v1/position?...`, ...)
wanted.ts:152: url: `https://www.wanted.co.kr/wd/${pid}`,
wanted.ts:180: fetch(`https://www.wanted.co.kr/api/chaos/navigation/v1/results?...`, ...)

# Toss — 유지 (listing/API/feed entrypoint)
toss.ts:17:  const TOSS_HOST = "https://toss.im";
toss.ts:19:  "https://api-public.toss.im/api-public/v3/ipd-thor/api/v1/workspaces/13/posts";
toss.ts:20:  const TOSS_JOB_GROUPS_API = "https://api-public.toss.im/api/v3/ipd-eggnog/career/job-groups";
toss.ts:22:  "https://toss.im/career/jobs",
toss.ts:23:  "https://toss.im/career",

# Coupang — 유지 (sitemap root entrypoint, ADR-074)
coupang-careers.ts:15: const SITEMAP_URL = "https://www.coupang.jobs/sitemap.xml";
```

### 개별 공고 URL seed 요약 (제거 대상 9개)

| adapter 파일 | 상수명 | URL | 현재 상태 |
|---|---|---|---|
| `wanted.ts:19` | `WANTED_TARGET_URLS[0]` | `https://www.wanted.co.kr/wd/344103` | snapshot 미등장 — 비활성 추정 |
| `wanted.ts:20` | `WANTED_TARGET_URLS[1]` | `https://www.wanted.co.kr/wd/360452` | snapshot 미등장 — 비활성 추정 |
| `wanted.ts:21` | `WANTED_TARGET_URLS[2]` | `https://www.wanted.co.kr/wd/356931` | snapshot 등장 (target-url, ACTIVE) — 그러나 제거 대상 |
| `wanted.ts:22` | `WANTED_TARGET_URLS[3]` | `https://www.wanted.co.kr/wd/364006` | snapshot 등장 (target-url, ACTIVE) — 그러나 제거 대상 |
| `kakaopay.ts:17` | `KNOWN_TARGET_URLS[0]` | `https://kakaopay.career.greetinghr.com/ko/o/192129` | 수집량에 포함 가능 — listing 동적 발견과 중복 가능 |
| `kakaopay.ts:18` | `KNOWN_TARGET_URLS[1]` | `https://kakaopay.career.greetinghr.com/ko/o/202310` | 수집량에 포함 가능 — listing 동적 발견과 중복 가능 |
| `kakaopay.ts:19` | `KNOWN_TARGET_URLS[2]` | `https://kakaopay.career.greetinghr.com/ko/o/144295` | **HTTP 404 확인 (stale)** |
| `kakaopay-securities.ts:17` | `KNOWN_TARGET_URLS[0]` | `https://career.kakaopaysec.com/job_posting/Rtv75CLr` | 수집량에 포함 — listing 동적 발견과 중복 가능 |
| `kakaopay-securities.ts:18` | `KNOWN_TARGET_URLS[1]` | `https://career.kakaopaysec.com/job_posting/iWWBkQ7Z` | 수집량에 포함 — listing 동적 발견과 중복 가능 |

### 유지 가능한 root/listing/API/sitemap entrypoint (제거 대상 아님)

| adapter | 유형 | 상수 |
|---|---|---|
| toss | public API | `TOSS_JOB_GROUPS_API`, `TOSS_POSTS_API` |
| toss | listing/feed HTML | `TOSS_FEED_URLS` [2개] |
| wanted | dynamic keyword discovery | `WANTED_TARGET_KEYWORDS` [22개 키워드 문자열] |
| kakaopay | listing HTML | `LISTING_URL` |
| kakaopay-securities | listing HTML | `LISTING_URLS` [2개] |
| kakaomobility | listing HTML | `LISTING_URL` |
| naver-careers | listing HTML | `LISTING_URL` |
| coupang-careers | sitemap root | `SITEMAP_URL` |

## 기준선 snapshot

`bun career-os/scripts/position-recommender/collect_live_postings.ts --source all` (2026-06-13T16:06:23Z, commit 34059e8):

```text
total_collected: 126
direct_active_or_open_postings: 126
non_direct_leads: 0

source_counts:
  wanted=24
  toss-careers=85
  coupang-careers=8
  kakaopay=2
  kakaopay-securities=2
  kakaomobility=5
  naver-careers=0  (listing 성공, 10건 모두 서버 역할 필터 탈락)

source_diagnostics:
  wanted:ok         collected=25 imported=24 skipped=15 failed=0
  toss-careers:partial collected=86 imported=85 skipped=343 failed=12
  coupang-careers:ok collected=8 imported=8 skipped=4267 failed=0
  kakaopay:partial  collected=2 imported=2 skipped=16 failed=1
  kakaopay-securities:ok collected=2 imported=2 skipped=3 failed=0
  kakaomobility:ok  collected=5 imported=5 skipped=18 failed=0
  naver-careers:ok  collected=0 imported=0 skipped=10 failed=0

source_errors:
  toss-careers: job_groups_total=400, job_groups_accepted=85,
                article_candidates=101, job_detail_urls=29, accepted=86,
                rejected={not_server=162, not_server_title=77,
                          contract_intern_freelance=90, api_no_content=2, http=12}
  kakaopay: detail /o/144295: HTTP 404  ← stale KNOWN_TARGET_URLS[2] 확인
```

## phase 02 입력

- 제거 대상 개별 공고 URL seed:
  - `wanted.ts` — `WANTED_TARGET_URLS` [4개] 전체 제거. 연결 함수 `fetchWantedTargets()`와 `collect()` 내 호출도 제거.
  - `kakaopay.ts` — `KNOWN_TARGET_URLS` [3개] 전체 제거. `extractDetailUrls()` 내 `for...add(url)` 루프와 `collect()` 내 `listing.ok ? urls : [...KNOWN_TARGET_URLS]` fallback 로직도 제거.
  - `kakaopay-securities.ts` — `KNOWN_TARGET_URLS` [2개] 전체 제거. `extractDetailUrls()` 내 `for...add(url)` 루프와 `collect()` 내 `new Set<string>(KNOWN_TARGET_URLS)` 초기값도 제거.
- 유지 가능한 root/listing/API/sitemap entrypoint: 위 표 참조.
- PHASE_BLOCKED 후보: 없음. kakaopay listing 실패 시 fallback이 KNOWN_TARGET_URLS였으나, 제거 후 빈 배열이 되므로 listing 실패 = 0건 수집으로 처리하는 것이 ADR-079 취지에 부합한다.
