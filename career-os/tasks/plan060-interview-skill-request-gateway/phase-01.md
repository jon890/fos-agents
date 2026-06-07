# Phase 01 — 문서 계약 고정

## 목표

CJ푸드빌 2026-06-15 면접 준비 hub와 interview skill request gateway의 docs-first 계약을 고정한다.

## 상태

이 phase는 plan materialization 중 완료됐다.
구현 worker는 이 phase를 다시 실행하지 말고 `index.json`의 `current_phase`에 따라 Phase 02부터 시작한다.

## 완료된 범위

- `docs/prd.md`에 plan060 MVP 범위와 범위 밖 항목 추가.
- `docs/data-schema.md`에 `interview_skill_requests` 성격의 request queue 계약 추가.
- `docs/flow.md`에 hub projection, 요청 생성, processor 흐름 추가.
- `docs/code-architecture.md`에 dashboard, API, processor, native skill 책임 경계 추가.
- `docs/adr.md`에 ADR-061 추가.
- `study-pack-writer` 요청이 `[초안]` fos-study 문서 생성과 commit/push까지 이어지는 결정을 추가.
- dashboard 답변 텍스트 입력, 답변 전문 DB 저장, 상세 피드백 DB 저장 결정을 추가.
- 면접 대화 세션 UX와 2026-06-15 이후 read-only/archive 전환 결정을 추가.
- 기본 5턴 세션, 자유형 연장, 점수화 기준, 자연어 study-pack 요청 결정을 추가.
- implementation phase에서 docs/ADR/정책 문서를 수정하지 않는 원칙 반영.

## 범위 밖

- fos-career 코드 수정.
- career-os scripts 수정.
- career-os `.claude/skills` 수정.
- 실제 skill 실행.
- commit, push, PR 생성.

## 성공 기준

- plan060 문서 계약에 CJ푸드빌, 2026-06-15, `interview-prep-analyzer`, `interview-asset-writer`, `study-pack-writer`, `request queue`, `[초안]`, `commit/push`, 답변 전문, 상세 피드백, 기본 5턴, 자유형 연장, 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영, 자연어 study-pack 요청, 꼬리질문, 최종 요약, read-only/archive, 외부 제출 금지가 모두 등장한다.
- task `index.json`이 `python3 -m json.tool`을 통과한다.
- `git diff --check`가 통과한다.

## PHASE_BLOCKED

문서 계약이 기존 plan053/054/059의 read-only dashboard와 pending request bridge 원칙을 깨야만 성립한다면 `PHASE_BLOCKED: request gateway contract conflicts with existing dashboard boundary`를 출력한다.

## PHASE_FAILED

fos-career, career-os scripts, career-os `.claude/skills` 파일을 수정했다면 실패로 본다.
