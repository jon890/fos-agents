# Phase 1 — refresh_topic_inventory.ts fos-study 스캔 + deterministic dedupe + inventory 스냅샷 축소

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-033 1단계 — `scripts/study-topic-recommender/refresh_topic_inventory.ts`에서 `data/generated-artifacts.json` 의존을 제거하고 `sources/fos-study/**/*.md`를 직접 스캔한다. deterministic dedupe(exact / normalized path / slug overlap) helper를 분리하고 `data/runtime/topic-inventory.json`을 스냅샷 스키마로 축소.

본 phase는 *deterministic 영역만* 다룬다. Claude duplicate review는 phase-02에서.

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# branch
[ "$(git branch --show-current)" = "main" ] \
  || { echo "PHASE_BLOCKED: branch != main"; exit 2; }

# 폐기 대상 (current code에 generated-artifacts.json 의존이 살아있어야 의미가 있음)
grep -q "generated-artifacts" career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts \
  || { echo "PHASE_BLOCKED: refresh_topic_inventory.ts에 generated-artifacts 참조가 이미 없음 — phase 이미 적용됨?"; exit 2; }

# fos-study 클론 존재
test -d career-os/sources/fos-study/.git \
  || { echo "PHASE_BLOCKED: sources/fos-study/.git 부재 — 클론 후 재실행"; exit 2; }

# planning 세션이 docs를 이미 커밋했는지 확인 (ADR-033 본문 존재)
grep -q "## ADR-033 — fos-study source tree" career-os/docs/adr.md \
  || { echo "PHASE_BLOCKED: ADR-033 본문 부재 — docs 반영 누락"; exit 2; }

