## ADR-144: Claude Code 전용 Access 값은 커넥터 선언에 두지 않고 실행 환경에서 받는다

- **status**: `accepted`
- **결정**:
  - **`CAREER_BACKEND_ACCESS_CLIENT_ID`, `CAREER_BACKEND_ACCESS_CLIENT_SECRET` 을 `connector.json` 의 `operator_env` 와 `.mcp.json` 의 env 에서 뺀다.** [ADR-143](ADR-143-claude-code-의-fos-career-mcp-서버는-선택적-cloudflare-access-머리말을-보낸다.md) 의 선언 위치 조항을 이 결정으로 바꾼다.
  - MCP 서버는 지금처럼 두 값이 있으면 `CF-Access-Client-Id`, `CF-Access-Client-Secret` 머리말을 보내고, 둘 다 없으면 보내지 않는다. 값 검사 규칙은 ADR-143 을 그대로 따른다.
  - 노트북에서는 두 값을 셸이나 Claude Code 설정의 `env` 에 둔다. Claude Code 는 `.mcp.json` 에 적지 않은 변수도 자기 프로세스 환경째 MCP 서버에 물려준다.
- **맥락**:
  - fos-assistant 는 `operator_env` 의 이름마다 운영 목록에 값이 있어야 커넥터를 카탈로그에 올린다. 홈서버는 내부망 주소로 Backend 에 닿아 Access 값이 필요 없고 운영 목록에도 없다. 그래서 ADR-143 뒤로 fos-career 커넥터가 카탈로그에서 빠졌다.
  - 같은 검사는 `.mcp.json` env 가 `fields[].env`, `operator_env`, 주인 env 의 합과 정확히 같기를 요구하고, 빈 기본값 참조(`${X:-}`)는 선택 칸에만 허용한다. 그래서 `operator_env` 에서만 빼고 `.mcp.json` 에 남길 수는 없다.
  - 2026-11 실측으로 Claude Code 는 `.mcp.json` 에 env 를 적은 서버에도 자기 프로세스 환경을 함께 넘겼다.
- **대안 기각**:
  - 운영 목록에 Access 값을 넣는다: 카탈로그는 돌아오지만 홈서버에 쓰지 않는 비밀값이 운영 설정에 늘어난다.
  - 두 값을 선택 연결 칸(`fields`, `required: false`)으로 옮긴다: 선언 계약은 지키지만 fos-assistant 연결 화면에 홈서버에서 쓰지 않는 칸 두 개가 생긴다.
- **결과**:
  - 얻는 것: 운영 설정을 바꾸지 않고 커넥터가 카탈로그에 돌아온다. 노트북에서는 값을 둔 위치만 맞으면 동작이 같다.
  - 감당할 것: 두 값이 선언에 없어 설치 화면이나 manifest 로는 필요한지 알 수 없다. README 의 설치 안내와 `data-schema.md` 의 커넥터 환경 변수 표가 이를 알린다. manifest 가 바뀌어 fos-assistant 의 기존 바인딩을 다시 승인해야 할 수 있다.
