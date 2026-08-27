# career-os

커리어 전환의 공고 탐색, 지원 준비, 면접 연습, 학습 자산을 파일과 agent skill로 관리하는 개인 운영 워크스페이스다.

## 시작

현재 작업에 맞는 skill을 직접 호출한다.
각 skill은 `SKILL.md`에 입력, 산출물, 검증, 안전 경계를 담는다.

- 지원 가능한 공고를 찾을 때: `/position-recommender`
- 공고별 지원 판단과 전략을 준비할 때: `/application-package-writer <posting-path>`
- 이력서·경력기술서를 작성하고 검증할 때: `/resume-preparer <application-directory>`
- 기술·인성·포지션별 면접 질문을 준비하고 연습할 때: `/interview-practice <tech|behavioral>`
- 오늘 읽거나 볼 기술 자료를 고를 때: `/study-topic-recommender`

`application-package-writer`는 전체 지원 요청에서 `resume-preparer`까지 연결한다.
`interview-practice`는 공개 질문 보강도 내부 유지보수 절차로 처리한다.
각 스킬의 입력, 산출물, 검증, 안전 경계는 해당 `SKILL.md`에서 확인한다.

## 설정

clone 뒤 확인할 기본 파일:

- `.env.example`: 필요한 secret 키 이름.
- `config/candidate-profile.md`: 후보자 프로필 기준 원본.
- `config/position-collection.ts`: 공고 수집 설정과 검증.

`.env`는 워크스페이스 루트에 두고 git에 올리지 않는다.
진행 중인 지원 대상은 private brain에서 확인하고 공고별 실행 자료는 `applications/<company>/<role>/`에서 관리한다.
외부 게시, 제출, 로그인, 업로드, 메시지 전송은 사용자 승인 후에만 수행한다.

## 작업 흐름

1. 활성 공고를 수집하고 지원 후보를 판단한다.
2. 공고별 지원 패키지를 만들고 근거 감사, 블라인드 평가와 HTML·PDF 검증을 통과할 때까지 제출 문서를 개선한다.
3. 면접 답변 연습 결과를 다음 복습과 준비 행동에 반영한다.
4. 기술 학습과 질문 은행은 공개 가능한 자산으로 축적한다.

세부 흐름은 [docs/flow.md](docs/flow.md)를 따른다.

## 데이터 경계

- `config/`에는 후보자 기준, 정책, 사람이 고른 예외를 둔다.
- `state/`에는 답변 연습 진행처럼 저장소 실행에 필요한 상태만 둔다.
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
