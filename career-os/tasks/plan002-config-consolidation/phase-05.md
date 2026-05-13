# Phase 05 — position 자산 이동 + 통합 smoke + 옛 파일 cleanup + push

**Model**: haiku
**Status**: pending

---

## 목표

position-recommender 단일 사용 자산 4개를 `skills/position-recommender/references/`로 이동, `run_position_recommendation.sh`의 경로 갱신, 통합 smoke로 plan002의 모든 변경이 깨지지 않았는지 검증, 옛 config 파일들 일괄 cleanup, `index.json` status=completed 마킹, push.

**범위 외**: 새 기능 추가, 추가 통합, plan003 작업.

---

## 관련 docs

- `career-os/docs/adr.md` — ADR-016.
- `career-os/docs/code-architecture.md` — config/ + skills/position-recommender/ 새 트리.

## 이동 대상 (config/ → skills/position-recommender/references/)

| 원본 경로 | 새 경로 |
|---|---|
| `career-os/config/company-upside-reference.md` | `career-os/skills/position-recommender/references/company-upside-reference.md` |
| `career-os/config/position-context-index.md` | `career-os/skills/position-recommender/references/position-context-index.md` |
| `career-os/config/position-decision-criteria.md` | `career-os/skills/position-recommender/references/position-decision-criteria.md` |
| `career-os/config/verified-company-research-targets.json` | `career-os/skills/position-recommender/references/verified-company-research-targets.json` |

이 4개는 position-recommender 스킬 단일 사용. 워크스페이스 공용 config/에 있을 이유 없음 (ADR-016).

## 작업 항목

### 1. position 자산 4개 git mv

```bash
cd /home/bifos/ai-nodes

# 디렉터리 보장
mkdir -p career-os/skills/position-recommender/references

# git mv (history 보존)
git mv career-os/config/company-upside-reference.md          career-os/skills/position-recommender/references/
git mv career-os/config/position-context-index.md            career-os/skills/position-recommender/references/
git mv career-os/config/position-decision-criteria.md        career-os/skills/position-recommender/references/
git mv career-os/config/verified-company-research-targets.json career-os/skills/position-recommender/references/

ls -la career-os/skills/position-recommender/references/
```

### 2. `run_position_recommendation.sh` 경로 갱신

grep으로 옛 경로 위치 모두 찾고:

```bash
cd /home/bifos/ai-nodes
grep -n "config/company-upside\|config/position-context-index\|config/position-decision-criteria\|config/verified-company-research-targets" \
  career-os/skills/position-recommender/scripts/run_position_recommendation.sh
```

각 경로를 `$TASK_ROOT/skills/position-recommender/references/<basename>`로 교체.

`SKILL.md`나 `references/position-recommendation-prompt.md`에서 옛 경로 prose 인용도 함께 갱신 (검색 + 교체).

### 3. 옛 config 파일 일괄 cleanup (plan002의 phase-02/03/04에서 보존했던 것들)

git rm으로 삭제:

```bash
cd /home/bifos/ai-nodes

# Phase 02 잔존: 5 topic configs
git rm career-os/config/study-pack-topics.json \
       career-os/config/study-topic-candidates.json \
       career-os/config/study-pack-maintainer-topics.json \
       career-os/config/experience-question-bank-topics.json \
       career-os/config/interview-master-topics.json \
       career-os/config/cj-foodville-bootcamp-topics.json

# Phase 03 잔존: 3 source configs
git rm career-os/config/tech-blog-sources.json \
       career-os/config/ai-topic-sources.json \
       career-os/config/geek-news-sources.json

# Phase 04 잔존: baseline txt
git rm career-os/config/baseline-core-files.txt
```

만약 git rm이 "not in index" 에러를 내면 phase-02/03/04 중 하나가 미완 — `PHASE_BLOCKED: phase-N 미완 상태` 출력 후 종료.

### 4. 최종 config/ 디렉터리 확인

```bash
cd /home/bifos/ai-nodes
ls -la career-os/config/
```

기대 내용 (9개 + dotfile):

