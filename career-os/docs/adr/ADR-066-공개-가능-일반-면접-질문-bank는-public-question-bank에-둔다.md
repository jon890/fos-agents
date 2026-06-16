## ADR-066 — 공개 가능 일반 면접 질문 bank는 public/question-bank에 둔다

- Status: Accepted
- Date: 2026-06-08

### 맥락

면접 준비는 포지션별 private 질문만으로는 범위가 좁다.
일반적인 Java/Spring, DB, CS, 운영, System design 질문도 꾸준히 모아야 하지만, `data/`는 gitignore 대상이라 공개 가능하고 재사용 가능한 질문 bank를 보관하기에 적합하지 않다.

또한 OpenClaw에서 사용자가 “일반 백엔드 질문”, “CS 질문 수집”, “질문 bank 보강”처럼 자연어로 말했을 때 안정적으로 해당 작업이 호출되려면 skill description과 routing trigger가 명확해야 한다.

### 결정

- 공개 가능 일반 질문 bank는 career-os 루트의 `public/question-bank/` 아래에 둔다.
- `public/question-bank/`는 git 추적 대상이며 private 지원/면접 맥락을 포함하지 않는다.
- 기본 하위 범위는 다음과 같다.
  - `java-spring/`
  - `database/`
  - `cs/`
  - `operations/`
  - `system-design/`
- 질문 bank 항목은 단순 암기 질문을 그대로 저장하지 않고 backend 실무형 질문으로 정규화한다.
- 질문 항목은 최소한 category, difficulty, question, intent, answerSignals, source, publicSafe, positionFitHint, normalizedFrom을 가진다.
- private 포지션 맞춤 질문은 `private/<company>/<position>/interview/prep.md`에 선별 반영한다.
  `public/question-bank`의 일반 질문이 private 답변/회사 맥락을 포함해서는 안 된다.
- 공개 글 형태로 발행할 때만 `sources/fos-study/`로 복사 또는 재작성한다.
  `public/question-bank`는 공개 가능 원천이지만 자동 발행 대상은 아니다.
- `question-bank-collector` skill을 추가한다.
  OpenClaw와 Claude native workflow 모두에서 자연어 trigger가 잘 잡히도록 description에 다음 표현을 포함한다.
  - “일반 backend 질문”
  - “CS 질문 수집”
  - “면접 질문 bank”
  - “질문 뱅크 보강”
  - “약점 기반 질문 재선별”
  - “Java/Spring/DB/운영 질문 모아줘”
- 수집기는 raw 후보를 만든 뒤 normalizer가 중복 제거와 실무형 변환을 수행한다.
- 최근 7일 질문, 이미 답변이 정리된 주제, 포지션별 낮은 우선순위 주제는 선별 시 감점한다.

### 결과

- 일반 backend/CS 질문이 git 추적 가능한 공개 가능 자산으로 쌓인다.
- private 지원 맥락과 public-safe 질문 bank의 경계가 선명해진다.
- fos-study 발행은 검수된 질문/해설만 별도 초안으로 진행할 수 있다.
- OpenClaw 자연어 요청에서도 question-bank 작업을 안정적으로 라우팅할 수 있다.

### 적용

- `public/question-bank/`
- `.openclaw/workspace-career/skills/question-bank-collector/SKILL.md`
- `career-os/.claude/skills/question-bank-collector/SKILL.md`
- `docs/prd.md`
- `docs/flow.md`
- `docs/code-architecture.md`
- `docs/data-schema.md`
