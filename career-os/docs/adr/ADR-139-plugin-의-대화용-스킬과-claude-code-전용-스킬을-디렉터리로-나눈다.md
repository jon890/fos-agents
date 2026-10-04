## ADR-139: plugin 의 대화용 스킬과 Claude Code 전용 스킬을 디렉터리로 나눈다

- **status**: `accepted`
- **결정**:
  - **MCP 도구만 쓰는 대화용 스킬은 `plugin/connector-skills/` 에 둔다.** `plugin.json` 의 `skills` 가 이 디렉터리 하나를 가리킨다.
    fos-assistant 는 이 디렉터리의 `SKILL.md` 만 합쳐 연결용 에이전트의 지침으로 쓴다.
  - **로컬 실행기를 부르는 스킬은 `plugin/skills/` 에 둔다.** Claude Code 는 이 기본 디렉터리와 `connector-skills/` 를 모두 읽는다.
    이 스킬은 Claude Code 에서만 돈다고 본문 첫머리에 적는다.
  - 두 디렉터리에 같은 이름의 스킬을 두지 않는다. Claude Code 에서는 두 디렉터리가 한 plugin 의 스킬로 함께 보이기 때문이다.
  - **저장소 사본은 그 스킬을 쓰는 실행 환경이 모두 plugin 으로 옮긴 뒤 지운다.**
    홈서버 Hermes 는 `.claude/skills/` 를 스킬 디렉터리로 읽고 `${CLAUDE_PLUGIN_ROOT}` 를 치환하지 않는다.
    그래서 Hermes 예약 실행이 쓰는 `position-recommender` 와 `study-topic-recommender` 의 저장소 사본은 그 실행을 plugin 으로 바꾼 뒤 지운다.
    아직 plugin 으로 옮기지 않은 스킬이 import 하거나 링크하는 사본도 그 스킬을 옮길 때 지운다.
    [ADR-137](ADR-137-스킬과-mcp를-plugin-하나로-묶고-세-단계로-옮긴다.md) 의 「2단계가 끝나면 저장소 쪽 사본을 지운다」 는 이 조건으로 읽는다.
  - **공개 질문 은행 보강은 plugin 으로 옮기지 않고 저장소 유지 절차로 남긴다.** 절차는 `public/question-bank/MAINTENANCE.md` 가 갖는다.
    plugin 을 설치한 사람은 이 저장소에 커밋하지 않으므로, plugin 스킬은 외부 자료에서 찾은 질문을 개인 질문으로 Backend 에 저장한다.
    ADR-137 이 2단계로 옮긴다고 적은 「질문 은행 보강」 은 이 조건으로 읽는다.
  - 저장소의 `interview-practice` 사본은 지웠다. 대화 연습은 `connector-skills/interview-practice/`, 공고별 질문 연습과 외부 자료 수집은 `skills/interview-question-prep/` 가 맡는다.
    [ADR-066](ADR-066-공개-가능-일반-면접-질문-bank는-public-question-bank에-둔다.md), [ADR-129](ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md), [ADR-130](ADR-130-면접-연습의-후보자-맥락은-memory-공급자-경계로-읽는다.md), [ADR-132](ADR-132-스킬의-개인-맥락은-후보자-맥락-문서에서-읽고-지원서-공통-프로필만-brain에-둔다.md) 가 가리키는 `.claude/skills/interview-practice/` 는 이 두 경로로 읽는다.
- **맥락**:
  - fos-assistant 는 `plugin.json` 의 `skills`(없으면 `./skills`) 아래 `SKILL.md` 본문을 이름 순으로 합쳐 8,000자까지 받는다. 넘으면 커넥터가 카탈로그에서 빠진다.
  - 1단계를 마친 뒤 대화용 스킬 셋의 본문이 약 5,900자다. 공고 추천, 이력서, 프로필 동기화 스킬을 같은 디렉터리에 더하면 상한을 넘는다.
  - fos-assistant 의 연결용 에이전트에는 셸이 없다. 로컬 실행기를 부르는 지침은 그 에이전트가 따를 수 없는 문장이다.
  - Claude Code 는 `plugin.json` 의 `skills` 경로를 기본 `skills/` 에 더해 읽는다. 다른 구성 요소와 달리 기본 디렉터리를 대신하지 않는다.
- **대안 기각**:
  - 모든 스킬을 `skills/` 에 두고 Claude Code 전용 스킬은 짧은 안내만 둔다: 디렉터리가 하나다. 그러나 남은 예산이 약 2,100자라 스킬 셋을 담기 어렵고, 연결용 에이전트 지침에 쓸 수 없는 안내가 섞인다.
  - Claude Code 전용 스킬을 별도 plugin 으로 나눈다: 지침 예산이 완전히 갈린다. 그러나 MCP 도구 이름과 스킬 문장을 두 배포 단위에서 맞춰야 한다. ADR-137 이 한 plugin 으로 묶은 이유와 어긋난다.
  - fos-assistant 가 앞머리 표시로 스킬을 고르게 바꾼다: 디렉터리를 나누지 않아도 된다. 그러나 다른 저장소의 커넥터 계약을 바꿔야 하고, 표시를 빠뜨린 스킬이 조용히 지침에 섞인다.
- **결과**:
  - 얻는 것: 연결용 에이전트 지침 예산을 대화용 스킬만 쓴다. Claude Code 전용 스킬은 예산과 무관하게 판단 흐름을 담는다.
  - 감당할 것: 디렉터리를 옮긴 버전을 배포하면 fos-assistant 에 커넥터를 다시 등록해야 한다. 같은 판단 규칙이 대화용 스킬과 Claude Code 전용 스킬에 함께 있으면 둘을 함께 고친다. 저장소 사본이 남은 동안에는 그 사본도 함께 고친다.
