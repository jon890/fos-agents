## ADR-137: 스킬과 MCP 를 plugin 하나로 묶고 세 단계로 옮긴다

- **status**: `accepted`
- **결정**:
  - career-os 의 스킬과 커리어 Backend 를 잇는 MCP 서버를 plugin 하나(`fos-career`)로 묶는다.
    Claude Code 와 fos-assistant 가 같은 plugin 을 쓴다.
    다른 사람도 그 plugin 과 자기 Backend 로 자기만의 career agent 를 갖는다.
  - **plugin 은 세 층이다.**
    MCP 서버는 데이터 접근(커리어 Backend, GitHub)만 맡는다.
    스킬은 판단 흐름을 담고, 데이터는 MCP 도구로 읽고 쓰며 저장소 경로를 가리키지 않는다.
    로컬 실행기(외부 자료 수집기, PDF 출력, 브라우저 조작)는 plugin 안에 두고 Claude Code 에서만 돈다.
  - 쓰기 도구는 모두 승인이 필요하다(`approval: "required"`). 읽기 도구는 승인 없이 돈다(`none`). [ADR-135](ADR-135-fos-assistant-커넥터는-backend를-감싸고-숫자는-기록에서-직접-읽는다.md)의 규칙을 그대로 넓힌다.
  - **세 단계로 옮긴다.**
    1. Backend 만 쓰는 `interview-practice` 와 `study-topic-recommender` 를 plugin 스킬로 옮기고, 두 스킬이 쓰는 Backend 읽기와 쓰기를 MCP 도구로 연다.
    2. 나머지 스킬(`position-recommender`, `resume-preparer`, `application-package-writer`, `sync-profile`)과 로컬 실행기를 plugin 에 넣는다. 로컬 실행이 필요한 단계는 Claude Code 에서만 돈다고 스킬에 적는다.
    3. career-os 를 별도 공개 저장소로 떼어 내 plugin marketplace 로 배포한다.
  - **Backend 는 사람마다 직접 띄운다.** 커리어 Backend 와 MySQL 을 docker compose 하나로 띄운다. 로컬 파일 모드를 두지 않는다.
  - 개인 값과 개인 인프라(비공개 작업본 동기화, 홈서버)는 저장소에 넣지 않고 설정으로만 들어간다.
  - **옮기는 동안 저장소 스킬과 plugin 스킬이 함께 있다.**
    저장소를 연 Claude Code 세션은 `career-os/.claude/skills/` 의 스킬을 계속 쓴다.
    1단계는 저장소 스킬을 고치지 않는다. 저장소 스킬만 하는 일(공고별 질문, 질문 은행 보강, 자료 수집, HTML 리포트, 외부 게시)은 2단계에서 plugin 의 로컬 실행기로 옮긴다.
    2단계가 끝나 Claude Code 에서 plugin 을 설치해 같은 일을 할 수 있게 되면 저장소 쪽 사본을 지운다.
- **맥락**:
  - 지금은 스킬이 저장소 경로의 스크립트를 부른다. 저장소를 연 노트북 세션에서만 돈다.
  - fos-assistant 의 커넥터 에이전트는 셸과 파일 도구가 없고 MCP 도구만 부른다. 같은 판단을 대화에서 쓰려면 데이터 접근이 도구여야 한다.
  - 커넥터 스킬 본문은 plugin 의 모든 `SKILL.md` 를 합쳐 8,000자까지다. 승인이 필요한 호출의 인자는 UTF-8 16KB 까지다. 스킬은 짧아야 하고 쓰기 인자는 사람이 승인 카드에서 읽을 크기여야 한다.
  - 면접 연습 기록, 개인 질문, 공부 추천 상태, 후보자 맥락은 이미 Backend 가 소유한다([ADR-129](ADR-129-면접-연습-기록과-개인-질문은-backend가-소유한다.md), [ADR-131](ADR-131-후보자-맥락은-backend-문서로-두고-공부-추천-기준-버전을-문서-버전에서-계산한다.md)). 두 스킬은 Backend 도구만 있으면 판단 흐름을 옮길 수 있다.
- **대안 기각**:
  - 스킬과 MCP 서버를 다른 배포 단위로 둔다: 각자 판을 올릴 수 있다. 그러나 도구 이름과 스킬 문장이 따로 바뀌어 어긋나고, 설치하는 사람이 둘을 맞춰야 한다.
  - 한 번에 모두 옮긴다: 이행 기간이 짧다. 그러나 로컬 실행기와 Claude Code 전용 단계의 경계를 한 변경에서 정해야 해 검토할 수 없는 크기가 된다.
  - 로컬 파일 저장소 모드를 남겨 Backend 없이도 쓰게 한다: 시작이 쉽다. 그러나 두 저장소 구현의 동작을 계속 맞춰야 하고 fos-assistant 에서는 쓸 수 없다. docker compose 하나로 Backend 를 띄우는 비용이 더 작다.
  - MCP 서버가 판단(질문 채점, 추천 선택)까지 한다: 도구 호출이 줄어든다. 그러나 판단을 바꿀 때마다 번들을 다시 배포해야 하고, 모델이 원문을 읽고 판단하는 이점을 잃는다.
- **결과**:
  - 얻는 것: 같은 스킬을 노트북과 fos-assistant 에서 쓴다. 3단계 뒤에는 다른 사람이 plugin 을 설치하고 자기 Backend 를 띄워 같은 agent 를 갖는다.
  - 감당할 것: 이행 기간에는 같은 스킬이 저장소와 plugin 에 두 벌 있고, 판단 규칙을 고칠 때 둘을 함께 고친다. MCP 서버는 단일 번들이라 공개 질문 은행이나 공유 함수를 바꾸면 번들을 다시 만들어 커밋한다. 쓰기 하나마다 fos-assistant 에서 승인 카드가 하나씩 생긴다.
