---
id: 2-2
category: workspace
triggers:
  - 새 config
  - 스키마 누락
  - data-schema
tool_catchable: false
source:
  - ai-nodes docs-first policy
related: []
---

# 2-2. 새 config 만들면서 스키마 명세 누락

## 증상

phase가 `<workspace>/config/<new>.json`을 신설하지만 `docs/data-schema.md`를 갱신하지 않는다.

## 왜

`data-schema.md`가 config 구조의 단일 출처다.
스키마 문서가 빠지면 runner와 운영 문서가 drift된다.

## Self-check

새 config 도입 시 `data-schema.md` 스키마 섹션 추가를 포함한다.
docs-first 커밋에서 이미 처리했다면 phase 본문에 그 ADR 또는 docs 경로를 연결한다.
