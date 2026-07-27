# Coupang Careers 수집: Node fetch 403 / curl fallback

## 증상

`coupang-careers` adapter에서 sitemap은 정상 수집되지만 상세 공고 URL만 전부 `HTTP 403`으로 떨어질 수 있다.

관찰된 패턴 (2026-07-27 재측정):

- `https://www.coupang.jobs/sitemap.xml` — Node `fetch`와 `curl` 모두 200.
- `https://www.coupang.jobs/en/jobs/<id>/<slug>/` 상세 페이지 — Node 내장 `fetch`(undici)는 403.
- 같은 상세 페이지를 `curl --http2`(curl 기본값)로 호출해도 **403**이다.
- 같은 상세 페이지를 `curl --http1.1`로 호출하면 **200**이다.

403 응답 본문은 Cloudflare 챌린지 페이지(`<title>Just a moment...</title>`)다.
차단은 상세 페이지만이 아니라 루트(`/`)와 목록(`/en/jobs/`)에도 걸리고, `sitemap.xml`만 통과한다.

## 원인 판단

쿠팡 채용 사이트가 Cloudflare 뒤에 있고, HTTP/2 연결의 요청 fingerprint를 챌린지 대상으로 잡는다.
같은 UA와 헤더로도 HTTP/2면 403, HTTP/1.1이면 200이라 프로토콜 선택이 결정적 변수다.

Node 내장 `fetch`(undici)는 HTTP/1.1로 보내는데도 403인데, 이는 TLS fingerprint(JA3)가 curl과 다르기 때문으로 보인다.
따라서 헤더만 더 붙이는 방식으로는 해결되지 않고, curl 프로세스를 거치는 fallback이 필요하다.

## 권장 처리

`coupang-careers` adapter는 다음 순서로 처리한다.

1. 기본은 Node `fetch` 사용.
2. 상세 공고 페이지가 `403`이면 `curl --http1.1` fallback으로 같은 URL을 재시도한다.
   `--http1.1`을 빠뜨리면 curl도 403을 받으므로 fallback이 무력해진다.
3. UA는 봇 이름이 아니라 일반 브라우저 문자열을 쓴다.
4. fallback이 200이면 기존 HTML 파서와 active/open 검증을 그대로 태운다.
5. fallback도 실패하면 해당 공고는 snapshot 추천 티어에 넣지 않고 diagnostics에 `detail_failed`와 URL을 남긴다.

## 함께 확인할 수집 누락 요인

403이 풀려도 다음 두 가지 때문에 공고가 조용히 사라질 수 있다. 실측으로 둘 다 확인했다.

- **`back-end` 표기** — `titleFromSlug`가 `back-end-engineer`를 `Back End Engineer`로 바꾼다.
  `policy.ts`의 `SERVER_KEYWORDS`에 `back-end`와 `back end`가 없으면 쿠팡의 모든 `back-end-*` 공고가 서버 역할 판정에서 탈락한다.
- **`MAX_POSTINGS` 컷** — sitemap 순서 앞에서 자르므로 뒤쪽 공고가 통째로 빠진다.
  Coupang Pay Core 백엔드가 40 컷에 걸려 누락된 사례가 있다. 서버 역할 후보 수보다 넉넉히 잡는다.

## 검증 명령

```bash
cd career-os
node scripts/position-recommender/collect_live_postings.ts --source coupang-careers --output /tmp/coupang-live-check.md
sed -n '1,40p' /tmp/coupang-live-check.md
```

성공 기준:

- `source_diagnostics`에 `coupang-careers:ok` 또는 적어도 `imported > 0`.
- `detail_failed=0`이면 가장 좋다.
- snapshot 본문에 `- [Coupang] ...` 개별 공고가 포함된다.

## 리포트 작성 주의

Coupang 공고가 이전 runtime/report에 있어도, 새 수집에서 `coupang-careers imported=0`이면 stale 추천으로 강력/도전 티어에 재사용하지 않는다. 반대로 fallback 적용 후 `imported > 0`이면 새 snapshot 근거로 정상 추천 가능하다.
