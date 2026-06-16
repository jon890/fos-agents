# Phase 01 — ④ SKILL.md Workflow 3 ↔ prompt.md 14 라벨 정합 + 줄 수 상한 완화

**Model**: sonnet
**Status**: pending

---

## 목표

position-recommender 실제 호출 평가에서, SKILL.md Workflow 3이 파싱 라벨 8개만 명시하고
`references/position-recommendation-prompt.md`는 출력 라벨 14개를 정의해 둘이 어긋났다.
그 결과 산출물이 8 라벨만 따르고 prompt.md의 풍부한 라벨(회사/규모 업사이드·복지/학습 환경·기술블로그 시그널·리스크·경험 근거·JD 키워드)이 누락됐다.

이 phase는 SKILL.md Workflow 3의 필수 라벨을 prompt.md 14 라벨에 맞춰 확장하고,
Self-check 16항목에 새 라벨을 반영하며, "총 30~70줄 권장" 상한을 "판단 근거 충실 우선, 줄 수 상한 강제 안 함"으로 완화한다.
SKILL.md와 prompt.md가 같은 라벨 셋을 가리키게 만드는 것이 목표다.

**범위 외**:
- live-postings policy/adapter 코드(phase-02·03·04 책임)는 건드리지 않는다.
- `career-os/docs/*.md`·`career-os/AGENTS.md`는 수정하지 않는다. 이 phase는 스킬 본문(SKILL.md + references) 정합만 한다.
- 출력 정책 자체(`references/output-policy.md`)는 변경하지 않는다.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다. 본 phase는 ai-nodes 루트 기준 path를 쓰므로 첫 bash에서 루트로 고정한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트 (career-os의 부모)
```

Bash 도구는 같은 phase 안 cwd를 보존한다. Edit/Write는 절대경로/루트 기준 경로라 cwd와 무관하다.

---

## 관련 docs

실행 전 반드시 Read로 현재 본문을 확인한다:
- `career-os/.claude/skills/position-recommender/SKILL.md` — "### 3. 추천 분석 + 리포트 작성"(Workflow 3) 섹션, 그리고 "## Self-check" 16항목.
- `career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md` — "## 포매팅 규칙" + "## 강력 추천 포지션"의 라벨 정의.

prompt.md의 14 라벨(강력 추천 포지션 항목 기준, 실행 시 재확인한다):
1. 공고 링크
2. 탐색 링크
3. 링크 근거 수준
4. 공고 기간
5. 검색 키워드
6. 왜 맞는가
7. 후보자 경험 근거
8. JD에서 노려야 할 키워드
9. 회사/규모 업사이드
10. 복지/학습 환경 판단
11. 기술블로그/엔지니어링 시그널
12. 사업/조직/seniority 리스크
13. 확인해야 할 모호점
14. 준비 액션

현재 SKILL.md Workflow 3 끝의 파싱 라벨 8개(실행 시 재확인한다):
`공고 링크`, `탐색 링크`, `링크 근거 수준`, `공고 기간`, `검색 키워드`, `왜 맞는가`, `확인해야 할 모호점`, `준비 액션`.

---

## 작업 항목 (4)

**반드시 Edit 도구를 직접 호출한다. prose 응답으로 "정합했다"고 끝내면 PHASE_FAILED다.**

### 1. SKILL.md Workflow 3 필수 라벨을 14개로 확장

`career-os/.claude/skills/position-recommender/SKILL.md`의 "### 3. 추천 분석 + 리포트 작성" 섹션에서,
끝부분 "추천 티어 항목은 runner가 아래 라벨을 파싱하므로 정확히 유지한다." 아래 라벨 목록을
prompt.md 14 라벨과 동일하게 맞춘다. 현재 8개에서 누락된 6개(후보자 경험 근거 / JD에서 노려야 할 키워드 / 회사/규모 업사이드 / 복지/학습 환경 판단 / 기술블로그/엔지니어링 시그널 / 사업/조직/seniority 리스크)를 추가한다.

라벨 문자열은 prompt.md와 **글자 그대로 일치**해야 한다(파싱·정합 grep 대상). prompt.md를 단일 출처로 보고 그 표기를 그대로 옮긴다.

### 2. SKILL.md 줄 수 상한 완화

같은 Workflow 3 섹션의 "총 30~70줄 권장. 판단에 필요한 근거만 남기고 장문 회사 설명은 쓰지 않는다." 문장을
"판단 근거를 충실히 담는 것을 우선한다. 줄 수 상한은 강제하지 않으며, 다만 장문 회사 설명·JD 원문 재서술은 쓰지 않는다."로 바꾼다.
라벨이 14개로 늘어 30~70줄 상한이 근거 충실성과 충돌하므로 상한을 강제하지 않는다.

### 3. Self-check 16항목에 새 라벨 반영

`career-os/.claude/skills/position-recommender/SKILL.md`의 "## Self-check" 항목 중:
- 줄 수 하한 관련(현재 "총 줄 수 ≥ 30")은 유지하되, 줄 수 *상한* 단정이 있으면 제거한다(상한 완화와 일관).
- 14 라벨 중 새로 추가한 라벨(특히 `후보자 경험 근거`, `JD에서 노려야 할 키워드`, `회사/규모 업사이드`, `복지/학습 환경 판단`, `기술블로그/엔지니어링 시그널`, `사업/조직/seniority 리스크`)이 강력 추천/도전 추천 항목에 존재하는지 확인하는 self-check 항목을 1개 추가한다(16항목 → 17항목, 또는 기존 항목 보강).
- 새 항목을 추가하면 "## Self-check" 도입 문구의 "16항목" 숫자를 실제 항목 수와 맞춘다.

### 4. SKILL.md ↔ prompt.md 라벨 셋 일치 자체 점검

작업 직후, SKILL.md Workflow 3 라벨 목록과 prompt.md 강력 추천 포지션 라벨이 같은 14개 셋을 가리키는지 스스로 grep으로 확인한다(검증 섹션에서 다시 한다).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/SKILL.md` | Workflow 3 라벨 8→14 확장, 줄 수 상한 완화, Self-check 라벨 반영 |
| `career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md` | 단일 출처(읽기 기준). 라벨 표기가 SKILL.md와 어긋나면 prompt.md를 기준으로 SKILL.md를 맞춘다. 필요 시 prompt.md 자체 오타만 보정 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"
SKILL=career-os/.claude/skills/position-recommender/SKILL.md
PROMPT=career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md

