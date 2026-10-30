## ADR-143: Claude Code 의 fos-career MCP 서버는 선택적 Cloudflare Access 머리말을 보낸다

- **status**: `accepted`
- **결정**:
  - **fos-career MCP 서버도 Access 환경값이 있으면 `CF-Access-Client-Id`, `CF-Access-Client-Secret` 머리말을 Bearer 인증과 함께 보낸다.** [ADR-140](ADR-140-노트북-client-는-선택적-cloudflare-access-service-token-머리말을-앱-인증과-함께-보낸다.md) 이 plugin 을 제외한 부분을 이 결정으로 바꾼다.
  - 변수는 노트북 client 와 같은 `CAREER_BACKEND_ACCESS_CLIENT_ID`, `CAREER_BACKEND_ACCESS_CLIENT_SECRET` 이다. `connector.json` 의 `operator_env` 와 `.mcp.json` 의 env 에 함께 둔다. `.mcp.json` 은 빈 기본값(`:-`)으로 참조해 값이 없는 환경에서도 서버가 시작한다.
  - **secret 은 값으로만 받는다.** `*_SECRET_FILE` 은 받지 않는다. MCP 번들은 파일을 읽지 않는다는 규칙이 있어 `scripts/lib/access-credentials.ts` 를 재사용하지 않고 `plugin/src/server.ts` 에서 같은 규칙(둘 다 있거나 둘 다 없음, 출력 가능한 ASCII 한 단어)만 다시 검사한다.
  - 둘 다 없거나 치환되지 않은 변수 참조면 머리말을 보내지 않는다. 하나만 있거나 모양이 틀리면 서버가 `CAREER_CONFIG` 로 시작하지 않는다. 값은 오류에 싣지 않는다.
- **맥락**:
  - ADR-140 은 plugin 이 fos-assistant 내부망에서만 돈다고 보고 제외했다. ADR-139 이후 Claude Code 전용 스킬(`sync-profile` 등)은 노트북에서 plugin 의 MCP 도구로 Backend 를 부른다.
  - 2026-10 실측으로 Access 머리말 없이 부른 요청은 Cloudflare 가 403 으로 막았고, 서버는 이를 `CAREER_UNAUTHORIZED` 로 알려 token 문제처럼 보였다. 머리말을 붙이면 Backend 까지 닿았다.
- **대안 기각**:
  - 공용 `resolveAccessCredentials` 를 그대로 import 한다: 규칙이 한 곳에 있다. 그러나 `_FILE` 처리 때문에 번들에 `readFileSync` 가 들어가 「번들은 파일을 읽지 않는다」 는 검사를 깬다.
  - `.mcp.json` 에만 두고 `operator_env` 에는 두지 않는다: fos-assistant 에 영향이 없다. 그러나 `.mcp.json` env 와 `fields[].env`, `operator_env` 의 합이 같아야 한다는 설치 계약을 깨 커넥터가 카탈로그에서 빠진다.
- **결과**:
  - 얻는 것: Claude Code 에서 plugin 을 설치하면 Access 뒤 Backend 를 MCP 도구로 부를 수 있다. 값이 없는 fos-assistant 내부망 환경은 동작이 같다.
  - 감당할 것: manifest 가 바뀌어 fos-assistant 의 기존 바인딩을 다시 승인해야 한다. secret 을 파일로 줄 수 없어 Claude Code 설정의 `env` 에 값으로 둔다.
