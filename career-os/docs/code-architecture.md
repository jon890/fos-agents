# 코드 아키텍처

career-os는 skill이 실행 계약을 설명하고 TypeScript 스크립트가 반복 가능한 처리를 담당하는 파일 기반 워크스페이스다.

## 디렉터리 구조

```text
career-os/
├── .claude/skills/       사용자 작업별 skill
├── .codex/skills/        Codex에서 같은 skill을 노출하는 링크
├── config/               사람이 관리하는 프로필과 수집·제외 정책
├── scripts/              검증, 수집과 변환 코드
├── state/                실행 사이에 유지하는 로컬 상태
├── applications/         공고별 지원 패키지
├── private/              개인 경력 근거와 비공개 준비 자료
├── public/               공개 가능한 질문 은행
├── reports/              구조화 결과와 사람이 읽는 리포트
├── cache/                다시 만들 수 있는 수집 결과
├── sources/fos-study/    별도 저장소에서 관리하는 공개 학습·이력 자료
└── docs/                 제품, 흐름, 데이터, 기술 결정 문서
```

## Skill과 실행 코드

`SKILL.md`는 입력, 실행 순서, 산출물, 검증, 안전 경계를 설명한다.
반복되는 수집, 파싱, 렌더링과 검증은 `scripts/`의 TypeScript로 구현한다.

하나의 스크립트가 수집과 추천, 렌더링을 모두 책임지지 않는다.
외부 응답은 경계에서 검증한 뒤 내부 타입으로 변환한다.
구조화 데이터 검증에는 Zod를 사용하고, 표시 문자열은 렌더러에서만 만든다.

## 공고 추천

`config/position-collection.ts`는 외부 채용 소스의 탐색 범위를 타입과 함께 관리한다.
회사별 탐색 채널은 `config/verified-company-research-targets.json`에 둔다.
사용자가 정한 개별 공고 억제는 `config/position-filters.json`에 둔다.

`scripts/position-recommender/live-postings/`는 외부 소스 어댑터의 공통 계약과 수집 정책을 구현한다.
어댑터는 원문 응답을 공통 `LivePosting` 형태로 바꾼다.
후보풀 정책은 개별 공고 URL, 활성 상태, 마감일, 중복을 결정적으로 검사한다.

수집 결과는 실행별 임시 후보풀에 저장한다.
모델은 후보풀에 존재하는 공고만 선별하고, `recommendation_schema.ts`가 결과 구조와 원문 일치 여부를 검사한다.
HTML은 검증된 추천 JSON에서 파생하며 게시 검증 뒤 임시 데이터와 함께 삭제한다.

## 지원 패키지

`application-package-writer`는 사용자가 호출하는 지원 준비 진입점이다.
공고와 회사 기준 확인, 후보자 인터뷰, 근거 매핑과 지원 전략을 한 흐름으로 연결한다.
반복 가능한 지원 패키지 계약 검사와 로컬 검토 화면 생성은 이 스킬의 `scripts/`에 둔다.

`resume-preparer`는 지원 전략을 이력서와 경력기술서로 변환하는 제출 문서 진입점이다.
문서 작성, 사람 확인, 주장 근거 감사, 블라인드 하드 리뷰, HTML·PDF 변환과 제출 묶음 검증을 순서대로 수행한다.
사실 감사와 설득력 평가는 별도 참고 문서와 검사 스크립트로 분리하지만 별도 스킬로 노출하지 않는다.

공고별 문서는 `applications/<company>/<position>/`에 둔다.
기준 원본은 `candidate-interview.md`, `application-package.md`, `resume-draft.md`와 `interview-questions.json`이다.
포지션별 질문은 공고 책임, 근거 방어와 경험 공백에서 파생한다.
사용자는 이 원본과 현재 제출 파일을 묶은 `application-package.html`에서 검토한다.
별도 지원 문항과 경력기술서는 필요한 경우에만 추가한다.
개인 근거와 면접 준비 자료는 `private/<company>/<position>/`에 둔다.
실제 제출은 두 스킬의 책임이 아니다.

