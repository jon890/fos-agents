## ADR-035 — ts 헬퍼 모듈 분해 컨벤션 (source / transform / render / cli 4 레이어)

- Status: Accepted
- Date: 2026-05-19

### 맥락

career-os `scripts/<skill>/` 아래 ts 헬퍼들이 단일 파일에 외부 API fetch + 필터·정규화 + markdown 렌더링 + CLI 파싱 + 파일 IO 를 모두 응집한 *god-script* 구조.

대상 5 파일 총 2106 줄 (fos-claw#1):

- `study-topic-recommender/refresh_topic_inventory.ts` 1049 (plan025 후 +190)
- `position-recommender/collect_live_postings.ts` 412
- `study-topic-recommender/feed_discovery.ts` 314
- `interview-coffeechat-prep/collect_company_sites.ts` 186 (plan026 직후라 분해 후순위)
- `study-pack-writer/run_with_discord_notify.ts` 145 (가장 작음, 선택)

확장 비용:

- 새 source (예: 새 RSS feed / 새 채용 사이트) 추가 시 한 파일 전체 수정.
- 새 출력 포맷 추가 시 같은 파일.
- 단위 테스트 진입점 부재 — 순수 함수가 IO 와 섞여 격리 어려움.

### 결정

ts 헬퍼는 4 레이어로 분리. **god-script 신규 추가 금지**, 기존도 점진 분해.

4 레이어 책임:

- **source/** — 외부 API fetch 만. source 추가 시 여기에만 새 파일.
  - 예: `source/wanted.ts`, `source/toss.ts`, `source/rss.ts`.
- **transform/** — 필터 · 정규화 · dedupe · 스코어링 같은 *순수 함수*. 단위 테스트 진입점.
  - 예: `transform/filter_server.ts`, `transform/dedupe.ts`, `transform/score.ts`.
- **render/** — 마크다운 직렬화. 출력 포맷 변경 시 여기만.
  - 예: `render/markdown.ts`, `render/discord_message.ts`.
- **cli.ts** — 인자 파싱 + 위 3 레이어 조립 + 파일 IO. 진입점.

플레이스홀더 구조:

```
career-os/scripts/<skill>/
  source/{wanted.ts, toss.ts, ...}
  transform/{filter.ts, dedupe.ts, ...}
  render/markdown.ts
  cli.ts
```

`cli.ts` 위치는 기존 god-script 진입점과 동일 path 유지 — SKILL.md / 호출부 갱신 부담 최소.

거절한 대안:

- 한 파일 안에서 함수 그룹화 (분리 없음) — 확장 시 같은 파일 계속 비대. drift 위험 영구화.
- 5 파일 한 plan 에서 일괄 분해 — 한 사이클에 2106 줄 영향. critic 누적 위험.
- `_shared/lib` 승격으로 워크스페이스 무관 헬퍼화 — `_shared/lib` 자격 (ai-nodes ADR-001) 미충족. 워크스페이스 한정 도메인 로직.

### 결과

- god-script 5 파일 점진 분해 (plan027~plan031 시리즈, 한 plan = 한 파일).
- 새 source 추가 비용 ↓ — source/ 에 새 파일 1개.
- transform 단위 테스트 가능 — 순수 함수 격리.
- SKILL.md / 호출부 변경 0 — cli.ts 가 기존 진입점 path 유지.
- 단점:
  - 파일 수 증가 — `<skill>/` 안 4 디렉터리 (source / transform / render) + cli.ts.
  - 분해 plan 시리즈 진행 비용 — 5 plan × phase 3 = 15 phase.

### 적용

- 분해 plan 시리즈:
  - plan027 — refresh_topic_inventory.ts (1049 줄) — 최대 god-script 우선.
  - plan028 — collect_live_postings.ts (412 줄) — position-recommender hot path.
  - plan029 — feed_discovery.ts (314 줄) — RSS discovery.
  - plan030 — collect_company_sites.ts (186 줄) — plan026 후 1 cycle 이상 후.
  - plan031 — run_with_discord_notify.ts (145 줄) — 선택, 가장 작음.
- 각 plan 은 source / transform / render / cli 분해 후 god-script 위치 cli.ts 로 교체.
- 새 god-script 신규 작성 금지 — 새 헬퍼는 본 컨벤션 따름.
