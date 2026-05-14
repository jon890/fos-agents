---
name: cj-foodville-coffeechat-prep
description: Prepare private CJ Foodville coffee-chat strategy and backend service/site insight reports for the candidate. Use when the user asks for CJ푸드빌/Foodville 커피챗 preparation, conversation flow, company/service interest points, backend insights from VIPS/제일제면소/CJ Foodville sites, or Claude-backed review of coffee-chat positioning. Outputs private career-os reports, not public fos-study posts.
---

# CJ Foodville Coffee Chat Prep

CJ Foodville 커피챗 전략 보고서와 백엔드 서비스 인사이트를 생성하는 비공개 커리어 준비 skill.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh foodville-coffeechat
```

추가 컨텍스트 주입:

```bash
FOODVILLE_CONTEXT="extra context" career-os/scripts/command-router/run_now.sh foodville-coffeechat
```

실행 파일: `career-os/scripts/cj-foodville-coffeechat-prep/`(ADR-019).

## 입력

- `docs/prep/cj-foodville-coffeechat-strategy.md` — 기준 포지셔닝 문서
- `data/source/cj-foodville-sites/` — 수집된 사이트 스냅샷
- `FOODVILLE_CONTEXT` env — 선택적 추가 컨텍스트

## 산출물

- `docs/prep/cj-foodville-coffeechat-strategy.md` — 안정적 전략 노트 (갱신)
- `data/reports/daily/YYYY-MM-DD/cj-foodville-coffeechat/report.md` — 날짜별 사본
- `data/runtime/cj-foodville-coffeechat-prep.md` — 최신 런타임 리포트

fos-study에는 게시하지 않는다. 사용자가 명시적으로 요청할 때만 예외.

## 관련 ADR

ADR-019: scripts/<skill>/ 분리 컨벤션.
