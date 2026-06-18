# PRD — career-os

career-os는 커리어 전환 과정을 매일 재실행 가능한 로컬 워크플로로 묶는 개인 운영 체계다.
핵심 자산은 `SKILL.md`로 정의된 agent skill이다.
각 skill은 반복 업무의 의도, 입력, 산출물, 안전 경계를 담는 제품 단위다.

이 문서는 제품 가치와 우선순위의 단일 출처다.
작성 규칙은 [`README.md`](README.md)의 PRD 작성 규칙을 따른다.
입력부터 산출물까지의 흐름은 [`flow.md`](flow.md)를 따른다.
디렉터리와 구현 구조는 [`code-architecture.md`](code-architecture.md)를 따른다.
결정의 이유와 대안 기각은 [`adr/INDEX.md`](adr/INDEX.md)를 따른다.

## 제품 약속

후보자가 오늘 무엇을 지원하고, 무엇을 보강하고, 무엇을 연습해야 하는지 판단할 수 있게 한다.
그 판단을 공고, 후보자 프로필, 지원 산출물, 면접 드릴 결과, 공개 가능한 학습 자산으로 계속 축적한다.

제품이 제공해야 하는 가치는 세 가지다.

- 좋은 기회를 놓치지 않게 한다.
- 지원과 면접 준비를 근거 기반 산출물로 바꾼다.
- 한 번 만든 skill과 산출물이 다음 판단의 자산으로 다시 쓰이게 한다.

## 사용자와 상황

사용자는 후보자 본인 1인이다.
사용자는 매일 공고와 학습 주제를 확인한다.
그 안에서 지원 후보를 고르고, 공고별 지원 패키지를 만들고, 면접 답변을 연습한다.

현재 집중 타깃은 `config/mvp-target.json`이 단일 출처다.
회사명, 팀명, 면접일 같은 자주 바뀌는 상태는 PRD에 박지 않는다.

## 해결할 문제

커리어 전환 과정은 여러 작은 판단이 이어지는 반복 작업이다.
career-os는 아래 문제를 줄이는 데 집중한다.

- 공고 탐색 결과가 흩어져 어떤 후보가 실제 지원 가치가 있는지 판단하기 어렵다.
- 공고별 지원 전략, 이력서 초안, 검토 결과가 매번 새로 만들어져 누적되지 않는다.
- 면접 준비가 실제 약점, 공고 요구사항, 최근 지원 흐름과 연결되지 않는다.
- 공개 가능한 학습 자료와 비공개 지원 전략이 섞일 위험이 있다.
- 웹 대시보드나 자동화 worker가 어떤 작업을 해도 되는지 안전 경계가 흐려지기 쉽다.

## Skill 자산 원칙

각 skill은 단순 명령이 아니라 제품 자산이다.
좋은 skill은 한 번 실행하고 끝나는 것이 아니라 다음 실행의 판단 품질을 높인다.

자산으로 인정되는 조건:

- 입력과 산출물의 책임이 명확하다.
- 공개 가능 자산과 비공개 자산을 분리한다.
- 근거가 부족하면 추측으로 채우지 않고 `보강 필요 / 선택지 / 권장 행동`으로 남긴다.
- 사용자 승인 없이 제출, 로그인, 업로드, 외부 메시지 전송, 공개 발행을 하지 않는다.
- 결과가 다음 추천, 지원 준비, 면접 드릴, dashboard 상태 판단에 재사용된다.

## 현재 제품 축

### 기회 발견

- 사용자 가치: 오늘 볼 만한 공고와 다음 행동을 좁힌다.
- 현재 자산: `/position-recommender`.
- 주요 산출물: 추천 JSON, Markdown/HTML 리포트, 후보 상태.
- 다음 가치: 추천 근거와 사용자 선택을 다음 수집과 우선순위에 환류한다.

### 지원 준비

- 사용자 가치: 공고별 fit, 초안, 제출 전 점검을 만든다.
- 현재 자산: `/application-package-writer`, `/application-reviewer`, `/daily-application-digest`.
- 주요 산출물: `fit-analysis.md`, `application-package.md`, `resume-draft.md`, `review.md`, digest.
- 다음 가치: 지원 패키지의 누락 근거와 reviewer 지적을 다음 이력서와 면접 준비에 연결한다.

### 면접 준비

- 사용자 가치: 역할 기준 의사결정, 면접 전략, 매일 답변 품질을 관리한다.
- 현재 자산:
  `/job-fit-analyzer`, `/interview-stage-prep`, `/tech-interview-drill`, `/behavioral-interview-drill`, `/interview-asset-writer`.
