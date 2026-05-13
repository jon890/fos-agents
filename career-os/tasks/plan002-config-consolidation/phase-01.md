# Phase 01 — docs-first 갱신: 새 통합 config 스키마 + ADR + 디렉터리 트리

**Model**: sonnet
**Status**: pending

---

## 목표

후속 phase(02~05)가 따라야 할 *새 통합 config 스키마*와 그 결정의 근거를 docs에 먼저 박는다. 이 phase는 **docs만** 갱신하고 코드·config 파일은 손대지 않는다 (docs-first 원칙).

**범위 외**: 실제 config 파일 마이그레이션, runner / resolver 갱신, 옛 파일 삭제. 모두 phase-02~05의 책임.

---

## 관련 docs (실행 전 읽기)

- `career-os/docs/data-schema.md` — 현재 config 스키마. 본 phase가 새 통합 스키마 섹션을 추가.
- `career-os/docs/code-architecture.md` — 현재 디렉터리 트리. 본 phase가 config/ 변화를 반영.
- `career-os/docs/adr.md` — 누적 ADR. 본 phase가 ADR-016 추가.
- `career-os/docs/flow.md` — 현재 흐름. config 경로 변경 한 줄 갱신.

## 작업 항목

### 1. `data-schema.md`에 "통합 config 스키마 (plan002 이후)" 섹션 추가