# bun 사용 가능
command -v bun >/dev/null \
  || { echo "PHASE_BLOCKED: bun 미설치"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. `duplicate_detection.ts` 신규 작성

경로: `career-os/scripts/study-topic-recommender/duplicate_detection.ts`

책임: provider-free deterministic dedupe. Claude CLI/API 호출 금지.

export 시그니처 (예시):

```ts
export interface DuplicateCandidateInput {
  key: string;
  candidatePath: string;   // fos-study 기준 상대 경로
}

export interface PathMatch {
  key: string;
  candidatePath: string;
  matchedPath: string;     // 기존 fos-study 문서 경로
}

export interface PossibleDuplicate extends PathMatch {
  reason: string;          // 예: "slug overlap: spring-batch"
}

export interface DeterministicDedupeResult {
  exactPathMatches: PathMatch[];
  normalizedPathMatches: PathMatch[];
  possibleDuplicates: PossibleDuplicate[];
}

export function normalizePath(p: string): string;
// → lower-case + forward slash + trailing .md 제거
export function deterministicDedupe(
  candidates: DuplicateCandidateInput[],
  existingPaths: string[],
  options?: { possibleDuplicateLimit?: number }
): DeterministicDedupeResult;
```

알고리즘:

- **exact**: `existingPaths.includes(candidate.candidatePath)`
- **normalized**: `normalizePath` 비교
- **possibleDuplicates**: candidate.candidatePath의 마지막 slug(파일명에서 `.md` 제거 + `-` split)와 existing 파일의 마지막 slug 비교 — token 2개 이상 겹치면 후보. 상한 (default 20) 적용.

작성 후 `bun --bun career-os/scripts/study-topic-recommender/duplicate_detection.ts` 구문 검사(선택 — TS는 import-only면 typecheck 별도). bun runtime에서 import 가능한지만 확인.

### 2. `fos_study_inventory.ts` 신규 작성 (분리 helper)

경로: `career-os/scripts/study-topic-recommender/fos_study_inventory.ts`

책임: fos-study 트리 스캔. `git pull` 호출 금지 — 로컬 clone 상태 기준.

export 시그니처:

```ts
export interface FosStudyInventoryOptions {
  root: string;            // career-os/sources/fos-study 절대 경로
  excludeDirs?: string[];  // default [".git", ".claude"]
}

export interface FosStudyInventory {
  root: string;
  scannedMarkdownCount: number;
  excludedDirs: string[];
  markdownPathsRelative: string[]; // fos-study root 기준 상대 경로, forward slash
}

export function scanFosStudyInventory(opts: FosStudyInventoryOptions): FosStudyInventory;
```

구현 가이드:

- Node stdlib `fs.readdirSync(..., { withFileTypes: true, recursive: true })` 사용 가능 (Bun 호환)
- excludeDirs는 path segment 단위 비교
- 결과 경로는 항상 forward slash + fos-study root 기준 상대 경로

### 3. `refresh_topic_inventory.ts` 갱신

다음 변경 사항을 적용:

3-1. **import 추가**:

```ts
import { scanFosStudyInventory } from "./fos_study_inventory.js";
import { deterministicDedupe } from "./duplicate_detection.js";
```

3-2. **`generated-artifacts.json` 의존 완전 제거**:

- `safeLoad<ArtifactsFile>(join(TASK_ROOT, "data", "generated-artifacts.json"), { artifacts: [] })` 호출 제거.
- `Artifact` / `ArtifactsFile` 타입은 *fos-study 스캔 결과 기반 유틸 타입* 또는 history mention으로 정리.
- `studyPaths` / `livePaths` 세트는 fos-study 스캔 결과(`markdownPathsRelative`)에서 직접 도출.
- `recentDomainCounts` 계산은 *fos-study 파일 mtime 기반* 또는 *완전 제거*. 첫 라운드에서는 **mtime fallback** 사용 — `fs.statSync(fullPath).mtime`을 정렬 기준으로. 정확한 publish history가 필요하면 별도 plan.

3-3. **deterministic dedupe 호출**:

curated study topics + study candidates를 input으로 `deterministicDedupe()` 실행. 결과를 inventory.excluded.* 에 그대로 출력.

3-4. **inventory 스키마 재작성** (data-schema.md ADR-033 항목 참조):

```ts
const inventory = {
  generatedAt: new Date().toISOString(),
  sourceOfTruth: {
    kind: "fos-study",
    root: "sources/fos-study",
    scannedMarkdownCount: fosInventory.scannedMarkdownCount,
    excludedDirs: fosInventory.excludedDirs,
  },
  counts: {
    configCuratedStudyTopics: Object.keys(studyTopics).length,
    configStudyTopicCandidates: studyCandidates.length,
    existingFosStudyMarkdownFiles: fosInventory.scannedMarkdownCount,
    remainingCuratedStudyTopics: uncoveredCurated.length,
    remainingCandidateStudyTopics: candidateRecommendations.length,
    remainingLiveCodingSeeds: remainingLive.length,
    duplicateCandidates: dedupeResult.possibleDuplicates.length,
  },
  remaining: {
    curatedStudyTopicKeys: uncoveredCurated.map((t) => t.key),
    candidateStudyTopicKeys: candidateRecommendations.map((t) => t.key),
    liveCodingSlugs: remainingLive.map((s) => s.slug),
  },
  excluded: dedupeResult,             // {exactPathMatches, normalizedPathMatches, possibleDuplicates}
  claudeDuplicateReview: {            // phase-02에서 native skill이 채움
    status: "skipped",
    reviewedAt: null,
    items: [],
  },
  recommendations: backendRecommendations,
  techBlogRecommendations,
  aiRecommendations,
  geekRecommendations,
  todayPick,
  updateExistingRecommendations: [], // phase-02에서 채워짐
  discovery: { ... },
};
```

`pools.*` 키는 제거 — 그 자리는 `remaining.*` (key 배열) + `excluded.*` (deterministic 결과)로 대체.

3-5. **morning markdown rendering은 최소 변경**:

본 phase에서는 "기존 문서 보강 후보" 섹션을 *비어 있는 placeholder*로만 둔다. 채우는 로직은 phase-02에서.

### 4. ts 실행 + 산출물 검증

```bash
cd /home/bifos/ai-nodes
bun --env-file=career-os/.env career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts \
  || { echo "PHASE_FAILED: refresh_topic_inventory.ts 실행 실패"; exit 1; }

# A. inventory 새 스키마
python3 -c "
import json, sys
data = json.load(open('career-os/data/runtime/topic-inventory.json'))
required = ['generatedAt', 'sourceOfTruth', 'counts', 'remaining', 'excluded', 'claudeDuplicateReview']
missing = [k for k in required if k not in data]
if missing:
    print('PHASE_FAILED: topic-inventory.json 누락 키', missing); sys.exit(1)
if data['sourceOfTruth'].get('kind') != 'fos-study':
    print('PHASE_FAILED: sourceOfTruth.kind != fos-study'); sys.exit(1)
if data['claudeDuplicateReview'].get('status') != 'skipped':
    print('PHASE_FAILED: claudeDuplicateReview.status 초기값이 skipped 아님'); sys.exit(1)
print('[ok] inventory 새 스키마')
" || exit 1

# B. generated-artifacts 의존 0
HITS=$(grep -c "generated-artifacts" career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts || echo 0)
[ "$HITS" = "0" ] || { echo "PHASE_FAILED: refresh_topic_inventory.ts에 generated-artifacts 잔존 $HITS"; exit 1; }

# C. helper 파일 존재
test -f career-os/scripts/study-topic-recommender/duplicate_detection.ts \
  || { echo "PHASE_FAILED: duplicate_detection.ts 부재"; exit 1; }
test -f career-os/scripts/study-topic-recommender/fos_study_inventory.ts \
  || { echo "PHASE_FAILED: fos_study_inventory.ts 부재"; exit 1; }

echo "[4] 실행/스키마/잔재 검증 OK"
```

### 5. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add \
  career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts \
  career-os/scripts/study-topic-recommender/fos_study_inventory.ts \
  career-os/scripts/study-topic-recommender/duplicate_detection.ts

git commit -m "$(cat <<'COMMIT_EOF'
feat(career-os): refresh_topic_inventory.ts fos-study 직접 스캔 + deterministic dedupe (plan025 phase-01)

ADR-033 1단계 — generated-artifacts.json 의존 제거 + sources/fos-study
트리 스캔으로 단일 진실원화. deterministic dedupe(exact / normalized
path / slug overlap)를 helper로 분리.

신규:
- scripts/study-topic-recommender/fos_study_inventory.ts
  fos-study 트리 스캔 (.git/.claude exclude, git pull 없음)
- scripts/study-topic-recommender/duplicate_detection.ts
  provider-free dedupe helper — exact / normalized / possible duplicates

갱신:
- scripts/study-topic-recommender/refresh_topic_inventory.ts
  generated-artifacts.json 의존 제거 + fos-study 스캔 결과 사용 +
  inventory 새 스냅샷 스키마 (sourceOfTruth + remaining + excluded +
  claudeDuplicateReview placeholder)

Claude duplicate review + morning markdown 보강 후보 섹션은 phase-02에서.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] || { echo "PHASE_FAILED: commit 수 $COMMITS"; exit 1; }
echo "[5] commit 1 OK"
```

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/study-topic-recommender/fos_study_inventory.ts` | 신규 — fos-study 트리 스캔 |
| `career-os/scripts/study-topic-recommender/duplicate_detection.ts` | 신규 — deterministic dedupe |
| `career-os/scripts/study-topic-recommender/refresh_topic_inventory.ts` | generated-artifacts.json 의존 제거 + 새 스키마 |
| `career-os/data/runtime/topic-inventory.json` | 새 스냅샷 스키마로 갱신 (실행 산출물, gitignored — 커밋하지 않음) |

