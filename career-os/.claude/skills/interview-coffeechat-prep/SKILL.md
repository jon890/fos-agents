---
name: cj-foodville-coffeechat-prep
description: "현 active 타깃 기업(config/mvp-target.json 참조)의 커피챗 전략 보고서와 백엔드 서비스·사이트 인사이트를 비공개 생성하는 커리어 준비 skill. CJ Foodville/coffeechat 준비·대화 흐름·회사 서비스 관심 포인트·백엔드 인사이트·커피챗 포지셔닝 검토 요청 시 사용. fos-study가 아닌 비공개 career-os 리포트 생성."
---

# CJ Foodville Coffee Chat Prep

현 active 타깃 기업(`config/mvp-target.json`의 `primary` 항목)의 커피챗 전략 보고서와 백엔드 서비스 인사이트를 생성하는 비공개 커리어 준비 skill. 타깃 기업 전환 시 `mvp-target.json`만 수정하면 되며, 회사명을 SKILL.md 본문에 직접 박지 않는다.

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
