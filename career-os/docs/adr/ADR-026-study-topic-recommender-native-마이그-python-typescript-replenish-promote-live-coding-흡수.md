## ADR-026 — study-topic-recommender native 마이그 + Python → TypeScript + replenish/promote/live-coding 흡수

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

plan013 (ai-nodes ADR-002)에서 study-pack-writer가 native skill 패턴으로 전환. plan014에서 maintainer + batch 폐기·흡수, plan015에서 master + qbank가 interview-asset-writer로 통합되고 topic-pool-replenisher가 폐기됐다. study-topic-recommender만 옛 외부 subprocess 패턴이 남아 있다 — 622줄 Python 점수 알고리즘(`refresh_topic_inventory.py` — [[ADR-009]]/010/012/013) + 외부 RSS 의존(`feed_discovery.py`). dispatcher case 3개 (recommend-topics + live-coding-dispatch + 이미 plan015 폐기된 replenish-topics)도 함께 native 진입점으로 정리해야 일관.

또한 topic-pool-replenisher 폐기로 *replenish + promote 자동화*가 끊어진 갭이 있다. 사용자 의도는 `claude -p "/study-topic-recommender"` 한 진입점이 호출 시마다 *replenish + recommend + promote* 모두 자동 처리. 트리거 시점 정책은 openclaw 스케줄러 책임.

### 결정

다음 묶음으로 처리:

1. **Python → TypeScript 마이그**: `refresh_topic_inventory.py` (622줄) + `feed_discovery.py` → ts. fast-xml-parser 의존 추가 (RSS XML 파싱). 알고리즘([[ADR-009]]/010/012/013) 결정론 동등 동작 보장 — Python·ts 양쪽 실행 후 출력 diff = 0 검증 phase.
2. **native skill 명세**: SKILL.md를 Bash 도구로 ts 호출 + Claude 자연어 추론 hybrid. replenish + recommend + promote 3 흐름 모두 SKILL.md 안에서 자동 진행. 호출 시마다 항상 실행 (feed-cache로 RSS 부담 완화).
3. **replenish/promote 흡수**: 옛 topic-pool-replenisher의 두 Python 의도 (replenish + promote)를 study-topic-recommender 안으로. promote는 *fos-study commit 확인 후 candidate → primary 자동 detect*.
4. **live-coding seed pool 흡수**: live-coding-seed-pool.json + seed-candidates.json + run_live_coding_dispatch.sh의 의도를 study-topic-recommender 안으로 통합. 자연어 "live-coding 1개 골라줘" 시 처리.
5. **dispatcher 3 case 폐기**: recommend-topics + live-coding-dispatch + (plan015 폐기된) replenish-topics 모두 폐기. 진입점 `claude -p "/study-topic-recommender"` 단일.

### 거절한 대안

- Python 그대로 + Bash wrapper만: 모노레포 일관성([[ADR-020]]/022, _shared/lib ts 표준) 위반.
- Python 폐기 + Claude 자연어로 알고리즘 전부 추론: 점수·mix target 결정론 손실.
- skill rename (topic-curator 등): rename 파급비 vs 의미 명확성 trade-off에서 rename 가치 부족.

### 결과

- skill 8 → 8 유지 (study-topic-recommender는 *통합 강화*, 폐기 없음)
- dispatcher case 7 → 4 (recommend-topics + live-coding-dispatch 2 case 폐기)
- Python script 3개 폐기 (refresh_topic_inventory.py / feed_discovery.py / 이미 폐기된 replenisher 2 Python)
- 새 의존성: fast-xml-parser
- 알고리즘 결정론 유지 (입출력 동등 검증 phase)
- 사용자 진입점 단순화: 옛 3 dispatcher case → 1 native invoke
- 자동 흐름 통합: replenish + recommend + promote + (필요 시) live-coding seed 선택 모두 한 호출

### 적용

`tasks/plan016-study-topic-recommender-native/`. depends_on: plan013([[ADR-002]]) + plan015. common-pitfalls 6-6 회피: draft 별도 파일 + commit 개수 self-check phase. 6-7 자동 적용: 현재 references/ 부재라 위험 없음.
