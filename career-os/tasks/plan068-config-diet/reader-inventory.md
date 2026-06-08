# plan068 Phase 01 reader inventory

작성일: 2026-06-08

## 기준

ADR-069 기준으로 `config/`는 정책, 현재 타깃, 후보자 baseline, 학습 진행 상태, 외부 source registry, 사람이 고른 pin/override/제외/seed만 보관한다.
학습 문서 목록은 `sources/fos-study/`에서 파생하고, 공개 질문 목록은 `public/question-bank/`에서 파생한다.

이 inventory는 Phase 01 시점의 reader 조사 결과를 고정한다.
config 파일 본문은 수정하지 않았다.

## 조사 요약

| config | 크기 | top-level key | active reader | docs reference | task history | 결론 |
|---|---:|---|---|---|---|---|
| `config/first-round-drill-core-files.json` | 3399 bytes | `description`, `files`, `target`, `updated_at` | 없음 | `docs/data-schema.md`, `docs/adr.md` | plan068 | 삭제 후보 |
| `config/study-preferences.json` | 4140 bytes | `avoid`, `current_target`, `interest_axes`, `purpose`, `secondary_targets`, `selection_principles`, `updated_at` | `.claude/skills/study-topic-recommender/SKILL.md` | `docs/data-schema.md`, `docs/adr.md` | plan068 | 축소 |
| `config/study-pack-topics.json` | 39846 bytes | `_meta` 외 study-pack topic key 55개 | `scripts/study-topic-recommender/cli.ts`, `.claude/skills/study-topic-recommender/SKILL.md`, `.claude/skills/study-pack-writer/SKILL.md` | `docs/data-schema.md`, `docs/flow.md`, `docs/code-architecture.md`, `docs/adr.md` | plan002, plan017, plan068 등 | 축소 |
| `config/study-pack-candidates.json` | 41812 bytes | `_comment`, `_meta`, `topics` | `scripts/study-topic-recommender/cli.ts`, `.claude/skills/study-topic-recommender/SKILL.md` | `docs/data-schema.md`, `docs/flow.md`, `docs/adr.md` | plan002, plan016, plan017, plan068 등 | 축소 |
| `config/topic-file-map.json` | 5079 bytes | `_comment` 외 topic key 24개 | `.claude/skills/interview-prep-analyzer/SKILL.md` | `docs/data-schema.md`, `docs/flow.md`, `docs/code-architecture.md`, `docs/adr.md` | plan002, plan017, plan019, plan068 등 | 이관 |
| `config/topic-profiles.json` | 2068 bytes | `_description`, `kafka`, `mysql`, `redis`, `spring-jpa` | `.claude/skills/study-pack-writer/SKILL.md` | `docs/data-schema.md`, `docs/flow.md` | plan019, plan068 | 이관 |
| `config/question-bank-topics.json` | 2732 bytes | `_meta`, `experience-qbank-ai-service-team`, `experience-qbank-slot-team` | `.claude/skills/interview-asset-writer/SKILL.md` | `docs/data-schema.md`, `docs/adr.md` | plan002, plan017, plan068 | 이관 |
| `config/live-coding-seed-pool.json` | 4605 bytes | `_comment`, `seeds` | `scripts/study-topic-recommender/cli.ts`, `.claude/skills/study-topic-recommender/SKILL.md` | `docs/data-schema.md`, `docs/flow.md`, `docs/adr.md` | plan002, plan016, plan019, plan068 | 유지 |
| `config/live-coding-seed-candidates.json` | 973 bytes | `_comment`, `seeds` | `scripts/study-topic-recommender/cli.ts`, `.claude/skills/study-topic-recommender/SKILL.md` | `docs/data-schema.md`, `docs/flow.md`, `docs/adr.md` | plan002, plan016, plan019, plan068 | 축소 |

## 파일별 판단

### `config/first-round-drill-core-files.json`

- active reader: 없음.
- docs reference: ADR-069과 data-schema 정리 후보에만 등장한다.
- task history: plan068의 대상과 후속 phase 정리 후보로만 등장한다.
- 판단: 삭제 후보.
- 다음 phase 의존성: Phase 04에서 삭제 전 마지막 `rg` 확인을 다시 수행한다.

### `config/study-preferences.json`

- active reader: `.claude/skills/study-topic-recommender/SKILL.md`가 추천 철학과 관심 축 입력으로 읽는다.
- docs reference: ADR-069과 data-schema가 `mvp-target` 반복 필드 축소 대상으로 명시한다.
- task history: plan068에서 정리 대상으로 등장한다.
- 판단: 축소.
- 다음 phase 의존성: Phase 03에서 recommender reader가 `current_target` 중복값을 요구하지 않도록 확인하고, Phase 04에서 추천 철학, 제외 축, 보조 관심사, 난이도 선호 같은 정책성 값만 남긴다.

### `config/study-pack-topics.json`

- active reader: `scripts/study-topic-recommender/cli.ts`가 curated topic pool로 읽고, `.claude/skills/study-topic-recommender/SKILL.md`와 `.claude/skills/study-pack-writer/SKILL.md`가 topic lookup 입력으로 읽는다.
- docs reference: ADR-069은 대량 topic JSON을 정본이 아니라 축소 대상으로 본다.
- task history: plan002, plan017, plan068 등에서 topic config 이력으로 등장한다.
- 판단: 축소.
- 다음 phase 의존성: Phase 02에서 `sources/fos-study/` 기반 inventory helper를 만든 뒤, Phase 03에서 recommender와 writer가 실제 파일 inventory를 우선하고 이 config는 override, seed, fallback으로만 읽도록 전환한다.

