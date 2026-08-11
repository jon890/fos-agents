## ADR-002 — workflow는 agent skill과 워크스페이스 script로 분리한다

- Status: Accepted
- Date: 2026-05-14

### 맥락

skill 본문, prompt 조립 코드, runner가 같은 절차를 반복하면 실행 도구마다 동작이 달라진다.
워크스페이스 데이터에 의존하는 helper를 저장소 공용 영역에 두면 소유권도 흐려진다.

### 결정

- workflow 정본은 `<workspace>/.claude/skills/<name>/SKILL.md`에 둔다.
- 결정론적 수집과 변환 코드는 `<workspace>/scripts/<name>/`에 둔다.
- 여러 skill이 함께 쓰더라도 워크스페이스 한정 코드는 해당 워크스페이스 안에 둔다.
- 실행 도구는 skill을 직접 읽고 수행하며 특정 agent CLI 호출을 계약으로 삼지 않는다.
- 외부 실행 환경과 전달 채널은 ADR-019의 경계를 따른다.

### 거절한 대안

- skill 본문을 실행 도구별로 복사하면 내용이 갈라진다.
- 워크스페이스 helper를 저장소 공용 영역에 모으면 격리 원칙이 약해진다.
- shell runner에 workflow 전체를 넣으면 skill과 구현이 이중화된다.

### 결과

skill은 의도와 검증 절차를 소유한다.
script는 재현 가능한 실행 코드만 소유한다.
새 실행 도구는 기존 workflow를 복사하지 않고 같은 skill을 사용할 수 있다.
