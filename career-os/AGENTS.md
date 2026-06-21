# AGENTS.md — career-os 워크스페이스

`career-os`는 커리어 성장, 회사·공고 적합도 분석, 면접 준비, 지원 준비 자동화를 위한 독립 워크스페이스다.
모든 에이전트는 이 파일을 진입점으로 삼고, 상세 사양은 책임 문서와 각 skill 본문에서 확인한다.
`CLAUDE.md`는 이 파일의 심볼릭 링크다.

공통 운영 규칙은 루트 [`../AGENTS.md`](../AGENTS.md)를 따른다.
이 파일에는 career-os에서만 다른 경계와 읽기 순서만 남긴다.

## 읽기 순서

작업 범위에 맞는 단일 출처를 먼저 연다.
같은 정의를 여러 문서에 복제하지 않는다.

| 문서 | 책임 | 언제 보는지 |
|---|---|---|
| [`../AGENTS.md`](../AGENTS.md) | 모노레포 공통 규칙 | 모든 작업 시작 시 |
| [`docs/README.md`](docs/README.md) | career-os 문서별 책임과 작성 규칙 | docs 작성·수정 전 |
| [`docs/prd.md`](docs/prd.md) | 제품 가치, skill 자산, 성공 기준 | 새 기능 추가, 우선순위 결정 |
| [`docs/data-schema.md`](docs/data-schema.md) | config, runtime, 산출물, ledger 스키마 | 데이터 파일 변경, 새 상태값 추가 |
| [`docs/flow.md`](docs/flow.md) | 사용자 입력부터 산출물까지의 흐름 | 새 실행 흐름 추가, 디버깅 |
| [`docs/code-architecture.md`](docs/code-architecture.md) | 디렉터리 책임, 외부 의존, 실행 구조 | 코드 구조 변경, 새 스크립트 추가 |
| [`docs/adr/INDEX.md`](docs/adr/INDEX.md) | 결정의 이유와 대안 기각 기록 | 정책 변경, 되돌리기 어려운 결정 |

## 작업 경계

현재 타깃, 회사명, 공고, 면접 일정, 학습 우선순위처럼 자주 바뀌는 상태는 `AGENTS.md`에 쓰지 않는다.
해당 상태는 `config/`, `data/`, `tasks/`, `logs/`의 책임 파일에서 관리한다.

- 후보자 프로필의 정본은 `config/candidate-profile.md`다.
- 공개 학습 자료는 `sources/fos-study/`에서 파생한다.
- 공개 질문 목록은 `public/question-bank/`에서 파생한다.
- `config/`에는 사람이 고른 정책, pin, override, 제외 조건만 둔다.
- 과거 이력과 결정 이유는 `docs/adr/`에만 남긴다.

외부 제출과 공개 발행은 반드시 사용자 승인을 받은 뒤에만 수행한다.

- 실제 지원서 제출, 업로드, 로그인, 이메일 전송은 자동으로 하지 않는다.
- 공개 `fos-study` 게시물은 사용자 검토 전까지 초안으로 다룬다.
- 개인 이력, 지원 전략, 회사별 비공개 맥락은 `career-os/data/` 아래 비공개 산출물에 둔다.
- 공개 글에는 민감한 개인 정보, 정확한 주소, 비공개 내부 정보를 쓰지 않는다.

## 계획과 구현

계획과 구현의 기본 규칙은 루트 [`../AGENTS.md`](../AGENTS.md)의 planning, background worktree, commit 규칙을 따른다.
career-os에서는 다음 차이만 추가로 지킨다.

- 구현 전에는 관련 `docs/` 또는 `docs/adr/` 결정을 먼저 고정한다.
- docs 작성·수정 전에는 [`docs/README.md`](docs/README.md)의 문서별 책임을 확인한다.
- 실행 계획은 `tasks/plan{N}-<slug>/` 아래에 보존한다.
- 각 plan은 `index.json`과 `phase-NN.md`를 가진다.
- phase 문서는 실행 가능한 성공 기준, 보류 조건, 실패 조건을 포함한다.
- 여러 phase를 건드리는 구현은 별도 worktree와 branch를 기본값으로 둔다.
- 같은 plan 안의 phase는 명시적 예외가 없으면 순서대로 실행한다.
- task나 phase를 실행하기 전에는 `docs/adr/INDEX.md`에서 관련 결정을 확인한다.

새 아키텍처 결정은 `docs/adr/ADR-NNN-slug.md` 파일과 `docs/adr/INDEX.md` 행을 함께 추가한다.
긴 운영 절차와 장애 회고는 이 파일이 아니라 ADR, task, flow 문서에 둔다.
AGENTS.md, SKILL.md, ADR, flow 문서처럼 다음 실행자의 행동을 바꾸는 핵심 문서를 수정했으면 완료 보고에 반드시 알리고, 관련 변경은 관심사별 commit/push 대상으로 본다.

## Skill 진입점

현재 표준은 에이전트 비종속 skill 호출이다.
문서와 skill 간 위임은 `/<skill> [args]` 형태의 의도 표현으로 적는다.
어떤 CLI나 서브에이전트로 실행할지는 실행 환경이 결정한다.

