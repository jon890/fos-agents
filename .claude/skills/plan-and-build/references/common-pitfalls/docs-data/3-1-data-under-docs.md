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
  - ADR-015 docs feedback loop data location policy
related: []
---

# 3-1. 데이터 파일을 docs 아래에 둠

## 증상

phase가 `<workspace>/docs/<some>.json` 또는 `.jsonl` 파일을 생성한다.

## 왜

`docs/`는 의사결정과 운영 문서를 담는다.
데이터는 `<workspace>/data/`에 둔다.

## Self-check

산출물이 `*.json`, `*.jsonl`, `*.csv` 같은 데이터면 `<workspace>/data/`에 둔다.
의사결정이나 인수인계 markdown이면 `<workspace>/docs/{adr,hand-off}` 또는 task phase 산출물에 둔다.