```
mvp-target.json
candidate-profile.md
topics.json
sources.json
baseline-core-files.json
topic-file-map.json
live-coding-seed-pool.json
live-coding-seed-candidates.json
.env
.env.example
.gitignore
```

(opinionated: 정확히 11개 entries 카운트로 검증.)

### 5. 통합 smoke

dispatcher의 모든 case가 syntax + config 읽기 통과하는지:

```bash
cd /home/bifos/ai-nodes/career-os

# 5-1. 모든 runner 셸 / 파이썬 syntax
for f in skills/cj-oliveyoung-java-backend-prep/scripts/run_now.sh \
         skills/cj-oliveyoung-java-backend-prep/scripts/run_baseline.sh \
         skills/cj-oliveyoung-java-backend-prep/scripts/run_daily.sh \
         skills/cj-oliveyoung-java-backend-prep/scripts/run_smoke_test.sh \
         skills/cj-oliveyoung-java-backend-prep/scripts/run_morning_topic_recommendation.sh \
         skills/cj-oliveyoung-java-backend-prep/scripts/run_replenish_topic_reservoir.sh \
         skills/cj-oliveyoung-java-backend-prep/scripts/run_cj_foodville_bootcamp.sh \
         skills/study-pack-writer/scripts/run_study_pack.sh \
         skills/study-pack-maintainer/scripts/run_maintainer.sh \
         skills/experience-question-bank-writer/scripts/run_question_bank.sh \
         skills/interview-master-writer/scripts/run_master.sh \
         skills/position-recommender/scripts/run_position_recommendation.sh \
         skills/cj-foodville-coffeechat-prep/scripts/run_foodville_coffeechat_prep.sh \
         skills/fos-study-pack/scripts/run_from_request.sh; do
  bash -n "$f" || { echo "PHASE_FAILED: bash syntax $f"; exit 1; }
done

for f in skills/study-pack-writer/scripts/resolve_study_pack_topic.py \
         skills/experience-question-bank-writer/scripts/resolve_question_bank_topic.py \
         skills/interview-master-writer/scripts/resolve_master_topic.py \
         skills/study-pack-maintainer/scripts/resolve_maintainer_topic.py \
         skills/cj-oliveyoung-java-backend-prep/scripts/refresh_topic_inventory.py \
         skills/cj-oliveyoung-java-backend-prep/scripts/replenish_topic_reservoir.py \
         skills/cj-oliveyoung-java-backend-prep/scripts/promote_candidate_topics.py \
         skills/cj-oliveyoung-java-backend-prep/scripts/build_target_file_list.py \
         skills/fos-study-pack/scripts/resolve_freeform_study_pack.py; do
  python3 -m py_compile "$f" || { echo "PHASE_FAILED: python syntax $f"; exit 1; }
done

# 5-2. 모든 새 config JSON valid
for c in topics.json sources.json baseline-core-files.json mvp-target.json topic-file-map.json live-coding-seed-pool.json live-coding-seed-candidates.json; do
  python3 -c "import json; json.load(open('config/$c'))" || { echo "PHASE_FAILED: invalid JSON config/$c"; exit 1; }
done
echo "all configs valid JSON"

# 5-3. 옛 config 파일들이 진짜로 사라졌는지
for old in study-pack-topics.json study-topic-candidates.json study-pack-maintainer-topics.json \
           experience-question-bank-topics.json interview-master-topics.json cj-foodville-bootcamp-topics.json \
           tech-blog-sources.json ai-topic-sources.json geek-news-sources.json \
           baseline-core-files.txt \
           company-upside-reference.md position-context-index.md position-decision-criteria.md verified-company-research-targets.json; do
  if [[ -e "config/$old" ]]; then
    echo "PHASE_FAILED: old config still exists: $old"
    exit 1
  fi
done
echo "old configs all gone"

# 5-4. 코드에서 옛 파일명 잔존 0건
for old in study-pack-topics study-topic-candidates study-pack-maintainer-topics \
           experience-question-bank-topics interview-master-topics cj-foodville-bootcamp-topics \
           tech-blog-sources ai-topic-sources geek-news-sources \
           baseline-core-files\\.txt; do
  count=$(grep -rln "$old" skills/ 2>/dev/null | wc -l)
  if [[ $count -gt 0 ]]; then
    echo "PHASE_FAILED: $old still referenced in $count file(s)"
    grep -rln "$old" skills/ 2>/dev/null
    exit 1
  fi
done
echo "no old-name references in code"
```

