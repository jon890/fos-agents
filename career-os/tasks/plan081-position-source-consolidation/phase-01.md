# Phase 01 — ④ 검증 회사군 config 정합 (JSON config/ 이동 + 텍스트 흡수·역참조 + hasAdapter 스키마)

**Model**: sonnet
**Status**: pending

---

## 목표

검증 회사군(추천 시 회사 업사이드 판단 + 추가 수집 대상 가이드)이 세 곳에 분산돼 drift가 생겼다(ADR-090).

- `references/verified-company-research-targets.json` — 7개, 구조화(career URL·기술블로그·선호 도메인).
- `references/position-decision-criteria.md`·`position-recommendation-prompt.md` — 텍스트 "최우선 탐색군"에 12개+ 회사를 나열, 서로 거의 같은 문장으로 중복. JSON에 카카오뱅크·카카오모빌리티·무신사·컬리·야놀자가 빠져 있다.

ADR-090 결정대로 이 phase는 검증 회사군 JSON을 `references/`에서 `config/verified-company-research-targets.json`으로 옮겨 단일 출처로 두고,
텍스트 "최우선 탐색군" 목록의 회사를 JSON `priorityCompanies`에 흡수하며,
코드(adapter discovery)와 LLM 주입 양방향 소비를 위한 `hasAdapter`·`adapterId` 필드를 추가한다.
텍스트 2곳의 "최우선 탐색군" 목록은 제거하고 JSON을 역참조한다(거울 구조).
JSON 경로를 참조하는 모든 스킬 본문의 path를 `references/`→`config/`로 고친다.

**범위 외**:
- `career-os/docs/adr/`·`career-os/docs/data-schema.md`는 건드리지 않는다. ADR-090과 data-schema의 config 스키마 섹션은 이미 docs-first 커밋(d2f337c)에 반영됐다.
- 코드가 이 JSON을 읽어 adapter를 라우팅하는 wire-up은 plan082 책임이다. 이번엔 스키마 확정 + 파일 이동 + 텍스트 정합만 한다.
- policy.ts·naver-careers.ts 코드는 phase-02·03 책임이라 건드리지 않는다.

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
- `career-os/docs/adr/ADR-090-검증-회사군을-json-단일-출처로-둔다.md` — 결정 근거(읽기 전용, 수정 금지).
- `career-os/docs/data-schema.md` — "### config/verified-company-research-targets.json" 섹션의 양방향 스키마 표(읽기 전용, 수정 금지). 흡수·필드 추가가 이 스키마와 일치해야 한다.
- `career-os/.claude/skills/position-recommender/references/verified-company-research-targets.json` — 이동 대상 원본(현재 7개 priorityCompanies).
- `career-os/.claude/skills/position-recommender/references/position-decision-criteria.md` — "최우선 탐색군" 문장(현재 40번 줄 근처).
- `career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md` — "최우선 탐색군" 문장(현재 16번 줄 근처) + JSON 경로 참조(현재 32번 줄 근처).
- `career-os/.claude/skills/position-recommender/SKILL.md` — Inputs 8번(현재 47번 줄 근처) + Reference 목록(현재 232번 줄 근처)의 JSON 경로.
- `career-os/.claude/skills/position-recommender/references/verified-company-discovery.md` — JSON 경로 참조(현재 7번 줄 근처).
- `career-os/.claude/skills/position-recommender/references/position-context-index.md` — JSON 경로 참조(현재 25번 줄 근처).

data-schema.md의 양방향 스키마 필드(실행 시 재확인한다):

| 필드 | 소비자 | 설명 |
|---|---|---|
| `company`, `koreanName`, `tier` | 공통/LLM | 회사명·검증 티어 |
| `hasAdapter`, `adapterId` | 코드 | 수집 adapter 커버리지·라우팅. `false`는 adapter 추가 backlog |
| `careerUrls`, `wantedKeywords` | 코드+LLM | discovery entrypoint + 탐색 키워드 |
| `preferredDomains`, `techBlogs`, `notes` | LLM | 회사 업사이드 판단 근거 |

---

## 작업 항목 (5)

**반드시 Edit/Write/git mv 도구를 직접 호출한다. prose 응답으로 "정합했다"고 끝내면 PHASE_FAILED다.**

### 1. JSON을 references/에서 config/로 이동

`git mv`로 파일을 옮긴다(history 보존). cwd는 ai-nodes 루트다.

