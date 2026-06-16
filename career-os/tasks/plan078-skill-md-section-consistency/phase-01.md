# Phase 01 — References 섹션 없는 4개 스킬에 References 추가

**Model**: sonnet
**Status**: pending

---

## 목표

References 섹션이 없는 4개 SKILL.md에 모범 스킬과 동일 구조의 `## References` 섹션을 추가한다.

대상 스킬:
- `career-os/.claude/skills/interview-asset-writer/SKILL.md`
- `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md`
- `career-os/.claude/skills/interview-prep-analyzer/SKILL.md`
- `career-os/.claude/skills/study-topic-recommender/SKILL.md`

현재 이들은 ADR 참조가 "Why this design" 섹션 안에만 산재해 있다. 모범 스킬(application-package-writer, application-reviewer, daily-application-digest)의 References는 관련 ADR + 핵심 docs 포인터 + 관련 스킬 cross-ref를 담는다. 이 구조를 따른다.

**범위 외**:
- `docs/*.md`·`AGENTS.md` 수정 금지. 권장 섹션 명문화는 선행 commit(548cef2)에서 이미 끝났다.
- Self-check 헤더 레벨 통일은 Phase 02 책임이다.
- references/ 디렉터리 파일이나 scripts/는 만들지 않는다. SKILL.md 본문에 `## References` 섹션 텍스트만 추가한다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

Edit 도구는 절대경로를 받으므로 cwd와 무관하다. cwd 고정은 grep/git 검증용이다.

---

## 관련 docs

실행 전 읽을 것:
- `career-os/docs/code-architecture.md`의 "### SKILL.md 권장 섹션 구성" — References는 "ADR 재나열이 아니라 관련 스킬 cross-ref와 핵심 docs 포인터" 역할.
- 모범 사례: `career-os/.claude/skills/application-package-writer/SKILL.md`의 `## References` 섹션 형식을 먼저 읽고 그 문체·구성을 따른다.

---

## 작업 항목 (4)

**반드시 Edit 도구를 호출한다. prose 응답만으로 "추가했다"고 끝내면 PHASE_FAILED다.**

각 스킬마다: 먼저 SKILL.md를 Read해 "Why this design" 섹션에 인용된 ADR 번호와 본문이 참조하는 관련 스킬·docs·config 경로를 파악한 뒤, SKILL.md 맨 끝에 `## References` 섹션을 추가한다.

References 항목 구성(모범 스킬 패턴):
- 관련 ADR 번호 — `career-os/docs/adr.md` ADR-NN (한 줄 설명).
- 핵심 docs 포인터 — 이 스킬이 따르는 data-schema.md/flow.md 등.
- 관련 스킬 cross-ref — 라우팅으로 연결되는 다른 스킬.
- references/ 파일이 있으면 그 경로(없으면 생략).

### 1. interview-asset-writer
Read 후 "Why this design"의 ADR/관련 스킬(study-pack-writer 라우팅 등)을 추출해 `## References` 추가.

### 2. candidate-baseline-suggester
ADR-028 + audit-trail-format.md(references/) + 관련 docs를 `## References`로 정리.

### 3. interview-prep-analyzer
ADR-027·ADR-048 + 관련 스킬(question-bank-collector 등) cross-ref를 `## References`로 정리.

### 4. study-topic-recommender
ADR-026·ADR-070 + 관련 scripts/docs 포인터를 `## References`로 정리.

ADR 번호와 경로는 각 SKILL.md 본문에서 실제로 확인한 것만 적는다. 추측으로 ADR 번호를 만들지 않는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/interview-asset-writer/SKILL.md` | `## References` 섹션 추가 |
| `career-os/.claude/skills/candidate-baseline-suggester/SKILL.md` | `## References` 섹션 추가 |
| `career-os/.claude/skills/interview-prep-analyzer/SKILL.md` | `## References` 섹션 추가 |
| `career-os/.claude/skills/study-topic-recommender/SKILL.md` | `## References` 섹션 추가 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.

```bash
cd "$(git rev-parse --show-toplevel)"
MISSING=0
for s in interview-asset-writer candidate-baseline-suggester interview-prep-analyzer study-topic-recommender; do
  f="career-os/.claude/skills/$s/SKILL.md"
  CNT=$(grep -c "^## References" "$f")
  echo "[$s] ## References: $CNT"
  [ "$CNT" -ge 1 ] || MISSING=1
done
[ "$MISSING" = "0" ] && echo "OK: 4개 스킬 모두 References 추가" || { echo "FAIL: References 누락"; exit 1; }

# docs/AGENTS는 안 건드렸는지 (범위 격리)
DOCS_DIRTY=$(git status --short career-os/docs/ career-os/AGENTS.md | wc -l | tr -d ' ')
echo "[docs/AGENTS dirty] $DOCS_DIRTY"
[ "$DOCS_DIRTY" = "0" ] || { echo "FAIL: 범위 밖 docs 변경"; exit 1; }

echo "✅ Phase 01 검증 명령 실행 완료"
```

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/.claude/skills/interview-asset-writer/SKILL.md \
        career-os/.claude/skills/candidate-baseline-suggester/SKILL.md \
        career-os/.claude/skills/interview-prep-analyzer/SKILL.md \
        career-os/.claude/skills/study-topic-recommender/SKILL.md
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(career-os): References 없는 4개 스킬 SKILL.md에 References 섹션 추가

- interview-asset-writer / candidate-baseline-suggester
- interview-prep-analyzer / study-topic-recommender
- Why this design에 산재하던 ADR 참조 + 관련 스킬 cross-ref + docs 포인터 정리
- code-architecture.md 권장 섹션 구성(plan078 ③) 적용

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
git log --oneline -1
```

## 의도 메모 (왜)

- References가 ADR을 단순 재나열하면 "Why this design"과 중복이다. 관련 스킬 cross-ref와 docs 포인터를 더해 다른 가치를 준다(모범 스킬 패턴).
- skill-creator 철학상 "weight 없는 섹션"은 피한다 — References는 라우팅·근거 추적의 단일 진입점 역할을 할 때만 가치가 있다.

## Blocked 조건

- 특정 스킬에서 "Why this design"이나 본문에 ADR/참조가 전혀 없어 References에 담을 내용이 없으면, 그 스킬은 `PHASE_BLOCKED: <skill> 참조 내용 부재` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