- 주요 산출물: 역할 fit JSON/리포트, 단계별 준비 자료, 드릴 로그, 면접 자산.
- 다음 가치: 드릴 결과와 공고별 gap을 다음 질문 선택과 study pack 추천에 반영한다.

### 학습 자산

- 사용자 가치: 공부할 주제를 고르고 공개 가능한 자료로 축적한다.
- 현재 자산: `/study-topic-recommender`, `/study-pack-writer`, `/question-bank-collector`.
- 주요 산출물: morning 추천, study pack, public question bank.
- 다음 가치: 공개 가능 질문과 study pack이 private 준비를 돕되, 비공개 맥락을 노출하지 않게 한다.

### 운영 화면

- 사용자 가치: 사람이 상태와 다음 행동을 한 화면에서 판단한다.
- 현재 자산: fos-career dashboard, request queue, outbox worker.
- 주요 산출물: application candidate state, request status, audit log.
- 다음 가치: dashboard를 실행 버튼 모음이 아니라 안전한 의사결정 표면으로 만든다.

## 기능 계약

### 기회 발견

`/position-recommender`는 현재 열린 개별 공고와 후보자 프로필을 바탕으로 지원 후보를 추천한다.
추천은 회사 선호도 순위가 아니라 지금 취할 행동 기준으로 분류한다.

행동 기준:

- 강력 추천
- 도전 추천
- 보류 또는 주의
- 제외

강력 추천과 도전 추천에는 실제 active/open 공고 URL 근거가 필요하다.
근거가 약한 항목은 추천 후보가 아니라 조사 대상으로 남긴다.

### 지원 준비

지원 준비 skill은 공고 하나를 대상으로 private 지원 패키지를 만든다.
목표는 제출 자동화가 아니라 사용자가 제출 여부를 판단할 수 있는 근거와 초안을 준비하는 것이다.

필수 산출물:

- `fit-analysis.md`
- `application-package.md`
- `resume-draft.md`
- `cover-letter.md`
- `submission-checklist.md`
- `review.md`

`application-reviewer`는 제출 전 위험을 검토한다.
검토 축은 근거 없는 주장, 과장, drift, 공개 금지 정보, 중복 지원 위험, 사용자 승인 필요 항목이다.
`daily-application-digest`는 오늘 바뀐 지원 상태와 다음 행동을 요약한다.

### 면접 준비

면접 준비 skill은 “무엇을 더 공부해야 하는가”와 “답변이 충분한가”를 분리해서 다룬다.

역할:

- `/job-fit-analyzer [역할]`은 지원 의사결정, 면접 전략, 커리어 패스 정합성을 진단한다.
  자연어 역할 인자가 없으면 `config/mvp-target.json`을 기준으로 삼는다.
  JSON 정본과 Markdown 리포트를 함께 남긴다.
- `/interview-stage-prep`은 1차, 최종, 오퍼 단계별 준비 자료를 만든다.
- `/tech-interview-drill`은 기술 답변을 짧게 연습하고 약점에 반영한다.
- `/behavioral-interview-drill`은 STAR와 가치관 답변을 연습하고 약점에 반영한다.
- `/interview-asset-writer`는 후보자 이력 기반 Q&A와 플레이북을 만든다.

드릴은 정답 문서 생성이 아니라 답변 품질을 높이는 반복 루프다.
모르는 질문은 실패가 아니라 다음 study pack 또는 question bank 보강 후보가 된다.

### 학습 자산

학습 skill은 공개 가능한 기술 지식과 private 지원 맥락을 분리한다.
기술 토픽, CS 질문, backend 실무 질문은 public-safe 형태로 정규화한다.
회사별 전략, 후보자 답변 전문, 지원 판단 근거는 공개 자산으로 복사하지 않는다.

역할:

- `/study-topic-recommender`는 오늘 공부할 후보와 보강할 기존 문서를 추천한다.
- `/study-pack-writer`는 공개 가능한 기술 토픽을 study pack으로 작성한다.
- `/question-bank-collector`는 일반 backend/CS 질문을 공개 가능한 질문 은행으로 정리한다.

### 운영 화면

fos-career는 career-os의 human-facing 운영 화면이다.
career-os skill과 private 파일을 직접 대체하지 않는다.
dashboard는 사람이 상태, 후보, 요청, 결과를 보고 판단하는 표면이다.

운영 화면의 기본 원칙:

