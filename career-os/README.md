# career-os

커리어 전환의 공고 탐색, 지원 준비, 면접 연습, 학습 자산을 파일과 agent skill로 관리하는 개인 운영 워크스페이스다.

## 시작

현재 작업에 맞는 skill을 직접 호출한다.
각 skill은 `SKILL.md`에 입력, 산출물, 검증, 안전 경계를 담는다.

- 지원 가능한 공고를 찾을 때: `/position-recommender`
- 공고별 지원 초안을 만들 때: `/application-package-writer <posting-path>`
- 지원 패키지를 검토할 때: `/application-reviewer <application-dir>`
- HTML 이력서를 높은 기준으로 채점하고 개선할 때: `/resume-evaluator <resume.html>`
- 이력서 주장과 실제 코드·Git 이력을 대조할 때: `/resume-evidence-auditor <resume.html>`
- 역할 적합도와 면접 전략을 볼 때: `/job-fit-analyzer <role>`
- 면접 단계별 준비를 만들 때: `/interview-stage-prep`
- 기술 또는 인성 답변을 연습할 때: `/tech-interview-drill`, `/behavioral-interview-drill`
- 오늘 읽거나 볼 기술 자료를 고를 때: `/study-topic-recommender`

각 skill의 입력, 산출물, 검증, 안전 경계는 해당 `SKILL.md`에서 확인한다.

## 설정

clone 뒤 확인할 기본 파일:

- `.env.example`: 필요한 secret 키 이름.
- `config/candidate-profile.md`: 후보자 프로필 기준 원본.
- `config/position-collection.ts`: 공고 수집 설정과 검증.
- `config/position-filters.json`: 제외 회사와 억제 공고 URL.
- `config/current-target.example.json`: 현재 지원 대상 로컬 파일의 예시.

`.env`는 워크스페이스 루트에 두고 git에 올리지 않는다.
진행 중인 지원 대상이 있으면 예시를 `state/current-target.json`으로 복사해 실제 값으로 바꾼다.
이 파일은 현재 대상 하나만 담으며 Git에 올리지 않는다.
외부 게시, 제출, 로그인, 업로드, 메시지 전송은 사용자 승인 후에만 수행한다.

## 작업 흐름

1. 활성 공고를 수집하고 지원 후보를 판단한다.
2. 공고별 지원 패키지를 만들고 근거·과장·공개 범위를 검토한 뒤 HTML 이력서를 반복 개선한다.
3. 역할 fit, 면접 단계, 답변 드릴 결과를 다음 준비 행동에 반영한다.
4. 기술 학습과 질문 은행은 공개 가능한 자산으로 축적한다.

세부 흐름은 [docs/flow.md](docs/flow.md)를 따른다.

## 데이터 경계

- `config/`에는 후보자 기준, 정책, 사람이 고른 예외를 둔다.
- `state/`에는 현재 타깃, 드릴 진행, cooldown 같은 실행 상태를 둔다.
- `applications/`, `private/`, `reports/`, `cache/`에는 지원 전략, 개인 산출물, 실행 결과, 재생성 가능한 캐시를 둔다.
- `public/question-bank/`, `sources/fos-study/`에는 공개 가능한 일반 지식만 둔다.
- 실제 제출, 로그인, 업로드, 외부 메시지 전송, 공개 발행은 사용자 승인 후에만 수행한다.

## 검증

문서 변경 뒤에는 현재 파일 구조와 낡은 실행기·경로·전달 매체 표현이 남았는지 확인한다.
구조 변경이면 `scripts/`, `config/`, `state/`, `reports/`, `applications/`, `cache/`의 실제 파일과 문서 설명을 대조한다.

TypeScript 스크립트 변경이 있으면 루트에서 `bunx tsc --noEmit`과 해당 스크립트의 검증 명령을 실행한다.

## 문서

- [AGENTS.md](AGENTS.md): 에이전트 운영 규칙과 문서·skill 라우팅
- [docs/prd.md](docs/prd.md): 제품 가치와 성공 기준
- [docs/flow.md](docs/flow.md): 입력부터 산출물까지의 실행 흐름
- [docs/data-schema.md](docs/data-schema.md): config·state·산출물 스키마
- [docs/code-architecture.md](docs/code-architecture.md): 디렉터리와 구현 책임
- [docs/adr/INDEX.md](docs/adr/INDEX.md): 중요한 결정의 이유
- [docs/README.md](docs/README.md): 문서 작성 책임과 형식