# 1. 새로 추가해야 하는 6개 라벨이 SKILL.md에 모두 등장
MISS=0
for L in "후보자 경험 근거" "JD에서 노려야 할 키워드" "회사/규모 업사이드" "복지/학습 환경 판단" "기술블로그/엔지니어링 시그널" "사업/조직/seniority 리스크"; do
  if ! grep -qF "$L" "$SKILL"; then echo "FAIL: SKILL.md 라벨 누락 -> $L"; MISS=1; fi
done
[ "$MISS" = "0" ] && echo "[SKILL.md 신규 6라벨] OK"
[ "$MISS" = "0" ] || exit 1

# 2. 같은 라벨이 prompt.md에도 존재(둘이 같은 셋을 가리키는지)
MISS=0
for L in "후보자 경험 근거" "JD에서 노려야 할 키워드" "회사/규모 업사이드" "복지/학습 환경 판단" "기술블로그/엔지니어링 시그널" "사업/조직/seniority 리스크"; do
  if ! grep -qF "$L" "$PROMPT"; then echo "FAIL: prompt.md 라벨 누락 -> $L"; MISS=1; fi
done
[ "$MISS" = "0" ] && echo "[prompt.md 동일 6라벨] OK"
[ "$MISS" = "0" ] || exit 1

# 3. 줄 수 상한 강제 문구 제거 확인 — "30~70줄 권장" 잔존 없음
LEFT=$(grep -cF "30~70줄" "$SKILL")
echo "[30~70줄 상한 문구 잔존] $LEFT"
[ "$LEFT" = "0" ] || { echo "FAIL: 줄 수 상한 문구 잔존"; exit 1; }

# 4. 줄 수 하한 self-check는 유지(총 줄 수 하한 표현 존재)
grep -qE "총 줄 수 ≥|줄 수.*≥|줄 수 하한" "$SKILL" && echo "[줄 수 하한 self-check 유지] OK" || echo "[참고] 줄 수 하한 표현 미검출 — 의도 확인"

echo "✅ Phase 01 검증 명령 실행 완료"
```

## commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/.claude/skills/position-recommender/SKILL.md \
        career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
docs(career-os): position-recommender SKILL.md Workflow 3을 prompt.md 14 라벨로 정합

- Workflow 3 필수 라벨 8개를 prompt.md 14 라벨에 맞춰 확장
  (후보자 경험 근거·JD 키워드·회사/규모 업사이드·복지/학습·기술블로그 시그널·리스크 추가)
- 총 30~70줄 권장 상한을 판단 근거 충실 우선으로 완화(줄 수 상한 강제 안 함)
- Self-check에 신규 라벨 존재 확인 항목 반영

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
# Write 위장 방어: 이 phase가 실제 commit을 만들었는지 self-check
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성 — Edit이 실제 실행 안 됨"; exit 1; }
git log --oneline -1
```

## 의도 메모 (왜)

- SKILL.md Workflow 3과 prompt.md가 어긋나면, 산출물이 어느 쪽을 따를지 불안정해진다. 평가에서 8 라벨만 따라 풍부한 판단 근거 6종이 통째로 빠졌다. prompt.md를 단일 출처로 두고 SKILL.md를 맞춘다(거울 구조 — 같은 정의를 두 곳에 본문으로 쓰지 않되, Workflow 3의 파싱 라벨 목록은 prompt.md와 동일 셋을 가리키기만 하면 된다).
- 줄 수 상한을 완화하는 이유 — 라벨이 14개로 늘면 항목당 줄 수가 커져 30~70줄 상한이 근거 충실성과 충돌한다. 사용자 결정: 판단 근거 충실 우선.
- docs/AGENTS.md를 건드리지 않는 이유 — 이 변경은 스킬 본문 정합이라 5문서/정책 문서 영향이 없다. 구현 phase가 정책 문서를 새로 고치지 않는다는 운영 원칙(AGENTS.md)을 지킨다.

## Blocked 조건

- prompt.md의 14 라벨 표기가 본 phase 관련 docs에 적힌 것과 크게 다르거나, "강력 추천 포지션" 라벨 블록 자체를 grep으로 못 찾으면(파일 구조 변경 등) `PHASE_BLOCKED: prompt.md 라벨 블록 부재 — 문서 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 검증에서 신규 6라벨이 SKILL.md/prompt.md 양쪽에 정합되지 않으면 `PHASE_FAILED: 라벨 정합 미완료` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
