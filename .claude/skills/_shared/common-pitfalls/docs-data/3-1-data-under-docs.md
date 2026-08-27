---
id: 3-1
category: docs-data
triggers:
  - docs 아래 데이터
  - json
  - jsonl
  - csv
tool_catchable: true
source:
  - workspace data boundary
related: []
---

# 3-1. 데이터 파일을 docs 아래에 둠

## 증상

phase가 `<workspace>/docs/<some>.json` 또는 `.jsonl` 파일을 생성한다.

## 왜

`docs/`는 설명과 기술 결정 문서를 담는다.
데이터는 해당 워크스페이스의 `data-schema.md`가 지정한 경로에 둔다.

## Self-check

산출물이 `*.json`, `*.jsonl`, `*.csv` 같은 데이터면 `data-schema.md`의 책임 경계를 확인한다.
기술 결정은 `<workspace>/docs/adr/`, 인수인계 문서는 해당 워크스페이스가 정한 문서 경계에 둔다.