```bash
git mv career-os/.claude/skills/position-recommender/references/verified-company-research-targets.json \
       career-os/config/verified-company-research-targets.json
```

이동 후 `references/`에 원본이 남지 않아야 한다. 심링크를 새로 만들지 않는다(SKILL.md 경로를 직접 고치는 방식, 작업 항목 4).

### 2. 텍스트 "최우선 탐색군" 회사를 JSON priorityCompanies에 흡수 + hasAdapter 필드 추가

`config/verified-company-research-targets.json`(이동 후 경로)을 Edit한다.

먼저 기존 7개 회사(KakaoPay·NAVER·LINE·Coupang·Bucketplace·Woowa Bros·Karrot) 각각에 `hasAdapter`·`adapterId`를 추가한다. 현재 adapter가 있는 회사는 `true`로, 나머지는 `false`로 둔다.

현재 adapter가 있는 회사(`hasAdapter: true`): 카카오페이(`adapterId: "kakaopay"` 형태 — 실제 adapter id는 `career-os/scripts/position-recommender/live-postings/adapters/index.ts`의 ADAPTERS 키로 재확인한다), 쿠팡, 토스, 카카오모빌리티, 네이버(`naver-careers`). adapterId 문자열은 추측하지 말고 index.ts ADAPTERS 키와 SOURCE_ALIASES를 실측해 그 값으로 채운다. 매칭되는 키가 없으면 `hasAdapter: false`로 두고 `adapterId: null`.

다음으로 텍스트 "최우선 탐색군"에만 있고 JSON에 없는 회사를 새 항목으로 추가한다. 최소 추가 대상:
- 카카오뱅크 (KakaoBank)
- 카카오모빌리티 (KakaoMobility) — `hasAdapter: true`(adapter 존재 확인되면), `adapterId`는 실측 키.
- 무신사 (MUSINSA)
- 컬리 (Kurly)
- 야놀자 (Yanolja)

추가 회사는 기존 7개 항목과 같은 구조(`tier`·`company`·`koreanName`·`careerUrls`·`wantedKeywords`·`techBlogs`·`preferredDomains`·`notes` + `hasAdapter`·`adapterId`)를 갖춘다. careerUrls·techBlogs·preferredDomains·notes는 텍스트 "최우선 탐색군" 문맥과 일반 상식 범위에서 채우되, 불확실한 URL은 추측해 넣지 말고 회사 공식 채용 도메인만 careerUrls에 넣고 모호하면 notes에 "공식 채용 URL 재확인 필요"를 적는다. 당근페이·쿠팡페이·네이버파이낸셜 계열은 이미 있는 Karrot·Coupang·NAVER 항목의 `wantedKeywords`/`notes`에 계열 키워드로 흡수하거나, 별도 분리가 명백히 더 맞으면 항목을 추가한다(중복 회사 항목을 만들지 않는다).

최종 priorityCompanies 회사 수가 12개 이상이어야 한다(현재 7 → 12+).

JSON write 시 trailing newline을 보존한다(원본도 trailing newline 있음). `_meta`·`discoveryChecklist`는 그대로 둔다.

### 3. decision-criteria.md·prompt.md의 "최우선 탐색군" 목록 제거 + JSON 역참조

`references/position-decision-criteria.md`에서 "최우선 탐색군은 LINE/LINE Plus ... 야놀자다." 한 줄(현재 40번 줄)을, 회사 목록을 나열하지 않고 config JSON을 역참조하는 문장으로 교체한다. 예: "최우선 탐색군은 `config/verified-company-research-targets.json`의 priorityCompanies를 단일 출처로 본다."

`references/position-recommendation-prompt.md`에서 "최우선 탐색군은 LINE/LINE Plus ... 먼저 파라." 한 줄(현재 16번 줄)을 같은 방식으로 교체한다. 회사 도메인 deep dive 가이드(Core Platform·Payment/Settlement 등) 문장은 회사 나열이 아니므로 유지해도 되지만, 회사명 enumerated list는 제거하고 JSON 역참조로 바꾼다.

두 파일 모두에서 "야놀자다", "컬리, 야놀자" 같은 회사 enumerated 나열이 남지 않아야 한다(검증 grep 대상).

### 4. JSON 경로 참조를 references/→config/로 변경