## 후보자 프로필과 이력서

`config/candidate-profile.md`는 추천과 지원 준비에 필요한 후보자 요약과 확인된 경력 경계를 제공한다.
세부 성과는 문서 안에서 연결한 최신 이력 자료와 실제 작업 저장소를 확인한다.

제출 문서의 감사 결과와 주장별 근거 장부는 해당 `applications/<company>/<position>/`에 둔다.
공개 가능한 이력 자료는 별도 `sources/fos-study/` 저장소에서 관리한다.

## 현재 지원 대상과 면접 답변 연습

현재 지원 대상은 private brain에서 검색한다.
skill은 brain에서 찾은 회사와 역할을 대응하는 `applications/<company>/<position>/` 경로로 해석해 실행 스크립트에 명시적으로 전달한다.
TypeScript 스크립트가 brain을 직접 조회하지 않는다.

`scripts/interview-drill/`은 `interview-practice`의 기술·인성 모드에서 공통 진행과 복습 상태를 처리한다.
공고별 `interview-questions.json`을 명시하면 포지션 질문 세 개와 공통 기반 질문 두 개를 기본으로 섞는다.
`follow-up-policy.ts`는 답변 수준에 따른 꼬리질문 축과 최대 깊이를 제공한다.
복습 상태는 `state/drill-progress.json` 하나에 저장한다.

`config/interview-question-sources.ts`는 공식 문서, 기술 블로그, 공개 영상과 GitHub 가이드의 역할을 구분한다.
`scripts/interview-question-sources/`는 기존 읽을거리 수집 어댑터를 재사용해 실행별 후보풀을 만들고 설정과 후보 형식을 검증한다.
수집 후보는 질문의 정답 근거가 아니며, 공개 질문의 답변 신호는 공식 참조에서 다시 검증한다.

`public/question-bank/sources.json`은 공개 공통 질문이 참조하는 공식 URL과 확인일을 관리한다.
공개 질문 보강은 `interview-practice`의 필요할 때만 읽는 참고 문서가 안내한다.
`scripts/question-bank-collector/validate.ts`는 독립된 검증 모듈로 남아 질문 구조, 공개 범위, 출처 등록과 URL 형식을 검사한다.

## 아침 읽을거리

`config/external-reading-sources.ts`는 읽을거리 소스와 어댑터 종류를 타입 안전하게 관리한다.
`scripts/study-topic-recommender/source/`는 글과 영상 피드 수집 경계다.
후보풀, 선별, 이력, Markdown·HTML 렌더링은 각각 분리된 모듈이 담당한다.
YouTube 채널은 공식 Atom 피드를 기존 피드 어댑터로 수집한다.

수집 단계는 등록된 소스의 글과 영상을 결정적으로 가져온다.
모델은 고정 키워드 점수 대신 수집된 자료의 내용과 사용자 방향을 바탕으로 최종 자료를 고른다.
별도 AI 전용 소스나 AI 전용 리포트 구역은 두지 않는다.

## 리포트 게시

외부 게시용 HTML은 시스템 임시 디렉터리에 만든다.
외부 공유가 요청되면 루트의 `report-publisher` skill이 민감 정보 검사, Cloudflare Pages 게시, URL 검증을 담당한다.
게시가 끝나면 임시 HTML을 삭제한다.
사용자가 로컬 사본을 요청한 경우에만 지정한 경로에 보존한다.

개인 연락처와 비공개 지원 전략이 있는 이력서는 공개 리포트 게시 흐름과 분리한다.

## 외부 경계

- 채용 사이트와 기술 블로그는 읽기 전용 입력이다.
- `sources/fos-study/`는 별도 Git 저장소다.
- `.env`와 비공개 상태는 커밋하지 않는다.
- 외부 제출과 공개 게시에는 사용자 승인이 필요하다.
