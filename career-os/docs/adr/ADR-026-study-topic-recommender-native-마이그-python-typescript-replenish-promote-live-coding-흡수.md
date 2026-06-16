## ADR-026 — study-topic-recommender native 마이그 + Python → TypeScript + replenish/promote/live-coding 흡수

**Status**: Accepted
**Date**: 2026-05-15

### 맥락

study-pack-writer(plan013), interview-asset-writer(plan015)는 native skill로 전환됐지만,
study-topic-recommender만 옛 외부 subprocess 패턴(622줄 Python 알고리즘 + 외부 RSS 의존)이 남아 있었다.
topic-pool-replenisher 폐기로 replenish + promote 자동화가 끊어진 갭도 있었다.
사용자 의도는 단일 진입점 호출 시마다 replenish + recommend + promote를 자동 처리하는 것이다.

### 결정

- **Python → TypeScript 마이그**: `refresh_topic_inventory.py` + `feed_discovery.py`를 TypeScript로 전환한다. 알고리즘 결정론 동등 동작을 위해 양쪽 출력 diff=0 검증 phase를 둔다.
- **native skill 통합**: SKILL.md를 TypeScript 호출 + Claude 자연어 추론 hybrid로 구성하고, replenish + recommend + promote 3 흐름을 한 호출로 자동 처리한다.
- **live-coding seed pool 흡수**: 별도 파일과 dispatcher case를 study-topic-recommender 안으로 통합한다.
- **dispatcher case 폐기**: recommend-topics + live-coding-dispatch case를 폐기하고 진입점을 단일로 통합한다.

### 거절한 대안

- Python 그대로 + Bash wrapper만: 모노레포 TypeScript 표준([[ADR-020]]/022) 위반.
- Python 폐기 + Claude 자연어로 알고리즘 전부 추론: 점수·mix target 결정론 손실.
- skill rename: rename 파급 비용 대비 의미 명확성 향상이 불충분.

### 결과

- dispatcher case 7 → 4로 줄고 사용자 진입점이 단일 native invoke로 단순화된다.
- replenish + recommend + promote + live-coding seed 선택을 한 호출로 처리한다.
- Python script 3개 폐기, fast-xml-parser 의존 추가, 알고리즘 결정론 유지.
