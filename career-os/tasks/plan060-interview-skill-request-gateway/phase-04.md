# Phase 04 — 통합 검증과 안전 경계 점검

## 목표

plan060 구현이 request gateway 계약, private data 경계, forbidden action 경계를 지키는지 검증한다.

## 중요 지침

이 phase는 validation phase다.
`career-os/docs/`, `AGENTS.md`, `TOOLS.md`, ADR, 정책 문서를 수정하지 않는다.
계약이 부족하면 구현을 추측하지 말고 `PHASE_BLOCKED`로 멈춘다.

## 범위

- request 생성 smoke 검증.
- processor dry-run 또는 unit 검증.
- allowlist 밖 skill 차단 검증.
- `[초안]` study pack commit/push status 검증.
- answer record 전문 저장과 상세 feedback 표시 검증.
- 면접 대화 세션 UX 검증.
- 기본 5턴과 자유형 연장 검증.
- feedback 점수 4축 검증.
- 자연어 study-pack request 검증.
- read_only/archive 전환 검증.
- stdout 전문과 private body 저장 금지 검증.
- dashboard가 direct skill execution을 하지 않는지 grep 검증.
- forbidden action 키워드 검증.
- plan060 `index.json`과 phase 파일 상태 정리.

## 범위 밖

- 새 기능 추가.
- docs/ADR/정책 문서 수정.
- 실제 외부 제출, 공개 발행, 로그인, 업로드.
- candidate-profile 자동 수정.

## 검증 명령

보고 직전 반드시 관련 bash 검증을 실행하고 raw 결과를 남긴다.

```bash
python3 -m json.tool career-os/tasks/plan060-interview-skill-request-gateway/index.json >/dev/null
rg "CJ푸드빌|2026-06-15|interview-prep-analyzer|interview-asset-writer|study-pack-writer|request queue|\\[초안\\]|commit/push|답변 전문|상세 피드백|기본 5턴|자유형|기술 정확성|경험 연결|답변 구조|CJ푸드빌 맥락 반영|자연어|꼬리질문|최종 요약|read-only|archive|외부 제출" career-os/docs career-os/tasks/plan060-interview-skill-request-gateway
git diff --check
```

fos-career 쪽 검증 명령은 repo의 기존 package script를 사용한다.
명령이 없으면 어떤 검증을 실행할 수 없었는지 보고한다.

## 성공 기준

- request 생성, status update, dashboard 상태 표시가 검증된다.
- allowlist 밖 skill 요청은 실패 또는 blocked가 된다.
- `study-pack-writer` 요청은 공개 가능 study topic gate를 통과해야 실행되고, `[초안]` fos-study commit/push 결과를 남긴다.
- answer record는 사용자 답변 전문을 DB에 저장하고 dashboard에서 보여준다.
- 상세 피드백도 DB에 저장하고 dashboard에서 보여준다.
- 세션은 기본 5턴으로 시작하고 자유형 연장이 가능하다.
- feedback은 기술 정확성, 경험 연결, 답변 구조, CJ푸드빌 맥락 반영 점수를 제공한다.
- 사용자는 고정 추천뿐 아니라 자연어로도 study-pack request를 만들 수 있다.
- 인터뷰 중 모르는 주제에서 직접 study-pack request를 만들 수 있다.
- 질문 생성/선택 -> 답변 입력 -> 피드백 -> 꼬리질문 -> 답변 -> 최종 요약/보완 주제/study-pack 후보 UX가 검증된다.
- 2026-06-15 CJ푸드빌 면접 종료 후 read_only/archive 전환 경로가 검증된다.
- private 문서 본문과 command stdout 전체가 request result/audit/UI에 저장되지 않는다.
- 외부 제출, 공개 발행, 로그인, 업로드, candidate-profile 자동 수정 경로가 없다.
- `git diff --check` 통과.

## PHASE_BLOCKED

기존 구현이 docs-first 계약과 충돌하고 문서 변경 없이 해결할 수 없으면 `PHASE_BLOCKED: implementation contract drift requires planning review`를 출력한다.

## PHASE_FAILED

검증 명령을 실행하지 않고 success로 보고하거나, forbidden action 경로가 남아 있으면 실패로 본다.

## 완료 기록

- status: completed
- completed_at: 2026-06-07T13:21:17Z
- fos-career 검증:
  - `npx tsc --noEmit`
  - `npm run apply:interview-requests -- --self-test-gates`
  - `DATABASE_URL=mysql://user:pass@127.0.0.1:3306/fos_career SESSION_SECRET=0123456789abcdef0123456789abcdef SESSION_COOKIE_SECURE=false npm run build`
  - `git diff --check HEAD~2..HEAD`
  - dashboard/API direct skill execution grep: match 없음.
  - private body/stdout 경계 grep: answer body와 feedback body는 private answer table/UI 표시 경로에만 있고 request/audit에는 길이, id, summary만 저장.
- career-os task 검증:
  - `python3 -m json.tool career-os/tasks/plan060-interview-skill-request-gateway/index.json >/dev/null`
  - phase 계약 키워드 `rg` 검증.
  - `git diff --check`
