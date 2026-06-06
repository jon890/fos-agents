# Phase 01 — LLM provider interface와 OpenAI 구현 추가

## 목표

`~/services/fos-career/app/api/chat/route.ts`가 특정 LLM SDK에 직접 묶이지 않도록 `lib/llm/` provider interface를 추가하고, 현재 운영 provider는 OpenAI/Codex 계열로 고정한다.

## 범위

- `lib/llm/types.ts`: provider 공통 계약
- `lib/llm/openai-provider.ts`: OpenAI Responses API 구현
- `lib/llm/provider.ts`: `LLM_PROVIDER` 기반 provider 선택
- `.env.example`, `README.md`: 설정과 교체 방법 문서화
- `app/api/chat/route.ts`: provider interface 호출로 변경

## 범위 밖

- LLM이 career-os 파일을 쓰는 기능
- 외부 사이트 접근, fos-study 발행, 지원서 제출
- dashboard write action
- prompt/RAG 고도화

## 성공 기준

- `npm run build`가 통과한다.
- chat route가 `openai`를 직접 import하지 않는다.
- `LLM_PROVIDER=openai` 설정 경계가 문서화된다.
- provider/model이 audit log details에 남는다.

## 검증 결과

- `set -a; . /home/bifos/apps/fos-career/.env; set +a; npm run build` 통과.
- `npm run build`를 env 없이 실행하면 `DATABASE_URL environment variable is not set`으로 실패한다. 이는 배포 환경 변수가 필요한 기존 제약이다.
- Next.js 16.2.7 build에서 `middleware` 파일명 deprecation 경고와 career-os adapter의 dynamic fs trace 경고가 남아 있다. 이번 phase 범위 밖이다.

## 실패/보류 조건

- `npm run build`가 타입 오류로 실패하면 PHASE_FAILED.
- OpenAI SDK가 Responses API streaming 타입을 제공하지 않으면 PHASE_BLOCKED로 남긴다.