정본은 `career-os/.claude/skills/<skill>/SKILL.md`다.
Codex 노출은 `career-os/.codex/skills/<skill>` 심볼릭 링크로 연결한다.
각 skill의 상세 입력, 산출물, 금지사항은 해당 `SKILL.md`와 `docs/flow.md`를 따른다.
리포트와 application-agent가 다음 행동을 안내할 때는 `Use skill: /<skill> [args]`처럼 에이전트 비종속 표현을 쓴다.

| Skill | 책임 | 상세 |
|---|---|---|
| `study-pack-writer` | 공개 가능한 기술 학습 문서 초안 작성 | [SKILL.md](.claude/skills/study-pack-writer/SKILL.md), [flow](docs/flow.md) |
| `study-topic-recommender` | 아침 학습 토픽 추천과 후보 풀 보충 | [SKILL.md](.claude/skills/study-topic-recommender/SKILL.md), [flow](docs/flow.md) |
| `question-bank-collector` | 공개 가능한 일반 backend/CS 질문 bank 보강 | [SKILL.md](.claude/skills/question-bank-collector/SKILL.md), [flow](docs/flow.md) |
| `interview-asset-writer` | 후보자 이력 기반 면접 자산 초안 작성 | [SKILL.md](.claude/skills/interview-asset-writer/SKILL.md), [flow](docs/flow.md) |
| `tech-interview-drill` | 기술 면접 일일 답변 드릴 | [SKILL.md](.claude/skills/tech-interview-drill/SKILL.md), [flow](docs/flow.md) |
| `behavioral-interview-drill` | 인성 면접 일일 답변 드릴 | [SKILL.md](.claude/skills/behavioral-interview-drill/SKILL.md), [flow](docs/flow.md) |
| `interview-stage-prep` | 면접 단계별 실전 준비 | [SKILL.md](.claude/skills/interview-stage-prep/SKILL.md), [flow](docs/flow.md) |
| `job-fit-analyzer` | 타깃 직무 기준 핏과 갭 진단 | [SKILL.md](.claude/skills/job-fit-analyzer/SKILL.md), [flow](docs/flow.md) |
| `position-recommender` | 활성 공고 수집과 지원 후보 추천 | [SKILL.md](.claude/skills/position-recommender/SKILL.md), [flow](docs/flow.md) |
| `application-package-writer` | 공고별 지원 패키지 초안 작성 | [SKILL.md](.claude/skills/application-package-writer/SKILL.md), [flow](docs/flow.md) |
| `application-reviewer` | 지원 패키지 근거, 과장, drift 검토 | [SKILL.md](.claude/skills/application-reviewer/SKILL.md), [flow](docs/flow.md) |
| `daily-application-digest` | 지원 현황 일일 요약 작성 | [SKILL.md](.claude/skills/daily-application-digest/SKILL.md), [flow](docs/flow.md) |

## 외부 저장소와 데이터 경계

`sources/fos-study`는 외부 동기 저장소다.
study-pack 계열 작업이 아니면 프로젝트 코드처럼 편집하지 않는다.
게시 목적 글은 작성 후 필요한 README나 index를 갱신하고, 검증 후 commit/push한다.

`fos-career`는 사람용 웹 제품 repo로 분리해서 다룬다.
career-os는 수집, 리포트 생성, skill 실행, private 산출물 생성을 맡는다.
웹 대시보드의 인증, 세션, 감사 로그, 지원 후보 상태, background outbox는 `fos-career` 책임이다.

Discord에 HTML을 첨부할 때는 전역 HTML 읽기 정책을 완화하지 않는다.
직접 첨부 대상 HTML은 `data/runtime/downloads/` 아래 파일만 허용한다.
구체적인 검증과 스테이징 절차는 `docs/flow.md` 또는 관련 task 문서를 따른다.

커리어 포지션 추천, 지원 후보 비교, 면접 준비, 학습 추천처럼 사용자가 보는 리포트성 산출물은 HTML 파일도 함께 만든다.
공고·포지션 추천 리포트는 예외 없이 `data/runtime/downloads/` 아래 HTML을 첨부하고, HTML 안의 각 공고명에는 개별 공고 URL로 이동하는 링크를 건다.
Discord 미리보기에는 상위 후보 5~10개와 핵심 사유를 짧게 쓰되, 각 후보의 공고 링크도 함께 포함한다.
HTML에는 개인 이력, 지원 전략, 회사별 비공개 맥락의 공개 범위를 점검하고, 채널에 노출해도 되는 요약만 담는다.
단순 상태 보고나 한두 줄 답변은 예외로 둘 수 있다.

## fos-brain 연동

단일 정책은 루트 [`../AGENTS.md`](../AGENTS.md)의 fos-brain 섹션을 따른다.
career-os에서는 산출물 성격에 따라 네임스페이스를 고른다.

| 산출물 | 네임스페이스 |
|---|---|
| 공개 가능한 학습 지식, 일반 면접 지식 | `public` |
| 개인 baseline, 면접 자산, 커리어 데이터 | `private` |
| 회사 업무 맥락 | `work` |

brain 쓰기는 사용자 승인 후에만 수행한다.
하루짜리 실행 로그, 단순 cron 성공/실패, repo 문서에 이미 충분한 구현 세부는 brain에 넣지 않는다.
