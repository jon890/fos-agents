# Code Architecture — cooking

cooking 워크스페이스의 코드와 skill 구조.

## 1. 디렉터리

```text
cooking/
├── AGENTS.md
├── CLAUDE.md -> AGENTS.md
├── config/
├── docs/
├── scripts/
│   └── cooking-research/
├── .claude/
│   └── skills/
│       └── cooking-research/
├── tasks/
├── data/
└── logs/
```

## 2. skill 경계

`cooking-research`는 메뉴 조사와 첫 시도 가이드 작성만 책임진다.
OpenClaw wrapper는 라우팅만 담당하고, 본문 로직은 이 워크스페이스에 둔다.

## 3. 현재 구현 상태

현재는 문서 중심 MVP다.
웹 검색이나 가격 수집 자동화는 이후 `scripts/cooking-research/` 아래에 추가한다.

