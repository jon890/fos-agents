## ADR-033 — fos-study source tree를 study artifact 단일 진실원으로 사용

- Status: Accepted
- Date: 2026-05-18

### 맥락

아침 `study-topic-recommender`가 이미 `sources/fos-study/`에 존재하는 주제와 유사한 스터디팩을 다시 추천하는 문제. 원인 4가지가 누적:

- 추천기는 `data/generated-artifacts.json`의 `outputPath` 집합을 "이미 생성됨" 판단 근거로 사용 — fos-study 실제 트리와 drift 가능.
- inventory 갱신과 `_shared/bin/update_artifacts.py` upsert가 분리돼 동기화 보장 없음.
- exact path match만 보므로 경로만 다른 유사 주제 (`java/spring/xxx.md` vs `architecture/xxx.md`)는 통과.
- `study-pack-writer`는 SKILL.md §3 overlap 점검이 자기 판단에 의존 — high/medium confidence 중복에 강한 게이트 없음.

`sources/fos-study/`는 study-pack-writer가 직접 push하는 실제 공개 문서 트리. 별도 인덱스(`generated-artifacts.json`)를 유지하면 drift 비용이 가치보다 크다. fos-study 자체를 진실원으로 삼으면 한 곳만 보면 된다.

### 결정

`career-os/sources/fos-study/**/*.md`(exclude `.git/**`, `.claude/**`)를 generated study artifact의 **단일 진실원**으로 사용한다.

- `data/generated-artifacts.json`은 career-os 활성 동작에서 제거 — Read·Write 모두 0.
- `_shared/bin/update_artifacts.py`는 career-os caller 0으로 격하 (파일 자체는 별도 plan 대기, 다른 워크스페이스 영향 회피).
- `study-topic-recommender`는 `refresh_topic_inventory.ts` 안에서 fos-study 트리를 직접 스캔. 추천 실행 중 `git pull`은 하지 않는다 (로컬 clone 기준).
- `topic-inventory.json`은 config pool 복사본이 아닌 *실행/진단 스냅샷*으로 축소. 마지막 실행의 판단 결과 + duplicate review status만 담는다.
- duplicate detection은 2단계로 분리: TypeScript deterministic scan (path exact + normalized + slug/token overlap) → native Claude duplicate review (의미 판정). TypeScript는 provider-free.
- recommender와 writer가 같은 **duplicate decision schema**를 사용: `new` / `update-existing` / `skip` / `needs-user-confirmation` 4개 라벨.
- morning markdown은 `new` 후보로 추천 섹션을, `update-existing`/`needs-user-confirmation` 후보로 별도 "기존 문서 보강 후보" 섹션(최대 5개)을 보여준다.
- Claude duplicate review 실패는 추천 전체를 실패시키지 않음 — deterministic fallback + warning.
- `study-pack-writer`는 새 markdown 작성 직전 같은 schema로 duplicate guard 수행: `new`만 새 파일, `update-existing`은 기존 문서 update로 전환, `skip`/`needs-user-confirmation`은 작성 중단.

### 거절한 대안

- `generated-artifacts.json` 유지 + cross-sync 도입: drift 자체를 없애지 못함. *왜 두 진실원이 있는지* 정당화 불가.
- duplicate detection helper를 `_shared/lib`로 즉시 승격: career-os/fos-study 구조에 강하게 묶임 — 도메인 묶음 풀리면 다시 검토.
- duplicate review를 TypeScript에서 직접 Claude API 호출: provider-free 원칙 위배. native skill이 도구 호출의 단일 출처 ([[ADR-026]] 정렬).
- fos-study 자동 `git pull` 후 스캔: 추천 결정의 *입력 무결성* 흔들림 — 사용자의 로컬 clone 상태 그대로 사용.

### 결과

- 진실원 단일화 — fos-study가 곧 "이미 존재하는 문서" 집합.
- recommender·writer 사이 duplicate 정책 통일 — 사용자가 어디로 명령하든 같은 게이트 통과.
- morning markdown UX 개선 — "보강 후보" 5개가 별도 섹션으로 노출돼 새 문서 vs 기존 문서 보강 의사결정이 명확.
- 단점:
  - 매 morning 추천마다 fos-study 트리 스캔 비용 (수백 ~ 수천 개 파일, 그러나 markdown만 + 본문 읽지 않음 — 무시 가능).
  - Claude duplicate review 한 번 추가 — 비용·시간 증가 (deterministic fallback로 가용성은 보장).
  - `update-existing` 후속 처리 (기존 문서 보강 정책)는 본 ADR 범위 밖 — 별도 plan.

### 적용

- `scripts/study-topic-recommender/refresh_topic_inventory.ts` — `generated-artifacts.json` 의존 제거 + fos-study 스캔 + deterministic dedupe.
- (선택) `scripts/study-topic-recommender/duplicate_detection.ts` — TypeScript dedupe helper. writer도 참조 가능.
- `.claude/skills/study-topic-recommender/SKILL.md` — Claude duplicate review 단계 추가.
- `.claude/skills/study-pack-writer/SKILL.md` — duplicate guard 단계 강화.
- `docs/data-schema.md` — `data/generated-artifacts.json` active 제거, `topic-inventory.json` 새 스냅샷 스키마, duplicate decision schema 추가.
- `docs/flow.md` — recommender·writer 흐름 갱신.
- `docs/code-architecture.md` — `generated-artifacts.json` 트리 제거 + `update_artifacts.py` career-os 사용 0 표기.
- `docs/prd.md` — morning markdown "기존 문서 보강 후보" 섹션 노출.
- `AGENTS.md` — 외부 의존성 섹션의 `update_artifacts.py` 항목 갱신/제거.
- OpenClaw wrapper (`~/.openclaw/workspace/skills/study-topic-recommender|study-pack-writer/SKILL.md`)는 사용자가 직접 동기 — Claude는 `~/.openclaw/**` 수정 금지.
