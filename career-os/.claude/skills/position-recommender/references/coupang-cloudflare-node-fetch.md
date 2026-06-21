# Coupang Careers 수집: Node fetch 403 / curl fallback

## 증상

`coupang-careers` adapter에서 sitemap은 정상 수집되지만 상세 공고 URL만 전부 `HTTP 403`으로 떨어질 수 있다.

관찰된 패턴:

- `https://www.coupang.jobs/sitemap.xml` — Node `fetch`와 `curl` 모두 200.
- `https://www.coupang.jobs/en/jobs/<id>/<slug>/` 상세 페이지 — Node 내장 `fetch`(undici)는 403.
- 같은 상세 페이지를 같은 호스트에서 `curl -L -A '<UA>' -H 'Accept-Language: ...'`로 호출하면 200.

## 원인 판단

쿠팡 채용 사이트가 Cloudflare 뒤에 있고, 상세 공고 페이지에서 Node/undici 요청 fingerprint를 봇성 요청으로 차단하는 것으로 보인다. 단순 헤더 부족이 아니라 Node fetch와 curl의 TLS/HTTP fingerprint 차이로 재현된다.

## 권장 처리

`coupang-careers` adapter는 다음 순서로 처리한다.

1. 기본은 Node `fetch` 사용.
2. 상세 공고 페이지가 `403`이면 `curl` fallback으로 같은 URL을 재시도.
3. fallback이 200이면 기존 HTML 파서와 active/open 검증을 그대로 태운다.
4. fallback도 실패하면 해당 공고는 snapshot 추천 티어에 넣지 않고 diagnostics에 `detail_failed`와 URL을 남긴다.

## 검증 명령

```bash
cd /home/bifos/ai-nodes/career-os
node scripts/position-recommender/collect_live_postings.ts --source coupang-careers --output /tmp/coupang-live-check.md
sed -n '1,40p' /tmp/coupang-live-check.md
```

성공 기준:

- `source_diagnostics`에 `coupang-careers:ok` 또는 적어도 `imported > 0`.
- `detail_failed=0`이면 가장 좋다.
- snapshot 본문에 `- [Coupang] ...` 개별 공고가 포함된다.

## 리포트 작성 주의

Coupang 공고가 이전 runtime/report에 있어도, 새 수집에서 `coupang-careers imported=0`이면 stale 추천으로 강력/도전 티어에 재사용하지 않는다. 반대로 fallback 적용 후 `imported > 0`이면 새 snapshot 근거로 정상 추천 가능하다.