### `config/study-pack-candidates.json`

- active reader: `scripts/study-topic-recommender/cli.ts`가 candidate reservoir로 읽고, `.claude/skills/study-topic-recommender/SKILL.md`가 promote 후보 판단 입력으로 읽는다.
- docs reference: ADR-069은 대량 reservoir JSON을 정본이 아니라 migration 대상으로 본다.
- task history: plan002, plan016, plan017, plan068 등에서 reservoir와 promote 이력으로 등장한다.
- 판단: 축소.
- 다음 phase 의존성: Phase 02의 derived inventory 결과와 Phase 03의 promote/fallback migration 이후, Phase 04에서 사람이 고른 후보 seed 또는 replenish guardrail만 남긴다.

### `config/topic-file-map.json`

- active reader: `.claude/skills/interview-prep-analyzer/SKILL.md`가 daily 모드 topic-key에서 fos-study 파일을 고르는 fallback으로 읽는다.
- docs reference: flow 문서는 오래된 topic-file map을 실제 파일 존재 여부보다 우선하지 말라고 명시한다.
- task history: plan017과 plan019에서 daily 입력 또는 cleanup 대상으로 등장한다.
- 판단: 이관.
- 다음 phase 의존성: Phase 02에서 fos-study inventory helper가 topic/path/tag 기반 선택을 제공하고, Phase 03에서 daily reader가 이 파일보다 실제 inventory를 우선하도록 전환한다.

### `config/topic-profiles.json`

- active reader: `.claude/skills/study-pack-writer/SKILL.md`가 topic family별 emphasis와 출력 경로 패턴으로 읽는다.
- docs reference: data-schema는 전역 config보다 `study-pack-writer` reference나 작은 override로 이관할 후보라고 명시한다.
- task history: plan019와 plan068에서 cleanup 또는 이관 대상으로 등장한다.
- 판단: 이관.
- 다음 phase 의존성: Phase 03 또는 Phase 04에서 writer 전용 reference로 옮기거나, 전역 정책이 필요한 값만 작은 override로 남긴다.

### `config/question-bank-topics.json`

- active reader: `.claude/skills/interview-asset-writer/SKILL.md`가 topic-key lookup과 output path, input files, prompt append 입력으로 읽는다.
- docs reference: ADR-069과 data-schema는 `public/question-bank` 정본 역할을 분리하고 interview-asset override 후보로 좁히라고 명시한다.
- task history: plan002, plan017, plan068 등에서 question-bank namespace 이력으로 등장한다.
- 판단: 이관.
- 다음 phase 의존성: Phase 02에서 public question bank inventory 파생 경로를 확인하고, Phase 03에서 writer가 public inventory를 정본으로 삼고 이 파일은 interview-asset override로만 읽도록 전환한다.

### `config/live-coding-seed-pool.json`

- active reader: `scripts/study-topic-recommender/cli.ts`와 `.claude/skills/study-topic-recommender/SKILL.md`가 primary live-coding seed pool로 읽는다.
- docs reference: flow 문서는 현재 유지라고 기록하고, ADR-069은 active 추천 흐름에서 실제 사용 여부를 확인한 뒤 유지 또는 흡수하라고 한다.
- task history: plan016과 plan019에서 study-topic-recommender 입력으로 유지된 이력이 있다.
- 판단: 유지.
- 다음 phase 의존성: 이 파일은 사람이 고른 seed pool 성격이라 config 책임 원칙과 맞는다. Phase 03에서 derived inventory와 충돌하지 않는 seed override로 읽는지 확인한다.

### `config/live-coding-seed-candidates.json`

- active reader: `scripts/study-topic-recommender/cli.ts`와 `.claude/skills/study-topic-recommender/SKILL.md`가 candidate live-coding seeds로 읽는다.
- docs reference: flow 문서는 현재 유지라고 기록하고, ADR-069은 active 추천 흐름에서 실제 사용 여부를 확인한 뒤 유지 또는 흡수하라고 한다.
- task history: plan016과 plan019에서 study-topic-recommender 입력으로 유지된 이력이 있다.
- 판단: 축소.
- 다음 phase 의존성: Phase 03에서 추천 흐름의 seed 후보 처리 역할을 확인하고, Phase 04에서 primary seed와 중복되는 값은 흡수하거나 사람이 고른 candidate seed만 남긴다.

## dead reference와 history-only reference

- `docs/adr.md`, `docs/data-schema.md`, `docs/flow.md`, `docs/code-architecture.md`의 참조는 현재 정책과 설계 기준이다.
- `tasks/plan002-*`, `tasks/plan016-*`, `tasks/plan017-*`, `tasks/plan019-*`, `tasks/plan028-*`의 참조는 task history다.
- `config/study-pack-candidates.json` 내부 `_meta`처럼 자기 설명에 등장하는 참조는 reader가 아니다.
- `skills/` 디렉터리는 현재 repository root에 존재하지 않는다. active skill reader 조사는 `.claude/skills/` 기준으로 수행했다.

## Phase 02/03 의존성

- Phase 02는 `sources/fos-study/` 기반 학습 문서 inventory와 `public/question-bank/` 기반 공개 질문 inventory를 제공해야 한다.
- Phase 03은 `study-topic-recommender`, `study-pack-writer`, `interview-asset-writer`, `interview-prep-analyzer`가 전체 목록 config보다 derived inventory를 우선하도록 reader 계약을 바꿔야 한다.
- Phase 04는 이 inventory를 근거로 config 파일을 바로 삭제하지 말고, active reader 제거와 동작 확인 이후 축소, 이관, 삭제 후보를 처리해야 한다.
