# Phase 1 — draft 작성 (interview-prep-analyzer SKILL.md + topics.json 분리 마이그 ts)

**Model**: sonnet
**Status**: pending

---

## 목표

ADR-027 적용을 위한 draft 2개를 별도 파일로 작성:
1. `draft/SKILL.md` — interview-prep-analyzer native 명세 (~160줄, baseline + daily 자연어 분기)
2. `draft/split_topics_config.ts` — `config/topics.json` 1 파일 → 3 json 분리 마이그 스크립트

draft를 phase 본문 코드 블록에 박지 않음 — common-pitfalls 6-6 회피.

**범위 외**: 실제 적용 (phase-02 ~ phase-04), docs 갱신 (phase-04).

## 관련 docs (실행 전 필수 읽기)

- `career-os/docs/adr.md` ADR-027 — 본 plan 결정 출처
- `career-os/.claude/skills/study-pack-writer/SKILL.md` — native 명세 패턴 참고
- `career-os/.claude/skills/interview-asset-writer/SKILL.md` — native 명세 + 두 모드 분기 패턴
- `career-os/.claude/skills/knowledge-gap-analyzer/references/{baseline,daily}-prompt.md` — 옛 prompt (내용 흡수 대상)
- `career-os/scripts/knowledge-gap-analyzer/run_{baseline,daily}.sh` — 옛 흐름 참고
- `career-os/config/topics.json` — 분리 대상 (62KB / 1084줄)
- `skills/plan-and-build/references/common-pitfalls.md` 6-6 + 6-7

## 사전 검증

```bash
cd /home/bifos/ai-nodes

# 1-A. 원본 자산 존재
for f in baseline-prompt.md daily-prompt.md; do
  test -f "career-os/.claude/skills/knowledge-gap-analyzer/references/$f" \
    || { echo "PHASE_BLOCKED: $f 없음"; exit 2; }
done
for f in run_baseline.sh run_daily.sh; do
  test -f "career-os/scripts/knowledge-gap-analyzer/$f" \
    || { echo "PHASE_BLOCKED: $f 없음"; exit 2; }
done

# 1-B. topics.json 분리 전 baseline (3 namespace 존재)
python3 -c "
import json
with open('career-os/config/topics.json') as f:
    d = json.load(f)
for ns in ['study-pack', 'study-pack-candidates', 'question-bank']:
    assert ns in d, f'{ns} 부재'
print(f'study-pack: {len(d[\"study-pack\"])} / study-pack-candidates: {len(d[\"study-pack-candidates\"])} / question-bank: {len(d[\"question-bank\"])}')
" || { echo "PHASE_BLOCKED: topics.json 구조 검증 실패"; exit 2; }

# 1-C. draft 디렉터리
test -d career-os/tasks/plan017-interview-prep-analyzer-native/draft \
  || { echo "PHASE_BLOCKED: draft 디렉터리 없음"; exit 2; }

echo "사전 검증 OK"
```

## 작업 항목

### 1. SKILL.md draft 작성

저장: `career-os/tasks/plan017-interview-prep-analyzer-native/draft/SKILL.md`

본문 구성 (~160줄):

#### Frontmatter
```yaml
---
name: interview-prep-analyzer
description: 후보자의 학습 갭을 진단·점검하는 면접 준비 분석 skill. 두 모드 자동 분기 — (1) baseline 전체 진단 (큐레이션 10 파일 + 7 섹션 면접 고위험 영역 도출, 면접 시즌 시작 시), (2) daily 집중 점검 (토픽 1개 3-5 파일 + 5 섹션 + study-progress.json 갱신, 매일). 자연어 호출 — "면접 준비 진단", "오늘 갭 점검", "<topic> 약점 분석" 또는 `/interview-prep-analyzer` 슬래시. 후보자 코드/문서 갭 분석이면 무조건 이 skill을 호출.
---
```

