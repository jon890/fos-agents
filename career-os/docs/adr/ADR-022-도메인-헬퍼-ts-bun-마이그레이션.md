## ADR-022 — 도메인 헬퍼 TS(Bun) 마이그레이션

- Status: Accepted
- Date: 2026-05-14

### 맥락

plan004([[ADR-020]])가 공용 헬퍼만 TS로 옮긴 결과, 도메인 헬퍼(extractor / renderer / resolver / Claude subprocess wrapper)는 Python 잔존. 공용은 TS, 도메인은 Python인 비대칭이 새 작업마다 위치·언어 결정 부담을 만든다. plan004 사이클에 흡수됐어야 할 `_shared/bin/extract_claude_result.py`도 사각지대로 남아 다수 runner가 여전히 `python3`로 직접 호출 중.

### 결정

도메인 헬퍼를 [[ADR-020]] 정책 그대로 TS로 마이그레이션. skill-specific 자산은 [[ADR-019]] 컨벤션대로 `scripts/<skill>/` 아래, 다중 skill 공유 코어만 `_shared/lib/`. 본 plan 범위는 extractor·renderer·resolver·Claude-subprocess 9개 + `_shared/bin/extract_claude_result.py` 정리로 한정.

거절한 대안:
- 모든 Python을 한 plan에: 작업량 과대 + 실패 위험.
- 모두 `_shared/lib/`에 평면 배치: skill-specific 검증 로직이 공용 영역에 들어가면 도메인 응집도 깨짐.
- Python 유지 + TS wrapper: ADR-020의 shim 보존 금지 원칙 위배.

### 결과

- 도메인 헬퍼가 TS로 일관됨. `_shared/bin/`이 트래커·artifacts 갱신 외 자산만 남음.
- 미마이그레이션 Python(데이터 수집 · 진행 추적 · inventory refresh 등)은 별도 plan 대상 — 한 사이클당 변화 범위 통제.
- 단점: caller가 한 사이클에 일괄 갱신돼야 일관 상태 — 부분 마이그레이션 금지.

### 적용

- 이전 phase 명세는 `tasks/plan008-extractor-renderer-ts/`.
- depends_on: [[ADR-020]](plan004), [[ADR-019]](plan006), [[ADR-021]](plan007).