기존 config/* 섹션은 그대로 두되, 새 통합 스키마를 같이 명시. 후속 phase가 정확히 따라할 수 있어야 한다.

추가할 스키마:

**`config/topics.json` (5개 topic configs 통합본)**:

```json
{
  "_meta": {
    "purpose": "study-pack / question-bank / master / bootcamp 등 모든 topic 메타데이터 단일 출처",
    "schema_version": "1",
    "namespaces": [
      "study-pack",
      "study-pack-candidates",
      "study-pack-maintainer",
      "question-bank",
      "master",
      "bootcamp"
    ]
  },
  "study-pack": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string (fos-study 기준 상대 경로)",
      "title": "string",
      "promptAppend": "string (선택)"
    }
  },
  "study-pack-candidates": {
    "<topic-key>": { "...같은 스키마..." }
  },
  "study-pack-maintainer": { "..." },
  "question-bank": {
    "<topic-key>": {
      "domain": "string",
      "outputPath": "string",
      "title": "string",
      "inputFiles": ["string"]
    }
  },
  "master": { "...study-pack과 유사..." },
  "bootcamp": { "...study-pack과 유사..." }
}
```

각 namespace 안의 topic key는 namespace별로 독립적이라 충돌 가능. 같은 key가 두 namespace에 있어도 OK 하며 각 namespace 안에서 유일성만 보장.

**`config/sources.json` (3개 source configs 통합본)**:

```json
{
  "_meta": {
    "purpose": "tech-blog / ai / geek-news reservoir 단일 출처",
    "schema_version": "1",
    "categories": ["techBlog", "ai", "geek"]
  },
  "techBlog": {
    "_meta": { "purpose": "..." },
    "items": [
      {
        "key": "string",
        "title": "string",
        "source": "string",
        "url": "string",
        "feedUrl": "string (선택)",
        "filterKeywords": ["string"],
        "tags": ["string"],
        "whyNow": "string",
        "estMinutes": "number"
      }
    ]
  },
  "ai": { "...같은 구조..." },
  "geek": { "...같은 구조..." }
}
```

**`config/baseline-core-files.json` (txt 폐기)**:

```json
{
  "_meta": {
    "purpose": "baseline 분석 대상 큐레이션된 core 파일 목록 (ADR-003)",
    "schema_version": "1"
  },
  "files": [
    {"path": "interview/kakao-healthcare-carechat-ai-agent.md", "note": "선택적 — 토픽별 컨텍스트"}
  ]
}
```

note 필드는 선택. 단순 path 배열보다 per-file 메타데이터(우선도, 코멘트) 가능.

기존 개별 config 섹션은 "**migrated to `config/topics.json` 등 (plan002 이후)**" 표시만 남기고 본문은 새 통합 스키마 섹션을 단일 출처로 한다.

### 2. `adr.md` 맨 아래에 ADR-016 추가

ADR 작성 원칙(`skills/planning/SKILL.md`)에 따라 5섹션만:

```markdown
---

## ADR-016 — config 디렉터리 통합: 관심사별 단일 파일 + JSON 통일

- Status: Accepted
- Date: 2026-05-13

### 맥락
career-os/config/에 12+ 데이터 파일이 쌓여 (5 topic / 3 source / live-coding 2 / mvp-target / baseline-core-files.txt / topic-file-map / position 4) 사용자가 "중구난방"이라 부를 정도. 같은 관심사(예: 5 topic 종류)가 분리되어 있어 새 토픽 종류를 추가할 때 어디에 두는지 모호. 형식도 일부 txt가 끼어 있어 일관성 X. position-recommender 단일 사용 자산 4개는 워크스페이스 공용 config/에 있을 이유 없음.

### 결정
- 5개 topic configs(study-pack/maintainer/question-bank/master/bootcamp + candidates)를 단일 `config/topics.json`으로 통합. 각 type을 namespace 키로.
- 3개 source configs(tech-blog/ai-topic/geek-news)를 단일 `config/sources.json`으로 통합. 카테고리 키.
- `config/baseline-core-files.txt` → `config/baseline-core-files.json`. 다른 데이터 파일과 형식 통일.
- position-recommender 단일 사용 자산 4개(`company-upside-reference.md`, `position-context-index.md`, `position-decision-criteria.md`, `verified-company-research-targets.json`)를 `skills/position-recommender/references/`로 이동. config/는 워크스페이스 공용 입력만.
- `live-coding-seed-pool.json`과 `-candidates.json`은 분리 유지 — ADR-009의 primary vs reservoir 의도된 분리 (현 plan에서 합치지 않음).

### 결과
- config/ 안 파일이 19+ → 9 (mvp-target, candidate-profile, topics, sources, baseline-core-files, topic-file-map, live-coding 2, .env).
- 새 topic 종류 추가는 topics.json 한 곳에 namespace 추가로 끝남.
- position-recommender 자산은 그 스킬 안에서 self-contained.
- 코드 영향: 4개 resolver + 5+ runner + refresh / replenish / promote 스크립트가 새 경로·새 스키마로 갱신 필요 (plan002 phase-02~05이 처리).

### 적용
- 통합 스키마는 `docs/data-schema.md` "통합 config 스키마 (plan002 이후)" 섹션 참조.
- live-coding 쌍 보존 결정의 *왜*는 ADR-009.
```

### 3. `code-architecture.md` 디렉터리 트리 갱신

기존 `config/` 트리를:
```
├── config/                                ← 사람이 큐레이션한 입력
│   ├── mvp-target.json
│   ├── candidate-profile.md
│   ├── baseline-core-files.txt            ← txt
│   ├── study-pack-topics.json
│   ├── study-topic-candidates.json
│   ├── ... 그 외 5개 topic / 3 source / position 4개 / live-coding 2
```

→ 새 트리로:
```
├── config/                                ← 사람이 큐레이션한 입력 (ADR-016 통합 후)
│   ├── mvp-target.json
│   ├── candidate-profile.md
│   ├── topics.json                        # 5 topic configs 통합 (plan002)
│   ├── sources.json                       # 3 source configs 통합 (plan002)
│   ├── baseline-core-files.json           # txt → JSON (plan002)
│   ├── topic-file-map.json
│   ├── live-coding-seed-pool.json
│   ├── live-coding-seed-candidates.json
│   └── .env
```

position 자산은 `skills/position-recommender/references/`로 이동했음을 그 스킬 항목에 같이 표시.

### 4. `flow.md`에 config 경로 갱신

명령별 흐름 안의 `config/<old>.json` → `config/topics.json` (또는 `config/sources.json`) 경로 갱신. 흐름 자체는 변하지 않음.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/docs/data-schema.md` | 새 통합 스키마 섹션 추가, 기존 개별 섹션은 migrated 표시 |
| `career-os/docs/adr.md` | ADR-016 맨 아래 추가 |
| `career-os/docs/code-architecture.md` | 디렉터리 트리의 config/ 부분 갱신 |
| `career-os/docs/flow.md` | config/* 경로 일괄 갱신 |

**다른 파일은 손대지 않는다.** config/*.json, *.txt, scripts/* 모두 phase-02~05의 책임.

## 검증

```bash
cd /home/bifos/ai-nodes

# 1. docs 4개가 모두 수정됐는지 git diff로 확인
git diff --stat career-os/docs/data-schema.md career-os/docs/adr.md career-os/docs/code-architecture.md career-os/docs/flow.md

# 2. data-schema.md에 "통합 config 스키마" 섹션이 들어갔는지
grep -c "통합 config 스키마" career-os/docs/data-schema.md
# 기대값: 1 이상

# 3. adr.md에 ADR-016이 추가됐는지
grep -c "^## ADR-016" career-os/docs/adr.md
# 기대값: 1

# 4. ADR 헤더 총 16개 (001~016)
grep -c "^## ADR-" career-os/docs/adr.md
# 기대값: 16

# 5. code-architecture.md에 새 topics.json/sources.json 라인 등장
grep -c "topics.json\|sources.json" career-os/docs/code-architecture.md
# 기대값: 2 이상

# 6. 코드 / config 파일은 손대지 않았어야
git diff --stat career-os/config/ career-os/skills/ | head
# 기대값: 빈 출력 (또는 cosmetic only)
```

위 6개 모두 통과하면 success. 한 가지라도 실패하면 `PHASE_FAILED: <검증 항목 N>` 출력 후 종료.

## 커밋

```
docs(career-os): plan002 config 통합 스키마 + ADR-016 추가

phase-02~05이 따를 새 통합 스키마를 docs에 먼저 박는다 (docs-first).

- data-schema.md: 통합 config 스키마 섹션 추가 (topics.json / sources.json / baseline-core-files.json)
- adr.md: ADR-016 추가 (config 통합 결정의 맥락·결정·결과·적용)
- code-architecture.md: 디렉터리 트리의 config/ 부분 갱신
- flow.md: 명령별 흐름의 config 경로 갱신

코드·config 파일은 phase-02~05이 처리.
```

push는 phase-05에서. 이 phase는 commit까지만.

## 의도 메모 (왜)

- docs-first 커밋 — 후속 phase가 실패해도 새 스키마 설계가 main에 남아 다음 사이클이 재시도 가능.
- 새 스키마를 docs에 박아두면 phase-02~05가 실행 중에 docs를 Read해서 정확한 스키마 참조 가능 (self-contained 유지).

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료한다. 마커만 출력하고 정상 종료하면 `run-phases.py`가 success로 잘못 처리한다 (plan001-adr-cleanup 1차 실행 사례).

- `career-os/docs/` 디렉터리 또는 위 4개 docs가 존재하지 않으면 `PHASE_BLOCKED: docs 누락` + `exit 2`.
- 검증 항목 1~6 중 하나라도 실패하면 `PHASE_FAILED: <항목>` + `exit 1`.