#### 본문 섹션 (필수)
1. **Overview** — 한 줄
2. **When to use** — 슬래시 + 자연어 패턴 (baseline / daily 키워드 + 토픽명)
3. **Inputs** — 모드별 Read 매트릭스 (mvp-target / candidate-profile / baseline-core-files / topic-file-map / study-progress / sources/fos-study)
4. **Workflow** — 단계별 (모드 판단 → fos-study git pull → 입력 Read → Claude 분석 → report Write → daily만 study-progress 갱신 → Discord)
5. **Self-check** — 보고서 섹션 카운트 + 후보자 이력 인용 + 한국어
6. **Error handling** — git pull 실패 / 토픽 자동 선택 실패 / study-progress 부재
7. **Why this design** — ADR-027 요약 3줄

#### 모드 분기 (Workflow 안)

- **baseline 모드 판단**: 자연어에 "전체" / "진단" / "baseline" 또는 인자 없음
  - Read: `config/baseline-core-files.json` → 10 파일 path 목록
  - Read: `sources/fos-study/<path>` 10 파일
  - Claude 분석 → 7 섹션 보고서 (목표·강점·부족·고위험·우선순위·면접질문·정리주제)
  - Write: `data/reports/baseline/YYYY-MM-DD/report.md`

- **daily 모드 판단**: 자연어에 "오늘" / "매일" / "daily" / "<topic>" 또는 인자에 topic-key
  - 토픽 선택: 인자 있으면 그대로 / 없으면 `data/study-progress.json` Read → 가장 오래된 lastVisited 토픽 자연어 선택
  - Read: `config/topic-file-map.json` → topic → 3-5 파일 매핑 (없으면 freeform 모드 — Claude가 fos-study에서 관련 파일 자연어 추론)
  - Read: `sources/fos-study/<path>` 3-5 파일
  - Claude 분석 → 5 섹션 보고서 (부족·학습목표·면접질문·답변주의·정리주제)
  - Write: `data/reports/daily/YYYY-MM-DD/report.md`
  - Edit: `data/study-progress.json` → 해당 topic lastVisited = 오늘 갱신 (없으면 entry 추가)

#### 공통 출력 규칙
- 첫 줄 `# <topic-title>` (단일 `#`, baseline은 `# 면접 준비 baseline 진단 — YYYY-MM-DD`)
- 마크다운 직접 작성, JSON 출력 금지
- 한국어 (옛 baseline-prompt.md / daily-prompt.md의 의도 흡수)
- 후보자 실제 이력 인용 (generic advice 금지)
- mvp-target.json 회사·롤 명시

### 2. split_topics_config.ts draft 작성

저장: `career-os/tasks/plan017-interview-prep-analyzer-native/draft/split_topics_config.ts`

본문 구성 (~80줄):

```typescript
#!/usr/bin/env bun
// topics.json (62KB / 3 namespace) → 3 json 분리 마이그
//
// usage: bun split_topics_config.ts [--dry-run]
//
// - Input: career-os/config/topics.json
// - Output:
//     career-os/config/study-pack-topics.json
//     career-os/config/study-pack-candidates.json
//     career-os/config/question-bank-topics.json
//
// _meta는 각 파일에 source 정보 포함하여 재구성.
// dry-run: 출력 path별 키 수만 표시.

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
// ... (3 namespace 추출 + 각 json 작성 + _meta 재구성)
```

타입 정의 + main 함수 + dry-run flag 처리.

### 3. draft 자기 확인