JSON path를 인용하는 모든 스킬 본문을 Edit한다. 실측으로 잔존 경로를 찾아 전부 고친다(grep으로 재확인):

- `SKILL.md` Inputs 8번 — `references/verified-company-research-targets.json` → `config/verified-company-research-targets.json`.
- `SKILL.md` Reference 목록(끝부분) — 같은 경로 변경.
- `references/position-recommendation-prompt.md` 32번 줄 근처 — `skills/position-recommender/references/verified-company-research-targets.json` → `config/verified-company-research-targets.json`.
- `references/verified-company-discovery.md` 7번 줄 근처 — 같은 경로 변경.
- `references/position-context-index.md` 25번 줄 근처 — `references/verified-company-research-targets.json` → `config/verified-company-research-targets.json`.

`references/archive/kakao-company-research.json` 안의 `"source": "...references/verified-company-research-targets.json ..."` 문자열은 archive 기록이므로 건드리지 않는다.

### 5. 잔재 확인

`references/` 디렉터리에 원본 JSON이 남지 않았는지, 심링크 잔재가 없는지 확인한다(검증 섹션에서 다시 한다).

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/.claude/skills/position-recommender/references/verified-company-research-targets.json` | `git mv`로 `config/`로 이동(원본 제거) |
| `career-os/config/verified-company-research-targets.json` | 이동 후 — 기존 7개에 hasAdapter·adapterId 추가 + 회사 5개+ 흡수(7→12+) |
| `career-os/.claude/skills/position-recommender/references/position-decision-criteria.md` | "최우선 탐색군" 회사 나열 제거 + JSON 역참조 |
| `career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md` | "최우선 탐색군" 회사 나열 제거 + JSON 역참조 + 32번 줄 경로 변경 |
| `career-os/.claude/skills/position-recommender/SKILL.md` | Inputs 8번 + Reference 목록 경로 변경 |
| `career-os/.claude/skills/position-recommender/references/verified-company-discovery.md` | JSON 경로 변경 |
| `career-os/.claude/skills/position-recommender/references/position-context-index.md` | JSON 경로 변경 |

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"
NEW=career-os/config/verified-company-research-targets.json
OLD=career-os/.claude/skills/position-recommender/references/verified-company-research-targets.json

# 1. config 파일 존재 + references 원본 부재
[ -f "$NEW" ] && echo "[config 파일 존재] OK" || { echo "FAIL: config JSON 부재"; exit 1; }
[ ! -e "$OLD" ] && echo "[references 원본 부재] OK" || { echo "FAIL: references 원본 잔존"; exit 1; }

# 2. JSON valid + 회사 수 12 이상 + hasAdapter 필드 존재
COMPANIES=$(python3 -c "import json;d=json.load(open('$NEW'));print(len(d['priorityCompanies']))")
echo "[priorityCompanies 회사 수] $COMPANIES"
[ "$COMPANIES" -ge 12 ] || { echo "FAIL: 회사 수 12 미만 (현재 $COMPANIES)"; exit 1; }
HASADAPTER=$(python3 -c "import json;d=json.load(open('$NEW'));print(sum(1 for c in d['priorityCompanies'] if 'hasAdapter' in c))")
echo "[hasAdapter 필드 보유 회사 수] $HASADAPTER"
[ "$HASADAPTER" = "$COMPANIES" ] || { echo "FAIL: 일부 회사에 hasAdapter 누락"; exit 1; }
ADAPTERID=$(python3 -c "import json;d=json.load(open('$NEW'));print(sum(1 for c in d['priorityCompanies'] if 'adapterId' in c))")
echo "[adapterId 필드 보유 회사 수] $ADAPTERID"
[ "$ADAPTERID" = "$COMPANIES" ] || { echo "FAIL: 일부 회사에 adapterId 누락"; exit 1; }

# 3. 텍스트 "최우선 탐색군" 회사 enumerated 나열 제거 (야놀자/컬리 회사명이 두 파일에 남지 않음)
CRIT=career-os/.claude/skills/position-recommender/references/position-decision-criteria.md
PROMPT=career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md
LEFT=$(grep -c "야놀자" "$CRIT" "$PROMPT" | awk -F: '{s+=$2} END {print s}')
echo "[야놀자 enumerated 잔존] $LEFT"
[ "$LEFT" = "0" ] || { echo "FAIL: 최우선 탐색군 회사 나열 잔존"; exit 1; }

# 4. 두 텍스트가 config JSON을 역참조
grep -q "config/verified-company-research-targets.json" "$CRIT" && echo "[decision-criteria 역참조] OK" || { echo "FAIL: decision-criteria 역참조 누락"; exit 1; }
grep -q "config/verified-company-research-targets.json" "$PROMPT" && echo "[prompt 역참조] OK" || { echo "FAIL: prompt 역참조 누락"; exit 1; }

# 5. references/ 경로 인용 잔재 0 (archive 제외)
RESID=$(grep -rl "references/verified-company-research-targets.json" career-os/.claude/skills/position-recommender/ --include="*.md" 2>/dev/null | grep -v "/archive/" | wc -l | tr -d ' ')
echo "[references/ 경로 잔재 파일 수] $RESID"
[ "$RESID" = "0" ] || { echo "FAIL: references/ 경로 인용 잔존"; grep -rn "references/verified-company-research-targets.json" career-os/.claude/skills/position-recommender/ --include="*.md" | grep -v "/archive/"; exit 1; }

echo "✅ Phase 01 검증 명령 실행 완료"
```

