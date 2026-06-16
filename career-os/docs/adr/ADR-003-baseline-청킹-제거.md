## ADR-003 — Baseline 청킹 제거

- Status: 결정됨
- Date: 2026-04-13

### 맥락
`run_baseline.sh`가 10개 파일을 5개씩 2청크로 나눠 Claude를 3번 호출(chunk1 → chunk2 → merge). 10개는 한 컨텍스트에 충분히 들어가므로 3배 비용·레이턴시 + merge 시 희석 위험.

### 결정
baseline은 단일 Claude 호출. 25개 이상으로 늘어나는 시점에 청킹 재도입 검토.

### 결과
- 비용 약 60% 절감 (3 호출 → 1 호출).
- 결과 디렉터리에 `target-files.txt`, `analysis-input.md`, `claude.result.json`, `report.md`만 남아 깔끔.
