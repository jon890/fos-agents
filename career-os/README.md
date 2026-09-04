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

clone 뒤에는 `.env.example`에서 필요한 secret 키 이름을 확인한다.
현재 경력, 역할 선호와 경험 경계는 private brain이 기준 원본이다.

`scripts/career-workspace/`에는 비공개 작업 파일의 manifest, 준비, 차이 확인과 발행을 담당하는 공통 CLI가 있다.
홈서버의 `career-storage`는 `career-os` S3 bucket에 검증된 불변 release를 보관하고 검증이 끝난 뒤 current pointer를 바꾼다.
코드를 확인할 때는 [`scripts/career-workspace/README.md`](scripts/career-workspace/README.md)의 정상 실행 경로부터 읽는다.
세 작성 skill은 실행 전 준비와 성공 뒤 발행을 자동으로 수행한다.
로컬 작업본과 원격 release 차이를 확인할 때는 저장소 루트에서 다음 명령을 실행한다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/career-workspace/cli.ts" check --json
```

`.env`는 워크스페이스 루트에 두고 git에 올리지 않는다.
홈서버에서는 S3 실행 파일을 빌드하고 `CAREER_STORAGE_S3_EXECUTABLE`, 공용 publish 잠금과 네 `CAREER_STORAGE_S3_*` 값을 서비스 환경에 둔다.
SSH client는 원격 transport 값을 넣고, 홈서버의 Hermes는 `CAREER_WORKSPACE_COMMAND`로 같은 `career-storage` 명령을 호출한다.
설치, 상태 확인과 복구 순서는 [홈서버 객체 저장소 연결 계약](../docs/home-server-object-storage.md)을 따른다.
진행 중인 지원 대상은 private brain에서 확인하고 공고별 실행 자료는 `applications/<company>/<role>/`에서 관리한다.
외부 게시, 제출, 로그인, 업로드, 메시지 전송은 사용자 승인 후에만 수행한다.

## 작업 흐름

1. 활성 공고를 수집하고 지원 후보를 판단한다.
2. 공고별 지원 패키지를 만들고 근거 감사, 블라인드 평가와 HTML·PDF 검증을 통과할 때까지 제출 문서를 개선한다.
3. 면접 답변 연습 결과를 다음 복습과 준비 행동에 반영한다.
4. 기술 학습과 질문 은행은 공개 가능한 자산으로 축적한다.

세부 흐름은 [docs/flow.md](docs/flow.md)를 따른다.

## 데이터 경계

- `config/`에는 수집 정책과 사람이 고른 예외를 둔다.
- `applications/`, `library/`와 `state/`는 홈서버 `career-os` S3 collection의 release와 동기화할 로컬 작업본이다.
- 게시용 HTML과 실행별 중간 데이터는 시스템 임시 디렉터리에 두고 검증 뒤 삭제한다.
- `cache/`에는 원본에서 다시 만들 수 있는 수집 결과를 둔다.
- `public/question-bank/`, `sources/fos-study/`에는 공개 가능한 일반 지식만 둔다.
- 실제 제출, 로그인, 업로드, 외부 메시지 전송, 공개 발행은 사용자 승인 후에만 수행한다.

## 검증

문서 변경 뒤에는 현재 파일 구조와 낡은 실행기·경로·전달 매체 표현이 남았는지 확인한다.
구조 변경이면 `scripts/`, `config/`, `applications/`, `library/`, `state/`, `cache/`와 시스템 임시 산출물의 설명을 대조한다.

TypeScript 스크립트 변경이 있으면 루트에서 `bunx tsc --noEmit`과 해당 스크립트의 검증 명령을 실행한다.

## 문서

- [AGENTS.md](AGENTS.md): 에이전트 운영 규칙과 문서·skill 라우팅
- [docs/prd.md](docs/prd.md): 제품 가치와 성공 기준
- [docs/flow.md](docs/flow.md): 입력부터 산출물까지의 실행 흐름
- [docs/data-schema.md](docs/data-schema.md): config·state·산출물 스키마
- [docs/code-architecture.md](docs/code-architecture.md): 디렉터리와 구현 책임
- [docs/adr/INDEX.md](docs/adr/INDEX.md): 중요한 결정의 이유