```bash
cd /home/bifos/ai-nodes
DRAFT=career-os/tasks/plan017-interview-prep-analyzer-native/draft

# A. 2 draft 파일 존재
for f in SKILL.md split_topics_config.ts; do
  test -f "$DRAFT/$f" || { echo "PHASE_FAILED: draft/$f 부재"; exit 1; }
done

# B. SKILL.md draft 필수 섹션 7개
SKILL_DRAFT="$DRAFT/SKILL.md"
for s in "When to use" "Inputs" "Workflow" "Self-check" "Error handling" "baseline" "daily"; do
  grep -q "$s" "$SKILL_DRAFT" || { echo "PHASE_FAILED: SKILL.md draft 섹션 '$s' 누락"; exit 1; }
done

# C. SKILL.md draft 라인 수
SKILL_LINES=$(wc -l < "$SKILL_DRAFT")
[ "$SKILL_LINES" -ge 100 ] || { echo "PHASE_FAILED: SKILL.md draft $SKILL_LINES 줄 (expected ≥100)"; exit 1; }

# D. split ts draft 키워드
for kw in "study-pack-topics" "study-pack-candidates" "question-bank-topics" "_meta"; do
  grep -q "$kw" "$DRAFT/split_topics_config.ts" || { echo "PHASE_FAILED: split ts '$kw' 누락"; exit 1; }
done

# E. 옛 subprocess 시대 지시문 *없음* (common-pitfalls 6-7)
for kw in "Output only valid JSON" "Do not output markdown" "claude --json-schema" "--output-format json"; do
  grep -q "$kw" "$SKILL_DRAFT" && { echo "PHASE_FAILED: SKILL.md draft에 옛 subprocess 지시문 '$kw' 잔재"; exit 1; }
done

echo "[자기 확인] 2 draft + 섹션 + 키워드 OK"
```

### 4. 커밋 + commit 개수 강제

```bash
cd /home/bifos/ai-nodes
HEAD_BEFORE=$(git rev-parse HEAD)

git add career-os/tasks/plan017-interview-prep-analyzer-native/draft/
git commit -m "$(cat <<'COMMIT_EOF'
chore(career-os): plan017 phase-01 — interview-prep-analyzer SKILL.md draft + topics.json 분리 ts draft

ADR-027 적용 준비. draft를 phase 본문 코드 블록이 아닌 별도 파일로
분리해 common-pitfalls 6-6 (Write 위장) 회피.

- draft/SKILL.md: interview-prep-analyzer native 명세 (~160줄,
  baseline + daily 자연어 분기, smoke 폐기, study-progress.json 갱신
  부수효과 명시)
- draft/split_topics_config.ts: topics.json 1 파일 → 3 json 분리 마이그
  (study-pack-topics + study-pack-candidates + question-bank-topics)

phase-02에서 split_topics_config.ts 실행 + 5 read 위치 갱신.
phase-03에서 SKILL.md 적용 + 옛 knowledge-gap-analyzer 폐기.
COMMIT_EOF
)" || { echo "PHASE_FAILED: commit"; exit 1; }

HEAD_AFTER=$(git rev-parse HEAD)
COMMITS=$(git rev-list "$HEAD_BEFORE..$HEAD_AFTER" --count)
[ "$COMMITS" = "1" ] \
  || { echo "PHASE_FAILED: 본 phase commit 수 $COMMITS (expected 1)"; exit 1; }
echo "[commit] 1 commit OK"
```

push는 phase-05.

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/tasks/plan017-interview-prep-analyzer-native/draft/SKILL.md` | 신규 (~160줄) |
| `career-os/tasks/plan017-interview-prep-analyzer-native/draft/split_topics_config.ts` | 신규 (~80줄) |

## Blocked 조건

- 원본 자산 부재 → `PHASE_BLOCKED` + `exit 2`
- topics.json 3 namespace 구조 위반 → `PHASE_BLOCKED` + `exit 2`
- draft 디렉터리 부재 → `PHASE_BLOCKED` + `exit 2`
- 자기 확인 A~E 실패 → `PHASE_FAILED: <항목>` + `exit 1`
- commit 수 ≠ 1 → `PHASE_FAILED: commit 위장 의심` + `exit 1`

## 의도 메모

- SKILL.md draft에 *baseline / daily 자연어 분기*가 핵심. study-pack-writer가 학습/Q&A/master 분기하는 패턴 참고.
- split ts는 단순 마이그 (3 namespace 추출) — dry-run 옵션으로 안전 검증.
- 옛 baseline-prompt.md / daily-prompt.md 내용은 SKILL.md draft Workflow에 흡수 (references 폐기 예정).
