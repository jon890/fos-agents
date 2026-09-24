## ADR-126: 읽을거리 소스 목록은 Backend가 원본을 가진다

- **status**: `accepted`
- **결정**: `study-topic-recommender` 가 수집할 외부 소스 목록의 원본을 `config/external-reading-sources.ts` 에서 `fos_career.study_sources` 로 옮긴다. 사람은 `manage_reading_sources.ts` 로 소스를 더하고 고치고 끄며, 이 명령이 `PUT /api/study/v1/sources/{sourceKey}` 를 부른다. 무엇을 왜 바꿨는지는 `note` 칸에 남긴다. 이관이 끝나면 config 파일을 지운다.
- **맥락**: 소스 목록은 310줄짜리 TypeScript 파일이고 활성 소스가 35개다. 지금은 손으로 고치고 커밋한다. `manage_reading_sources.ts` 는 읽기만 한다. 이 구조에서는 매일 도는 cron 이 한 소스에서 계속 실패해도 그 소스를 끄려면 커밋하고 홈서버 작업본에 반영해야 한다. 그리고 공부 주제의 자료와 추천 이력이 `fos_career` 로 가면서 소스는 그 자료의 부모 행이 된다. `study_materials` 와 `study_source_cursors` 가 `source_key` 로 소스를 가리키는데, 부모가 파일에 있고 자식이 DB 에 있으면 파일에서 지운 소스를 DB 가 모른다. client 에는 config 를 DB 로 밀어 넣는 `study-library/source-sync.ts` 가 이미 있었다. 원본을 둘로 두고 한쪽에서 다른 쪽으로 복사하는 구조다.
- **대안 기각**:
  - config 를 원본으로 두고 DB 로 동기화하는 안은 기각했다. `source-sync.ts` 가 이미 그렇게 설계돼 있고, 어떤 소스를 왜 넣었는지 커밋 이력에 남는 장점이 있다. 하지만 소스를 끄는 데 커밋과 배포가 필요하다는 문제가 그대로 남고, 동기화가 한 번 빠지면 두 원본이 어긋난다.
  - DB 에 두되 편집 명령 없이 SQL 로 고치는 안은 기각했다. [ADR-118](ADR-118-추천-상태는-career-os-api와-mysql이-관리한다.md)이 수집기와 skill 은 DB 에 직접 연결하지 않는다고 정했다. 사람도 같은 경계를 지킨다.
- **결과**:
  - 얻는 것: 실패하는 소스를 커밋 없이 끈다. 소스와 자료가 같은 저장소에 있어 부모 없는 자료가 생기지 않는다. 원본이 하나다.
  - 감당할 것: 소스를 왜 넣었는지가 커밋 메시지 대신 `note` 칸에 남는다. `note` 는 한 번 쓰면 이전 값이 사라지므로 커밋 이력만큼의 추적은 되지 않는다. 필요해지면 변경 이력 table 을 따로 둔다. 소스를 고치려면 Backend 가 떠 있어야 한다. `config/` 에서 파일 하나가 빠지지만 `career-os/CLAUDE.md` 의 「사람이 고른 정책, pin, override, 제외 조건만 둔다」 는 그대로 맞다. `.claude/planning-overlay.md` 의 「설정에 현재 외부 목록을 고정하지 않는다」 에도 맞는다.
- **적용 범위**: `services/recommendation-api/src/study/`, `scripts/study-topic-recommender/manage_reading_sources.ts`, `scripts/study-topic-recommender/study-library/source-sync.ts` 삭제, `config/external-reading-sources.ts` 삭제, `docs/data-schema.md`, `docs/flow.md`. archive 수집 진입점을 소스별로 정하는 `source/archive/registry.ts` 는 코드에 남는다. 그것은 소스 목록이 아니라 수집 방식이다.
