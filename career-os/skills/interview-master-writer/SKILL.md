---
name: interview-master-writer
description: Generate and publish a common senior-backend interview master playbook markdown document into the local fos-study repository, combining the candidate's latest resume and selected task documents. Use when the output should be a reusable cross-team playbook (self-introduction, career narrative, technical decision style, reverse questions, final checklist) — not a team-specific question bank or a topic-specific study pack.
---

# Interview Master Writer

시니어 백엔드 면접 마스터 플레이북을 생성하여 `fos-study`에 직접 게시한다.

`experience-question-bank-writer`(팀별 Q&A)나 `study-pack-writer`(단일 기술 토픽)와 달리, 어느 회사 면접에서도 재사용 가능한 크로스트랙 플레이북을 목표로 한다.

## 호출 방법

```bash
career-os/scripts/command-router/run_now.sh master <topic>
```

`<topic>` 기본값: `senior-backend-master-playbook` (`config/topics.json` master namespace).

실행 파일: `career-os/scripts/interview-master-writer/`(ADR-019).

## 입력

- `config/topics.json` (master namespace) — 토픽 메타데이터
- `references/master-prompt.md` — 공통 프롬프트 템플릿
- 이력서 1개 + 태스크 문서 2-4개 + 선택적 JD 컨텍스트 1개

전체 태스크 트리를 한 번에 투입하지 않는다.

## 산출물

- `sources/fos-study/...` — `[초안]` 접두어로 게시 + git commit + push
- `data/reports/` — 실행 로그·중간 산출물

문서 포함 항목: 1분 자기소개, 90초 버전, 커리어 타임라인, 강점/약점, 기술 의사결정 스타일, 프로젝트 요약, 이직 동기, 역질문 리스트, 면접 당일 체크리스트. push 실패 시 명시적으로 오류 출력.

커밋 메시지 예: `docs(interview): add draft senior-backend master playbook`.

## 관련 ADR

ADR-005: 산출물 경로 컨벤션.
ADR-019: scripts/<skill>/ 분리 컨벤션.
