# 추천 읽을거리 소스 관리

외부 읽을거리 설정은 `config/external-reading-sources.json` 한 파일에서 관리한다.
JSON을 직접 편집하기보다 관리 명령을 우선 사용한다.

## 구조

- `categories`
  - 카테고리 표시 이름과 하루 추천 수를 관리한다.
- `sources`
  - 모든 읽을거리 소스를 같은 구조로 관리한다.
- `category`
  - `techBlog`, `ai`, `geek` 중 하나다.
- `enabled`
  - `false`면 삭제하지 않고 추천에서 제외한다.
- `adapter`
  - `feed`는 RSS·Atom 항목을 수집한다.
  - `page`는 공개 페이지와 같은 호스트의 링크를 수집한다.
- `feedUrl`
  - RSS 또는 Atom 피드가 있을 때 사용한다.

숫자형 우선순위와 고정 키워드는 두지 않는다.
활성 소스 전체를 수집한 뒤 모델이 오늘의 맥락에 맞는 글을 고른다.

## 조회와 검증

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts validate
bun scripts/study-topic-recommender/manage_reading_sources.ts list
bun scripts/study-topic-recommender/manage_reading_sources.ts list --category techBlog
bun scripts/study-topic-recommender/manage_reading_sources.ts list --include-disabled
```

## 소스 추가

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts add \
  --category techBlog \
  --key example-engineering \
  --title "Example Engineering" \
  --source "Example Engineering" \
  --url "https://example.com/engineering" \
  --feed-url "https://example.com/engineering/feed.xml" \
  --adapter feed \
  --minutes 25
```

URL과 피드 URL은 HTTPS만 허용한다.
`adapter`를 생략하면 `feedUrl`, `url` 순으로 추론한다.

## 활성 상태와 추천 수

```bash
bun scripts/study-topic-recommender/manage_reading_sources.ts disable <key>
bun scripts/study-topic-recommender/manage_reading_sources.ts enable <key>
bun scripts/study-topic-recommender/manage_reading_sources.ts set-slots <카테고리> <숫자>
```

소스를 당장 추천하지 않으려면 삭제보다 `disable`을 사용한다.
하루에 보여줄 카테고리별 항목 수는 `set-slots`로 바꾼다.

## 소스 현황 리포트

현재 활성 소스와 원문 추적성 신뢰도를 확인한다.

```bash
bun scripts/study-topic-recommender/render_source_catalog.ts
```

결과는 `reports/downloads/study-reading-sources-YYYY-MM-DD.html`에 생성된다.
네트워크 확인 없이 설정만 렌더링하려면 `--offline`을 붙인다.
수정 후 `validate`를 실행한다.