## Blocked 조건

- branch ≠ main → `PHASE_BLOCKED` + `exit 2`
- refresh_topic_inventory.ts에 generated-artifacts 이미 없음 → `PHASE_BLOCKED` (이미 적용?)
- sources/fos-study/.git 부재 → `PHASE_BLOCKED`
- ADR-033 docs 본문 부재 → `PHASE_BLOCKED` (docs 반영 누락)
- bun 미설치 → `PHASE_BLOCKED`
- ts 실행 실패 / 스키마 누락 / 잔재 → `PHASE_FAILED` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED` + `exit 1`

## 의도 메모

- helper 분리 (`fos_study_inventory.ts` / `duplicate_detection.ts`)는 hand-off R2 첫 옵션 선택. writer가 phase-03에서 같은 모듈을 import.
- `recentDomainCounts`를 fos-study mtime fallback으로 가는 이유: 옛 generated-artifacts는 createdAt/updatedAt 필드를 갖고 있었지만 그 자체가 drift 소스였다. mtime은 trade-off가 명확 (clone 시점에 reset됨) — 도메인 다양성 카운트가 *순위에 큰 영향을 주지 않는 보조 지표*라 허용. 더 정확한 publish history가 필요해지면 fos-study git log 호출로 격상 (별도 plan).
- `pools.*` 키 → `remaining.*` 변경은 *키 배열만 노출*. 전체 객체가 필요하면 config를 직접 Read — inventory는 진단 스냅샷 책임.
- markdown rendering의 "기존 문서 보강 후보" 섹션은 phase-02 책임 — 본 phase는 데이터 레이어만.
