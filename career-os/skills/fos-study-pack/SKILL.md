---
name: fos-study-pack
description: Create or update fos-study technical study-pack markdown documents from natural-language topic requests. Use when the user asks for a study pack, says things like '/study-pack ...', wants an interview-oriented backend study document, or wants existing fos-study documents checked first to avoid duplicates before writing. This skill routes freeform topic requests into the career-os study-pack pipeline, lets Claude decide update-vs-new when overlap exists, and publishes the result to fos-study with commit/push.
---

# fos-study-pack

자연어 학습 요청을 `fos-study` 생성 파이프라인으로 연결하는 skill.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh study-pack <topic>
```

자연어 요청 예:
- `/study-pack JVM GC 튜닝 가이드`
- `Redis cache-aside 정리해줘`
- `InnoDB gap lock 기존 문서 보고 업데이트해줘`

실행 파일: `career-os/scripts/fos-study-pack/`(ADR-019). 상세 라우팅 정책은 `references/request-patterns.md`.

## 입력

- `config/topics.json` (study-pack namespace) — 토픽 메타데이터
- `sources/fos-study/` — 중복 검사 대상 기존 문서
- 자연어 topic 파라미터 (slash 형식 포함)

## 산출물

- `sources/fos-study/...` — `[초안]` 접두어로 게시 + git commit + push
- 단일 타깃 파일 (update-existing 또는 create-new)

## 관련 ADR

ADR-005: 산출물 경로 컨벤션.
ADR-011: candidate reservoir + update-vs-new 정책.
