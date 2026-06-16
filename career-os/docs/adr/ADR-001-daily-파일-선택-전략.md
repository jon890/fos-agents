## ADR-001 — Daily 파일 선택 전략

- Status: 결정됨
- Date: 2026-04-13

### 맥락
`run_daily.sh`는 설계상 매일 3-5개 고가치 파일만 분석해야 했지만, `build_target_file_list.py`가 `database/`, `architecture/`, `java/`, `interview/` 전체를 긁어 70+개 파일을 생성하고 있었다. 의도와 구현이 어긋난 상태.

### 결정
- `config/topic-file-map.json`에 토픽 → 파일 목록 매핑 관리.
- `run_daily.sh`는 `DAILY_TOPIC` env 또는 `run_now.sh` 두 번째 인자로 토픽을 받는다.
- 토픽 미지정 시 `config/study-progress.json`에서 `last_studied`가 가장 오래된 약점 토픽 자동 선택.
- 토픽 매핑이 없으면 기존 INCLUDE_DIRS로 후퇴.

### 결과
- daily 분석 범위가 실제로 3-5개로 축소 → 토큰 비용 절감.
- 새 토픽은 config 한 곳만 수정.
- 자동 토픽 선택으로 중복 학습 방지 ([[ADR-002]] 의존).
