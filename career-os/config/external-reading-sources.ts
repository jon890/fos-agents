import type { ReadingSourcesConfig } from "../scripts/study-topic-recommender/reading_contracts.js";

export const externalReadingSources = {
  "_meta": {
    "purpose": "study-topic-recommender 외부 읽을거리 소스의 단일 출처",
    "schemaVersion": 3
  },
  "categories": {
    "techBlog": {
      "slots": 3
    },
    "geek": {
      "slots": 1
    }
  },
  "sources": [
    {
      "key": "woowahan-tech",
      "title": "우아한형제들 tech",
      "url": "https://techblog.woowahan.com/",
      "category": "techBlog",
      "enabled": true,
      "adapter": "page"
    },
    {
      "key": "toss-tech",
      "title": "토스 tech",
      "url": "https://toss.tech/tech",
      "feedUrl": "https://toss.tech/rss.xml",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "kakao-tech",
      "title": "카카오 tech",
      "url": "https://tech.kakao.com/blog/",
      "feedUrl": "https://tech.kakao.com/feed/",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "naver-d2",
      "title": "네이버 D2",
      "url": "https://d2.naver.com/home",
      "feedUrl": "https://d2.naver.com/d2.atom",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "line-engineering",
      "title": "LINE engineering",
      "url": "https://engineering.linecorp.com/ko",
      "feedUrl": "https://engineering.linecorp.com/ko/feed/",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "daangn-tech",
      "title": "당근 tech",
      "url": "https://medium.com/daangn",
      "feedUrl": "https://medium.com/feed/daangn",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "coupang-engineering",
      "title": "쿠팡 engineering",
      "url": "https://medium.com/coupang-engineering",
      "feedUrl": "https://medium.com/feed/coupang-engineering",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "shopify-engineering",
      "title": "Shopify engineering",
      "url": "https://shopify.engineering/",
      "category": "techBlog",
      "enabled": true,
      "adapter": "page"
    },
    {
      "key": "stripe-engineering",
      "title": "Stripe engineering",
      "url": "https://stripe.com/blog/engineering",
      "category": "techBlog",
      "enabled": true,
      "adapter": "page"
    },
    {
      "key": "netflix-techblog",
      "title": "Netflix tech",
      "url": "https://netflixtechblog.com/",
      "feedUrl": "https://medium.com/feed/netflix-techblog",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "aws-architecture-blog",
      "title": "AWS architecture",
      "url": "https://aws.amazon.com/blogs/architecture/",
      "feedUrl": "https://aws.amazon.com/blogs/architecture/feed/",
      "category": "techBlog",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "geeknews",
      "title": "GeekNews",
      "url": "https://news.hada.io/",
      "feedUrl": "https://news.hada.io/rss/news",
      "category": "geek",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "hacker-news",
      "title": "Hacker News",
      "url": "https://news.ycombinator.com/",
      "feedUrl": "https://news.ycombinator.com/rss",
      "category": "geek",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "postgresql-news",
      "title": "Postgres release notes",
      "url": "https://www.postgresql.org/docs/release/",
      "feedUrl": "https://www.postgresql.org/news.rss",
      "category": "geek",
      "enabled": true,
      "adapter": "feed"
    },
    {
      "key": "duckdb-blog",
      "title": "DuckDB blog",
      "url": "https://duckdb.org/news/",
      "category": "geek",
      "enabled": true,
      "adapter": "page"
    },
    {
      "key": "bytecode-alliance",
      "title": "Bytecode Alliance",
      "url": "https://bytecodealliance.org/",
      "category": "geek",
      "enabled": true,
      "adapter": "page"
    },
    {
      "key": "tokio-blog",
      "title": "Tokio blog",
      "url": "https://tokio.rs/blog",
      "category": "geek",
      "enabled": true,
      "adapter": "page"
    },
    {
      "key": "openjdk-loom",
      "title": "OpenJDK Loom",
      "url": "https://openjdk.org/projects/loom/",
      "category": "geek",
      "enabled": true,
      "adapter": "page"
    }
  ]
} satisfies ReadingSourcesConfig;
