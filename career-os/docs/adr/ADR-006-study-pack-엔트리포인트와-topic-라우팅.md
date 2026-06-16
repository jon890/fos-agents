## ADR-006 — Study-pack 엔트리포인트와 topic 라우팅

- Status: Partially superseded by ai-nodes ADR-002 (plan013, 2026-05-14) — run_now.sh study-pack 진입점이 /study-pack native skill로 전환. config/study-pack-topics.json 메타데이터는 유지.
- Date: 2026-04-14

### 맥락
study-pack 생성과 daily report는 목적이 다른데 같은 엔트리포인트에 섞으면 사용자 의도가 흐려진다. topic 수가 늘면 domain·경로·프롬프트 강조점을 매번 수동 입력해야 한다.

### 결정
- 별도 엔트리포인트 `run_now.sh study-pack <topic>` 추가.
- topic 메타데이터는 `config/study-pack-topics.json`에 둠.
- topic key에서 domain / 출력 경로 / topic-specific prompt append를 해석.
- 명확한 topic은 즉시 실행. 애매하면 사용자 확인.
- 별도 라우터 서비스 대신 얇은 resolver 스크립트(`resolve_study_pack_topic.py`)로 충분.

### 결과
- study-pack과 daily가 사용자 의도상 명확히 분리.
- 새 topic 추가 시 config만 늘리면 됨.
