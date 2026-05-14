---
name: study-pack-maintainer
description: Decide whether a requested backend study topic should update an existing fos-study markdown file or create a new one, then generate the final markdown body via Claude based on existing related documents. Use when the user asks for a study pack but wants overlap checked first, wants duplicate files avoided, wants existing documents reviewed before writing, or wants Claude to own both the update-vs-new-file judgment and the final content draft.
---

# Study Pack Maintainer

중복 검사 + update-vs-new 판단 + 마크다운 생성을 Claude가 직접 수행하는 study-pack 유지보수 skill.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh maintain-study-pack <topic>
```

일반 `study-pack`보다 overlap/update 전략이 중요할 때 사용한다.

실행 파일: `career-os/scripts/study-pack-maintainer/`(ADR-019).

## 입력

- `references/maintainer-prompt.md` — 공통 프롬프트 템플릿
- `config/topics.json` (study-pack-maintainer namespace) — 토픽 메타데이터
- 후보 기존 문서 (Claude가 overlap 검사) — `sources/fos-study/...`
- 요청된 토픽 설명 (자연어 또는 topic 키)

## 산출물

- `sources/fos-study/...` — `[초안]` 접두어로 게시 + git commit + push (단일 타깃)

Claude 결과에 포함: chosen action (`update-existing` / `create-new`), 출력 경로, 짧은 근거, 전체 마크다운 본문.

## 관련 ADR

ADR-005: 산출물 경로 컨벤션.
ADR-011: update-vs-new 정책.
ADR-019: scripts/<skill>/ 분리 컨벤션.