## commit

별도 worktree+branch 실행이므로 commit만 한다. push와 PR은 하지 않는다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/config/verified-company-research-targets.json \
        career-os/.claude/skills/position-recommender/references/verified-company-research-targets.json \
        career-os/.claude/skills/position-recommender/references/position-decision-criteria.md \
        career-os/.claude/skills/position-recommender/references/position-recommendation-prompt.md \
        career-os/.claude/skills/position-recommender/references/verified-company-discovery.md \
        career-os/.claude/skills/position-recommender/references/position-context-index.md \
        career-os/.claude/skills/position-recommender/SKILL.md
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
refactor(career-os): 검증 회사군 JSON을 config/로 이동하고 텍스트 목록을 흡수 (ADR-090)

- verified-company-research-targets.json을 references/에서 config/로 git mv
- 텍스트 "최우선 탐색군"(decision-criteria.md·prompt.md) 회사를 JSON priorityCompanies로 흡수 (7→12+)
- 코드+LLM 양방향 스키마 확정 — 각 회사에 hasAdapter·adapterId 추가
- 텍스트 2곳의 회사 enumerated 나열 제거 후 config JSON 역참조
- SKILL.md Inputs·Reference·discovery·context-index의 JSON 경로를 config/로 변경

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
# Write 위장 방어: 이 phase가 실제 commit을 만들었는지 self-check
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성 — Edit/git mv가 실제 실행 안 됨"; exit 1; }
git log --oneline -1
```

## 의도 메모 (왜)

- 검증 회사군이 JSON 1곳 + 텍스트 2곳에 분산돼 drift가 났다(JSON에 카카오뱅크·카카오모빌리티·무신사·컬리·야놀자 누락). ADR-090대로 config JSON을 단일 출처로 두고 텍스트를 역참조해 정의 불일치를 없앤다.
- config/로 옮기는 이유 — career-os config는 사람이 큐레이션한 정책·외부 source registry이고 코드가 읽는 설정이다(`config/sources.json`과 같은 부류). 코드 discovery + LLM 주입 양방향 소비에 맞고 data-schema.md가 스키마를 관리한다.
- hasAdapter를 추가하는 이유 — 수집 adapter 커버리지를 가시화해 adapter 추가 우선순위(`false`인 회사)를 식별한다. 코드가 JSON을 읽어 adapter를 라우팅하는 wire-up은 plan082가 이 스키마 위에서 한다.
- docs/adr/·data-schema.md를 건드리지 않는 이유 — ADR-090과 data-schema config 스키마 섹션은 이미 docs-first 커밋(d2f337c)에 반영됐다. 구현 phase가 정책·docs를 새로 고치지 않는다는 운영 원칙(AGENTS.md)을 지킨다.

## Blocked 조건

- 이동 대상 JSON(`references/verified-company-research-targets.json`)이 부재하거나 priorityCompanies 구조가 크게 달라 흡수 위치를 못 찾으면 `PHASE_BLOCKED: verified-company JSON 구조 확인 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다.
- 검증에서 회사 수 12 미만, hasAdapter 누락, 텍스트 나열 잔존, references 경로 잔재 중 하나라도 걸리면 `PHASE_FAILED: 검증 회사군 정합 미완료` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
