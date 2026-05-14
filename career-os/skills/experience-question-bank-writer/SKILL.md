---
name: experience-question-bank-writer
description: Generate and publish experience-based interview question bank markdown documents into the local fos-study repository using the candidate's actual resume and selected task history. Use when the output should focus on likely interview questions, follow-up questions, answer points, one-minute answer structure, and pressure-question defense rather than a general technical article.
---

# Experience Question Bank Writer

이력서 + 태스크 기반 면접 Q&A 뱅크 문서를 생성하여 `fos-study`에 직접 게시한다.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh question-bank <topic>
```

`<topic>`은 `config/topics.json`의 question-bank namespace 키 (예: `experience-qbank-ai-service-team`).

자동 실행 (기본 topic 사용):

```bash
career-os/scripts/command-router/run_now.sh auto-question-bank
```

실행 파일: `career-os/scripts/experience-question-bank-writer/`(ADR-019).

## 입력

- `config/topics.json` (question-bank namespace) — 토픽 메타데이터
- `references/question-bank-prompt.md` — 공통 프롬프트 템플릿
- `references/question-bank-schema.json` — Claude CLI `--json-schema` 강제 스키마
- 이력서 1개 + 태스크 문서 2-4개 + 선택적 JD 컨텍스트 1개

## 산출물

- `sources/fos-study/...` — `[초안]` 접두어로 게시 + git commit + push
- `data/reports/` — 실행 로그·중간 산출물
- `data/generated-artifacts.json` — kind=`question-bank` upsert (push 성공 시)

문서 구조: 메인 질문 5개 × 팔로업 5개 (스키마 강제). push 실패 시 명시적으로 오류 출력.

커밋 메시지 예: `docs(interview): add draft ai-service-team question bank`.

## 관련 ADR

ADR-005: 산출물 경로 컨벤션.
ADR-019: scripts/<skill>/ 분리 컨벤션.