### 6. `index.json` status=completed 마킹

```bash
cd /home/bifos/ai-nodes
python3 - <<'PY'
import json
from pathlib import Path
p = Path("career-os/tasks/plan002-config-consolidation/index.json")
data = json.loads(p.read_text(encoding="utf-8"))
data["status"] = "completed"
data["current_phase"] = 5
for phase in data["phases"]:
    phase["status"] = "completed"
p.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print("[index.json] marked completed")
PY
```

### 7. 최종 commit + push

```bash
cd /home/bifos/ai-nodes
git add -A career-os/
git commit -m "$(cat <<'EOF'
refactor(career-os): position 자산 references/ 이동 + 옛 config cleanup + plan002 완료

ADR-016 마지막 단계.

- career-os/config/{company-upside-reference, position-context-index, position-decision-criteria}.md + verified-company-research-targets.json → skills/position-recommender/references/ 로 git mv. position-recommender 단일 사용 자산이라 워크스페이스 공용 config/ 밖으로.
- run_position_recommendation.sh / SKILL.md / prompt 경로 갱신.
- 옛 9 config 파일 삭제 (5 topic + 3 source + baseline txt).
- 통합 smoke 통과: bash/python syntax + JSON validity + 옛 이름 참조 0건.
- plan002 task index.json status=completed 마킹.
EOF
)"

git push origin main
```

push 실패 시 `PHASE_FAILED: push 실패 (<git stderr>)` 출력 후 종료.

## Critical Files

본 phase가 만지는 파일이 가장 많지만 대부분 git rm 또는 git mv. 새 파일은 0 (이전 phase들이 다 만듦).

| 변경 종류 | 파일 |
|---|---|
| 이동 (git mv) | 4 position 자산 |
| 삭제 (git rm) | 9 옛 config 파일 |
| 수정 | run_position_recommendation.sh, SKILL.md, prompt md, index.json |

## 검증

위 5번 작업 안 모든 항목이 검증이다. 모두 통과해야 마지막 commit + push.

추가 검증:
- 최종 `config/` 디렉터리에 정확히 9 파일 + 3 dotfile (.env, .env.example, .gitignore) = 12 entries.

```bash
cd /home/bifos/ai-nodes
count=$(ls -1A career-os/config/ | wc -l)
echo "config/ entries: $count"
# 기대: 12
[[ "$count" -eq 12 ]] || { echo "PHASE_FAILED: config/ entry count mismatch (expected 12, got $count)"; exit 1; }
```

## 의도 메모

- haiku 모델 — 결정적 cleanup + 검증 위주, 큰 추론 불필요.
- 모든 phase의 산출물이 합쳐지는 마지막 단계라 통합 smoke가 plan002 전체의 안전망.
- push는 본 phase에서만 — 중간 phase가 깨져도 main은 안 더러워짐.

## Blocked 조건

**중요 — exit code 명시**: 아래 어느 마커든 출력만 하지 말고 반드시 `sys.exit(1)` (FAILED) 또는 `sys.exit(2)` (BLOCKED) — shell에서는 `exit 1` / `exit 2` — 비-0 exit code로 종료한다. 마커만 출력하고 정상 종료하면 `run-phases.py`가 success로 잘못 처리한다 (plan001-adr-cleanup 1차 실행 사례).

- phase-02/03/04 중 하나라도 미완 (옛 config가 코드에서 여전히 참조됨) → `PHASE_BLOCKED: 선행 phase 미완` + `exit 2`
- 통합 smoke 실패 → `PHASE_FAILED: <어느 검증>` + `exit 1`
- push 실패 → `PHASE_FAILED: push` + `exit 1`
- config/ entry count mismatch → `PHASE_FAILED: config 잔존 또는 추가 파일` + `exit 1`
