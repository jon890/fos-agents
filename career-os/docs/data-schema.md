# Data Schema — career-os

career-os가 다루는 모든 영속 데이터의 스키마와 위치. 새 필드를 추가하거나 새 파일을 도입할 때 이 문서에 같이 갱신한다.

## 디렉터리 한눈에

| 디렉터리 | 역할 | git 추적 |
|---|---|---|
| `.env` (워크스페이스 root) | Discord 채널 ID·GitHub 토큰 등 secret (ADR-021) | ✗ (.gitignore) |
| `.env.example` (워크스페이스 root) | secret 키 템플릿 — git 추적되는 빈 값 가이드 (ADR-021) | ✓ |
| `config/` | 사람이 큐레이션한 입력 (정책·토픽·후보 reservoir) | ✓ |
| `data/study-progress.json` | 후보자 학습 진도 | ✓ |
| `data/generated-artifacts.json` | fos-study에 푸시된 산출물 인덱스 | ✓ |
| `data/reports/baseline/YYYY-MM-DD/` | baseline 실행 산출물 (analysis-input, claude.result.json, report.md, fallback.md) | △ 부분적 |
| `data/reports/daily/YYYY-MM-DD/` | daily 실행 산출물 | △ |
| `data/runtime/` | 매 실행 갱신되는 가변 상태 (토픽 풀, 잠금, 피드 캐시) | ✗ (대부분 gitignore) |
| `data/normalized/` | 외부 소스 정규화 캐시 (현재 비어 있음 — fos-study.latest.json 정리됨) | ✗ |
| `data/source/` | 수집된 외부 노트 | ✗ |
| `logs/` | 실행 로그 (`task-runs.jsonl`, `token-usage.jsonl`) | ✗ |
| `sources/fos-study/` | 외부 동기 저장소 (jon890/fos-study) — git submodule 같은 위치이나 실제로는 별도 clone | ✗ |

## config/

### config/mvp-target.json (현재 타깃 단일 출처)

```json
{
  "primary": {
    "company": "string",
    "team": "string",
    "role": "string",
    "interview_date": "YYYY-MM-DD | empty",
    "notes": "string"
  },
  "history": [
    {
      "company": "string",
      "team": "string",
      "role": "string",
      "interview_date": "YYYY-MM-DD",
      "deprecated_at": "YYYY-MM-DD",
      "notes": "string"
    }
  ]
}
```

타깃 전환 시 `primary`를 `history` 앞에 push하고 새 `primary`를 채운다.

### config/candidate-profile.md

후보자 이력. 11개 섹션의 prose 마크다운. **JSON이 아닌 의도적 선택** — AI 에이전트가 context로 직접 읽는 자산이라 구조화보다 narrative 가치가 큼. 모든 주장은 `task/**` 또는 `resume/**` 경로 태깅됨 (소스 추적용).

### config/baseline-core-files.txt

> **plan002 이후**: `config/baseline-core-files.json`으로 전환. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/study-pack-topics.json (primary curated)

> **plan002 이후**: `config/topics.json`의 `study-pack` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/study-topic-candidates.json (reservoir)

> **plan002 이후**: `config/topics.json`의 `study-pack-candidates` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/experience-question-bank-topics.json

> **plan002 이후**: `config/topics.json`의 `question-bank` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/interview-master-topics.json

> **plan002 이후**: `config/topics.json`의 `master` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/study-pack-maintainer-topics.json

> **plan002 이후**: `config/topics.json`의 `study-pack-maintainer` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/topic-file-map.json

daily report용 토픽 → fos-study 파일 목록 매핑 (ADR-001).

```json
{
  "<topic-key>": ["sources/fos-study/path/to/file.md", ...]
}
```

### config/tech-blog-sources.json / ai-topic-sources.json / geek-news-sources.json

> **plan002 이후**: `config/sources.json`의 `techBlog` / `ai` / `geek` category로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

### config/cj-foodville-bootcamp-topics.json

> **plan002 이후**: `config/topics.json`의 `bootcamp` namespace로 통합. 단일 출처는 "통합 config 스키마 (plan002 이후)" 섹션 참조.

## 통합 config 스키마 (plan002 이후)

plan002가 통합한 새 config 파일 스키마 단일 출처. 기존 개별 섹션에는 "plan002 이후 migrated" 표시 추가됨.

### config/topics.json

5개 topic config 파일 통합본 (`study-pack-topics`, `study-topic-candidates`, `study-pack-maintainer-topics`, `experience-question-bank-topics`, `interview-master-topics`, `cj-foodville-bootcamp-topics`).

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

namespace 안의 topic key는 namespace별로 독립적이라 같은 key가 두 namespace에 있어도 OK. 각 namespace 안에서만 유일성 보장.

### config/sources.json

3개 source config 파일 통합본 (`tech-blog-sources`, `ai-topic-sources`, `geek-news-sources`).

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

### config/baseline-core-files.json

`config/baseline-core-files.txt` (ADR-003) → JSON 전환 (plan002).

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

`note` 필드는 선택. 단순 path 배열보다 per-file 메타데이터(우선도, 코멘트) 가능. 25개 초과 시 ADR-003 청킹 재도입 검토.

## .env / Secrets (워크스페이스 root)

ADR-021로 워크스페이스 secret 위치를 `<ws>/config/.env` → `<ws>/.env`(워크스페이스 root)로 이동. `.env.example`도 같은 위치.

`career-os/.env` 스키마:

```bash
# Discord 채널 ID (필수 — 누락 시 notify_discord.ts가 exit 1로 실패)
DISCORD_CHANNEL_ID=

# fos-study publish용 GitHub API
GITHUB_TOKEN=
GITHUB_REPO_OWNER=jon890
GITHUB_REPO_NAME=fos-study
GITHUB_REPO_BRANCH=main
```

