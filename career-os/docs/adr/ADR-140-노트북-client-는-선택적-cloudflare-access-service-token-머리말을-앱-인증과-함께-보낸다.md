## ADR-140: 노트북 client 는 선택적 Cloudflare Access service token 머리말을 앱 인증과 함께 보낸다

- **status**: `accepted`
- **결정**:
  - 커리어 Backend 와 fos-assistant 를 부르는 career-os client 는 Access 환경값이 있을 때 `CF-Access-Client-Id`, `CF-Access-Client-Secret` 머리말을 Bearer 인증과 함께 보낸다.
  - 두 서비스는 서로 다른 Access application 이므로 환경 변수를 따로 둔다. `CAREER_BACKEND_ACCESS_CLIENT_ID`, `CAREER_BACKEND_ACCESS_CLIENT_SECRET` 과 `FOS_ASSISTANT_ACCESS_CLIENT_ID`, `FOS_ASSISTANT_ACCESS_CLIENT_SECRET` 이다.
  - secret 은 `*_FILE` 로도 받는다. 파일 규칙은 Backend token 과 같다(mode 600, 직접 값과 파일 중 정확히 하나).
  - ID 와 secret 이 모두 없으면 머리말을 보내지 않는다. 하나만 있으면 요청 전에 설정 오류로 실패한다.
  - 값은 로그, 오류 메시지와 테스트 출력에 싣지 않는다. 오류는 변수 이름만 말한다.
  - fos-career plugin 은 fos-assistant 안의 내부망에서 돌아 이 결정에서 제외한다.
- **맥락**: 두 서비스 읽기 API 를 Cloudflare Tunnel 과 Access(service token 정책)로 공개한다. 노트북의 client 는 Access 를 통과해야 앱 인증까지 닿는다. 내부망과 터널 직접 경로에서는 Access 값이 없어도 그대로 동작해야 한다.
- **대안 기각**:
  - 변수 하나로 두 서비스를 함께 처리: 두 Access application 이 서로 다른 service token 을 쓸 수 있어 한쪽 교체가 다른 쪽을 깬다.
  - 값이 없으면 실패: 내부망 사용과 기존 테스트, launchd 설정이 깨진다.
  - plugin 에도 같은 변수를 붙임: plugin 은 내부망에서 돌아 불필요하고, 열린 plugin 2단계 작업과 파일이 겹친다. 필요해지면 후속으로 `plugin/src/backend.ts` 와 `connector.json` 의 `operator_env` 를 함께 고친다.
- **결과**:
  - 얻는 것: Access 뒤 서비스를 노트북에서 부를 수 있고, 값 없는 환경은 영향이 없다.
  - 감당할 것: 새 환경 변수 여섯 개(secret 파일 변형 포함)를 `.env` 에서 유지해야 한다. 한쪽만 채우면 실패한다.