- career-os 파일은 읽기 전용 projection으로 다룬다.
- 쓰기 작업은 승인된 request queue와 worker를 통해 수행한다.
- dashboard container가 특정 agent CLI를 직접 실행하지 않는다.
- request와 audit log에는 상태, 경로, 짧은 요약만 남긴다.
  private 본문과 면접 답변 전문은 공개 채널이나 audit log에 복사하지 않는다.

## 공개 범위 계약

산출물은 공개 가능 여부에 따라 분리한다.

| 범위 | 위치 | 허용 내용 |
|---|---|---|
| Public-safe | `public/question-bank/`, `sources/fos-study/` | 일반 기술 지식, 공개 가능한 질문, 회사명 없는 study pack |
| Private | `data/applications/`, `private/`, `data/runtime/` | 지원 전략, 후보자 맥락, 면접 답변, reviewer 판단 |
| Config | `config/` | 후보자 프로필, 현재 타깃, 학습 진행 상태 |
| Dashboard state | fos-career DB | request 상태, application candidate state, audit summary |

공개 가능 여부가 애매하면 private으로 둔다.
공개 발행은 사용자의 명시 승인 후에만 수행한다.

## 비기능 요구사항

- **재실행 가능성**: 같은 날 같은 skill을 다시 실행해도 기존 상태를 깨지 않는다.
- **근거성**: 중요한 추천과 초안에는 공고, 프로필, 기존 산출물 중 어떤 근거를 썼는지 남긴다.
- **프라이버시**: private 지원 전략과 면접 답변 전문을 public-safe 산출물에 섞지 않는다.
- **사용자 승인**: 제출, 로그인, 업로드, 외부 메시지, 공개 발행은 사용자 승인 없이 하지 않는다.
- **에이전트 비종속성**: 문서와 skill 위임은 `/<skill> [args]` 의도 표현을 쓰고 특정 agent CLI에 묶지 않는다.
- **관찰 가능성**: 실패, 보류, 사용자 승인 필요 상태를 산출물이나 dashboard request 상태로 남긴다.

## 의도적으로 안 하는 것

- 외부 채용 사이트 제출 자동화.
- 사용자 승인 없는 로그인, 업로드, 메시지 전송.
- 회사별 지원 전략을 `sources/fos-study/`에 쓰는 일.
- 후보자 프로필을 자동으로 수정하는 일.
- dashboard container가 career-os 파일을 직접 쓰는 일.
- skill 내부 판단을 근거 없이 “합격 가능성” 같은 확정 표현으로 바꾸는 일.

## 성공 기준

career-os가 잘 작동하면 사용자는 매일 아래 질문에 답할 수 있다.

- 오늘 볼 만한 공고는 무엇이고, 각 공고의 다음 행동은 무엇인가.
- 지금 지원 준비 중인 공고에서 부족한 산출물은 무엇인가.
- 제출 전에 근거 부족, 과장, 공개 금지 정보가 검토됐는가.
- 다음 면접에서 가장 먼저 보강할 약점은 무엇인가.
- 오늘 공부할 public-safe 주제는 무엇인가.
- dashboard에서 요청한 작업이 어디까지 처리됐고, 어디서 사용자 승인이 필요한가.

제품 수준 성공 기준:

- 지원 후보 추천이 실제 active/open 공고 근거를 가진다.
- 공고별 지원 패키지가 reviewer 검토를 통과하거나, 수정 요청이 명확히 남는다.
- 기술/인성 드릴 결과가 약점 관리와 다음 학습 추천에 반영된다.
- public-safe 자산과 private 산출물이 섞이지 않는다.
- fos-career는 안전한 request 표면으로 동작하고, career-os skill 자산을 직접 훼손하지 않는다.

## 다음 가치 방향

다음 개발은 새 기능을 많이 늘리는 것보다 기존 skill 자산을 더 잘 연결하는 데 우선순위를 둔다.

우선순위:

1. 추천 후보, 지원 패키지, reviewer 지적, 드릴 결과를 하나의 상태 루프로 연결한다.
2. dashboard를 실행 버튼 모음이 아니라 다음 행동을 판단하는 운영 화면으로 만든다.
3. 질문 은행과 study pack을 약점 기반으로 재선별해 면접 준비에 되먹인다.
4. 지원 패키지의 evidence gap을 이력서 초안, 면접 질문, 공부 주제로 자동 분해한다.
5. 공개 가능한 지식 자산은 fos-study와 question bank로 축적하고, private 판단은 career-os 내부에만 남긴다.

새 plan은 위 방향 중 어떤 가치를 강화하는지 먼저 설명해야 한다.
단순히 새 화면, 새 파일, 새 runner를 추가하는 작업은 제품 가치와 연결되지 않으면 우선순위를 낮춘다.
