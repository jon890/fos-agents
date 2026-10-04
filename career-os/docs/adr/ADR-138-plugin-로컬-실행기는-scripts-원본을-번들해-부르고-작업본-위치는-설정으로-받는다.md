## ADR-138: plugin 로컬 실행기는 scripts 원본을 번들해 부르고 작업본 위치는 설정으로 받는다

- **status**: `accepted`
- **결정**:
  - **로컬 실행기의 원본은 `career-os/scripts/` 에 그대로 둔다.**
    plugin 빌드가 의존성을 포함하고 하위 명령으로 실행기를 고르는 실행 파일 하나(`plugin/dist/career-local.js`)를 만들고, 소스를 고친 사람이 함께 커밋한다.
    plugin 스킬은 `bun "${CLAUDE_PLUGIN_ROOT}/dist/career-local.js" <실행기> ...` 로 부른다.
  - 실행기는 실행 파일 옆의 파일을 런타임에 찾지 않는다. HTML 과 CSS 템플릿은 텍스트 import 로 번들에 넣는다.
  - **연결값은 셸 환경 변수로만 받는다.** 실행기는 MCP 서버와 같은 `CAREER_BACKEND_URL`, `CAREER_BACKEND_TOKEN` 을 읽고 `.env` 를 탐색하지 않는다.
  - **비공개 작업본(`applications/`, `library/`, `state/`)의 위치는 `CAREER_WORKSPACE_ROOT` 로 받는다.** 없으면 `~/.fos-career/workspace` 다.
  - **홈서버 동기화는 설정이 있을 때만 켜진다.** `CAREER_WORKSPACE_COMMAND` 나 `CAREER_WORKSPACE_SSH_TARGET` 이 있으면 지금의 release 동기화를 거치고, 둘 다 없으면 작업본 디렉터리만 쓴다.
  - 개인 식별 정보가 담긴 자산(이력서의 회사와 학교 로고)은 번들에 넣지 않고 작업본 `library/` 에서 읽는다.
- **맥락**:
  - [ADR-137](ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md) 의 2단계는 외부 자료 수집기, PDF 출력, 브라우저 조작을 plugin 에 넣고 Claude Code 에서만 돌게 한다.
  - plugin 을 설치한 곳에는 저장소가 없다. 실행기가 저장소 루트를 cwd 로 가정하거나 `import.meta.dir` 기준으로 템플릿과 작업본을 찾으면 설치한 곳에서 실패한다.
  - Claude Code 는 `${CLAUDE_PLUGIN_ROOT}` 를 `SKILL.md` 본문에서만 치환한다. Bash 로 띄운 프로세스에는 그 값도, MCP 서버에 넘긴 env 도 전달되지 않는다.
  - 공고 수집은 공고 수백 건을 Backend 에 올린다. 이 쓰기를 MCP 도구 인자로 넘기면 모델 맥락을 그만큼 쓴다. 그래서 실행기가 Backend 를 직접 부른다.
  - 3단계에서 career-os 가 별도 공개 저장소가 된다. 다른 사람은 홈서버가 없고, 개인 인프라는 설정으로만 들어가야 한다.
- **대안 기각**:
  - 실행기마다 실행 파일을 따로 만든다: 실행기 하나만 고쳐도 다른 파일은 그대로다. 그러나 `zod` 와 Backend client 가 파일마다 한 벌씩 들어가 커밋하는 번들이 실행기 수만큼 커진다.
  - 실행기 소스를 `plugin/` 아래로 옮긴다: 번들 없이 소스로 실행할 수 있다. 그러나 저장소의 테스트와 Backend 대조 테스트가 같은 코드를 두 경로에서 import 하게 되고, `plugin/` 에 루트 의존성을 다시 설치해야 한다.
  - 실행기를 `plugin/bin/` 에 두어 PATH 로 부른다: 명령이 짧아진다. 그러나 claude.ai 와 Cowork 는 `bin/` 이 있는 plugin 을 설치하지 않는다.
  - 작업본 기본 위치를 `${CLAUDE_PLUGIN_DATA}` 로 둔다: 설정 없이 plugin 전용 경로가 생긴다. 그러나 plugin 을 지우면 그 디렉터리도 지워져 지원 문서가 함께 사라진다.
  - plugin `userConfig` 로 token 을 받는다: 설정 화면이 생긴다. 그러나 민감 값은 스킬 본문과 Bash 에 전달되지 않아 실행기가 읽을 수 없다.
- **결과**:
  - 얻는 것: 저장소 노트북과 plugin 이 같은 실행기 코드를 쓴다. 설치한 곳에 저장소와 `bun install` 이 없어도 실행기가 돈다. 홈서버가 없는 사람도 같은 스킬을 쓴다.
  - 감당할 것: `scripts/` 의 실행기 코드를 고치면 plugin 빌드를 다시 돌려 번들을 함께 커밋한다. 번들은 루트 `bun.lock` 이 고정한 의존성으로 만든다. 설치한 사람은 셸 환경 변수에 연결값을 둔다.
