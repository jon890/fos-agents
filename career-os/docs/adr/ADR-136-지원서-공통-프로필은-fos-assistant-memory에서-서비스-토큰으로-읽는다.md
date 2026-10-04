## ADR-136: 지원서 공통 프로필은 fos-assistant Memory 에서 서비스 토큰으로 읽는다

- **status**: `accepted`
- **결정**:
  - 지원서 공통 프로필의 원본은 fos-assistant Memory 의 `identity` collection 에 있는 민감 문서 `career-application-profile` 이다. private brain 에 두지 않는다.
  - career-os 는 그 문서를 `scripts/application-profile/read_application_profile.ts` 로 읽는다. fos-assistant 의 서비스 읽기 API 를 서비스 토큰으로 부른다.
  - 연결값은 `career-os/.env` 의 `FOS_ASSISTANT_URL` 과 `FOS_ASSISTANT_SERVICE_TOKEN` 이다. collection 과 문서 키는 코드에 고정하고 설정으로 바꾸지 않는다.
  - CLI 는 본문을 저장소 밖 파일에만 쓴다. 표준 출력과 오류 메시지에는 본문과 토큰을 싣지 않는다.
  - career-os 는 공통 프로필을 쓰지 않는다. 새로 확인한 사실은 사용자에게 fos-assistant 웹 화면에서 고치라고 안내한다.
- **대체된 부분**: [ADR-132](ADR-132-스킬의-개인-맥락은-후보자-맥락-문서에서-읽고-지원서-공통-프로필만-brain에-둔다.md)의 「private brain 에는 지원서 공통 프로필만 남긴다」 조항을 대체한다. 후보자 맥락 문서에 관한 나머지 결정은 그대로다.
  [ADR-103](ADR-103-지원-준비는-단일-사용자-진입점과-내부-검증으로-제공한다.md)의 `application-form.json` 공통 프로필 스냅샷을 private brain 에서 복사한다는 조항도 대체한다. 스냅샷을 복사하고 출처와 확인일을 남기는 결정은 그대로다.
- **맥락**:
  - ADR-132 뒤로 career-os 에서 brain 을 읽는 곳은 `application-package-writer` 의 공통 프로필 조회 하나만 남았다. 그 조회는 개인 스킬 `brain-search` 가 있는 환경에서만 돌았다.
  - fos-assistant Memory 가 민감 문서를 저장할 때 암호화하고, 다른 서비스가 사용자에 묶인 서비스 토큰으로 문서를 읽기만 하는 API 를 냈다. 토큰은 받는 collection 과 collection 마다의 민감 허용을 갖는다.
  - 공통 프로필에는 연락처와 신원이 있다. ADR-131 과 ADR-132 가 이것을 커리어 Backend 의 DB 와 backup 에 복제하지 않기로 했다.
- **대안 기각**:
  - 커리어 Backend 의 후보자 맥락 문서로 옮기는 안: ADR-132 가 같은 이유로 기각했다. 연락처와 신원이 홈서버 DB 와 backup 에 평문으로 남는다.
  - brain 에 그대로 두는 안: 개인 스킬이 없는 실행 환경에서는 공통 프로필을 읽지 못한다. 원본이 fos-assistant 로 옮겨 가면 brain 판이 뒤처진다.
  - career-os 가 fos-assistant 에 쓰는 안: 서비스 토큰은 읽기 전용이다. 쓰는 길은 사람이 웹 화면에서 고치는 것 하나뿐이다.
  - 문서 키를 설정으로 받는 안: 설정 하나가 늘고, 키가 어긋나면 404 만 보여 원인을 찾기 어렵다. 들여올 때 문서 키를 이 값으로 맞춘다.
  - 본문을 표준 출력으로 내는 안: 에이전트 실행 기록과 터미널 기록에 연락처가 남는다. 저장소 밖 파일로만 내고 쓴 뒤 지운다.
- **결과**:
  - 얻는 것: 공통 프로필을 개인 스킬 없이 CLI 하나로 읽는다. 원본이 한 곳이고 판 번호(`revision`)로 어느 판을 읽었는지 남는다. 토큰이 새어도 그 토큰이 받은 collection 만 읽히고 쓰지 못한다.
  - 감당할 것: 토큰은 만료가 필수라 최대 365일마다 새로 발급해 `.env` 를 바꿔야 한다. CLI 는 응답의 만료 시각을 함께 낸다. fos-assistant 에 닿지 못하면 공통 프로필 없이 지원서 입력을 준비하지 않고 멈춘다. 이전에 만든 `application-form.json` 은 옛 `profileSource` 값을 담고 있어 schema 가 그 값을 읽기 전용으로 받는다.
- **적용 범위**: `scripts/application-profile/`, `.claude/skills/application-package-writer/`, `scripts/candidate-context/skill_boundary.test.ts`, `.env.example`, `AGENTS.md`, `README.md`, `docs/`.
