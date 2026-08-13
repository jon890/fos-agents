# 외부 읽을거리 소스 관리

읽을거리 소스는 `config/external-reading-sources.ts`에서 관리한다.
소스 키는 주제가 아니라 발행처를 식별한다.

좋은 키:

- `daangn-tech`
- `naver-d2`
- `geeknews`

피해야 할 키:

- `daangn-backend-event-driven`
- `naver-search-architecture-recent`

## 카테고리

- `techBlog`
  - 회사나 프로젝트가 직접 운영하는 기술 발행 채널이다.
- `geek`
  - 뉴스, 큐레이션, 릴리스 동향 채널이다.

AI 전용 카테고리는 두지 않는다.
AI 글도 발행처 성격에 따라 두 카테고리 중 하나에 등록한다.

## 조회와 검증

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
bun scripts/study-topic-recommender/manage_reading_sources.ts list
bun scripts/study-topic-recommender/manage_reading_sources.ts list --category techBlog
bun scripts/study-topic-recommender/manage_reading_sources.ts list --include-disabled
```

## 소스 추가

다음 명령으로 타입 검증을 통과하는 객체 초안을 만든다.

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts template \
  --category techBlog \
  --key example-engineering \
  --title "Example Engineering" \
  --url "https://example.com/engineering" \
  --feed-url "https://example.com/engineering/feed.xml" \
  --adapter feed
```

출력한 객체를 `externalReadingSources.sources`에 추가한다.
URL과 피드 URL은 HTTPS만 허용한다.

`adapter`를 생략하면 실행기가 `feedUrl`, `url` 순으로 어댑터를 고른다.
명시한 `feed` 어댑터에는 `feedUrl`이 필요하다.
명시한 `page` 어댑터에는 `url`이 필요하다.

수정 후 다음 검증을 실행한다.

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
bun test scripts/study-topic-recommender
```

## 소스 현황 리포트

```bash
bun scripts/study-topic-recommender/render_source_catalog.ts
```

결과는 `reports/downloads/study-reading-sources-YYYY-MM-DD.html`에 생성된다.
네트워크 확인 없이 설정만 렌더링하려면 `--offline`을 붙인다.