`career-os/.env.example`은 위와 같은 키 + 빈 값. git 추적 ✓.

caller가 `.env`를 ts에 전달하는 방법: `bun --env-file=career-os/.env _shared/lib/notify_discord.ts "<message>"` (ADR-021 결정).

## logs/

### logs/task-runs.jsonl

`track_task.sh`가 매 실행마다 한 줄씩 append. 워크스페이스 운영 데이터의 단일 출처.

```json
{
  "run_id": "YYYYMMDDTHHMMSS-PID",
  "task_name": "career-os:<command>:<topic?>",
  "start_time": "ISO-8601",
  "end_time": "ISO-8601",
  "duration_sec": "int",
  "status": "success | failed",
  "exit_code": "int",
  "command": "string (전체 실행 명령)",
  "model": "string (예: claude-sonnet-4-6, claude-opus-4-7[1m]) — ADR-014 이후 채워짐",
  "tokens_in_delta": "int",
  "tokens_out_delta": "int",
  "cached_tokens_delta": "int",
  "cache_read_input_tokens": "int",
  "cache_hit_percent_start/end": "int",
  "cost_usd": "float",
  "service_tier": "standard | priority | ...",
  "claude_session_id": "string",
  "claude_result_uuid": "string",
  "usage_raw": "object (Claude usage JSON 원본)",
  "model_usage": "object",
  "file_metrics_before/after": "object (report/input/target-list 파일 메트릭)"
}
```

### logs/token-usage.jsonl

`task-runs.jsonl`과 동일 스키마. 별도 파일로 token-usage만 다시 보고자 할 때 빠른 grep용.

### logs/.usage-status/ (임시 폴더)

`track_task.sh`가 실행 중에 쓰는 임시 상태 파일들. 끝나면 정리되지 않고 누적 — 주기적 cleanup 필요 (현재 정책 미정).

## data/

### data/study-progress.json (ADR-002)

```json
{
  "sessions": [
    {
      "date": "YYYY-MM-DD",
      "topics": ["string", ...],
      "files": ["string", ...],
      "source": "daily-run | manual | ..."
    }
  ],
  "weak_spots": {
    "<topic-key>": {
      "last_studied": "YYYY-MM-DD | null",
      "study_count": "int"
    }
  }
}
```

`run_daily.sh` 성공 후 자동 업데이트.

### data/generated-artifacts.json

study-pack / question-bank / master가 fos-study에 publish한 후 `_shared/bin/update_artifacts.py`가 upsert.

```json
{
  "<topic-key>": {
    "outputRelPath": "string (fos-study 기준)",
    "lastCommit": "git sha",
    "lastUpdatedAt": "ISO-8601"
  }
}
```

### data/runtime/topic-inventory.json (ADR-009)

```json
{
  "primaryCurated": ["<topic-key>", ...],
  "candidateReservoir": ["<topic-key>", ...],
  "liveCodingPrimary": [...],
  "liveCodingCandidates": [...],
  "lastRefreshedAt": "ISO-8601"
}
```

`refresh_topic_inventory.py`가 실행 시 갱신.

### data/runtime/topic-inventory-history.jsonl (ADR-010/012)

매 모닝 추천마다 한 줄 append. ADR-010 carry-over penalty와 ADR-012 보조 카테고리 cooldown의 입력.

```json
{
  "generatedAt": "ISO-8601",
  "keys": ["<backend-key>", ...],
  "techBlogKeys": [...],
  "aiKeys": [...],
  "geekKeys": [...],
  "todayPickKeys": {"backend": "...", "techBlog": "...", "ai": "..."},
  "articleUrls": ["string", ...]
}
```

### data/runtime/topic-replenishment.json (ADR-011)

replenish 실행 결과 요약. claudeInvoked 여부, 보충된 후보 수 등.

```json
{
  "generatedAt": "ISO-8601",
  "claudeInvoked": "bool",
  "requestedGenerationCount": "int",
  "before": {"candidateCount": "int", "primaryUncovered": "int", ...},
  "after": {...},
  "accepted": [...],
  "rejected": [...],
  "promoted": [...]
}
```

### data/runtime/morning-topic-recommendation.md

`refresh_topic_inventory.py` 산출물. ADR-012의 10픽 + 오늘의 3선 마크다운. 사람이 직접 읽음.

### data/runtime/feed-cache/<sha1>.json (ADR-013)

RSS/Atom feed 디스크 캐시. 6시간 TTL.

```json
{
  "url": "string",
  "fetchedAt": "ISO-8601",
  "entries": [
    {"title": "...", "url": "...", "published": "ISO-8601"}
  ]
}
```

### data/runtime/freeform-study-pack-topic.json / live-coding-generated-topic.json

`run_from_request.sh` / `run_morning_live_coding.sh`가 쓰는 임시 토픽 컨테이너. 두 runner 모두 dispatcher 미연결 — deferred.

### data/runtime/locks/

study-pack 등 중복 실행 방지용 flock 파일. 토픽별 `<task>-<topic>.lock`.

## sources/fos-study/

외부 git 저장소 (jon890/fos-study). career-os가 마크다운만 읽고, study-pack 종류 명령이 commit + push한다.

career-os가 손대지 말아야 할 영역: `.claude/**` (별도 스킬 정의), `.git/**`.

`sources/fos-study/.claude/skills/docs-audit/SKILL.md`는 docs-audit 스킬의 진실 출처이며 `career-os/skills/docs-audit/SKILL.md`가 심볼릭 링크로 연결됨.
