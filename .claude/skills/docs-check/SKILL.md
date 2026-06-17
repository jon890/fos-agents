---
name: docs-check
description: ai-nodes 모노레포의 docs 건전성을 5축으로 종합 감사하는 발견 전용 skill. "ADR 건전성 점검", "docs 감사", "stale ADR 찾기", "docs drift 확인", "5문서 건전성 감사", "코드-문서 불일치", "ADR Quick Index sync 확인", "ADR 정리 전 감사", `/docs-check [scope]`처럼 Decay, Bloat, Clarity, Duplication, Self-Evidence 점검이 필요할 때 사용. 수정은 사용자 승인 후 별도 진행한다.
---

# docs-check

ai-nodes 모노레포 docs를 **AI 에이전트가 최소 컨텍스트로 의사결정 의도를 재구성할 수 있는 상태**로 유지하는 감사 skill.

## 핵심 철학

ADR은 "코드만 보고는 알 수 없는 WHY"여야 한다. 자명한 결정·마이그레이션 기록이 누적되면 시그널 대비 노이즈 비율이 떨어져 에이전트가 잘못된 코드를 생성한다. docs-check는 발견만 한다 — 수정은 사용자 승인 후 별도 세션.

## 호출 후 scope 해석

- scope는 `career-os`, `ai-nodes`, `all` 중 하나다.
- scope가 없으면 `all`로 본다.
- plan 완료 후 또는 새 ADR 추가 후에는 Quick Index sync를 함께 확인한다.

## Inputs

현재 에이전트는 다음을 직접 로드:

1. `career-os/docs/adr/INDEX.md` + `career-os/docs/adr/ADR-*.md` 개별 파일 — career-os ADR (scope에 career-os / all 포함 시)
2. `ai-nodes/docs/adr.md` — 모노레포 레벨 ADR (scope에 ai-nodes / all 포함 시)
3. `career-os/docs/{prd,data-schema,flow,code-architecture}.md` — 5문서 나머지 4개
4. `career-os/scripts/command-router/run_now.sh` — dispatcher case 목록
5. `career-os/config/*.json` — config 파일 키 목록 (data-schema.md 정합 확인용)
6. `.claude/skills/*/SKILL.md` (career-os + ai-nodes 전역) — SKILL.md trigger 패턴 감사

## Workflow

### 0. scope 파싱 + 대상 파일 수집

```bash
# cwd: /home/bifos/ai-nodes
# scope: career-os | ai-nodes | all (default: all)
ls career-os/docs/*.md ai-nodes/docs/*.md \
   career-os/.claude/skills/*/SKILL.md \
   .claude/skills/*/SKILL.md 2>/dev/null
```

### 1. 자동화 검사 5개 (bash 선행 실행)

**반드시 Bash 도구로 다음 블록 전체를 실행한다. prose로 "확인했다"고만 응답하면 PHASE_FAILED.**

#### 자동화-1. ADR Quick Index ↔ 본문 sync

```bash
# career-os: adr/ 개별 파일 + INDEX.md 구조 (ai-nodes ADR-015 파일럿)
echo "=== career-os/docs/adr/ ==="
INDEX_FILE="career-os/docs/adr/INDEX.md"
if [ -f "$INDEX_FILE" ]; then
  # 개별 파일 헤더 기준 ADR 번호
  BODY=$(grep -rhoE '^## ADR-[0-9]+' career-os/docs/adr/ | grep -oE 'ADR-[0-9]+' | sort -u)
  # INDEX.md 에 링크된 ADR 번호
  INDEX=$(grep -oE 'ADR-[0-9]+' "$INDEX_FILE" | sort -u | head -200)
  for n in $BODY; do
    echo "$INDEX" | grep -q "^$n$" || echo "INDEX_MISSING: $n not in INDEX.md"
  done
  [ -z "$(for n in $BODY; do echo "$INDEX" | grep -q "^$n$" || echo "x"; done)" ] \
    && echo "Quick Index sync OK" || true
else
  echo "INDEX_MISSING: career-os/docs/adr/INDEX.md 없음"
fi

# 그 외 워크스페이스 (단일 adr.md 구조)
for ADR_FILE in ai-nodes/docs/adr.md; do
  [ -f "$ADR_FILE" ] || continue
  echo "=== $ADR_FILE ==="
  # 본문 ADR 번호 (헤더 기준)
  BODY=$(grep -oE '^## ADR-[0-9]+' "$ADR_FILE" | grep -oE 'ADR-[0-9]+' | sort -u)
  # Quick Index 링크 ADR 번호
  INDEX=$(grep -oE 'ADR-[0-9]+' "$ADR_FILE" | sort -u | head -100)
  for n in $BODY; do
    echo "$INDEX" | grep -q "^$n$" || echo "INDEX_MISSING: $n in $ADR_FILE"
  done
  [ -z "$(for n in $BODY; do echo "$INDEX" | grep -q "^$n$" || echo "x"; done)" ] \
    && echo "Quick Index sync OK" || true
done
```

#### 자동화-2. ADR 본문 30줄 threshold (Bloat 후보)

```bash
# career-os: 개별 파일 각각을 30줄 기준으로 점검
echo "=== career-os/docs/adr/ ==="
for f in career-os/docs/adr/ADR-*.md; do
  [ -f "$f" ] || continue
  size=$(wc -l < "$f" | tr -d ' ')
  name=$(basename "$f" .md)
  [ "$size" -gt 30 ] && echo "BLOAT: $name ($size lines > 30) — 슬림화 검토"
done

# 그 외 워크스페이스 (단일 adr.md 구조)
for ADR_FILE in ai-nodes/docs/adr.md; do
  [ -f "$ADR_FILE" ] || continue
  echo "=== $ADR_FILE ==="
  for n in $(grep -oE '^## ADR-[0-9]+' "$ADR_FILE" | grep -oE '[0-9]+'); do
    size=$(awk "/^## ADR-$n/,/^## ADR-[0-9]/" "$ADR_FILE" | wc -l | tr -d ' ')
    [ "$size" -gt 30 ] && echo "BLOAT: ADR-$n ($size lines > 30) — 슬림화 검토"
  done
done
```

#### 자동화-3. Config schema alignment (data-schema.md ↔ 실제 config json)

```bash
# career-os config json 최상위 키 vs data-schema.md 문서화 여부
for cfg in career-os/config/*.json; do
  name=$(basename "$cfg" .json)
  grep -q "$name" career-os/docs/data-schema.md \
    || echo "SCHEMA_MISSING: $cfg not documented in data-schema.md"
done
echo "config schema alignment 검사 완료"
```

#### 자동화-4. Dispatcher case coverage (career-os scope 한정 — run_now.sh ↔ prd.md + flow.md)

```bash
DISPATCHER=career-os/scripts/command-router/run_now.sh
[ -f "$DISPATCHER" ] || { echo "DISPATCHER_NOT_FOUND: $DISPATCHER"; exit 0; }
# dispatcher case 목록 추출
CASES=$(grep -oE '^\s+[a-z][a-z-]+\)' "$DISPATCHER" | tr -d ' )' | sort -u)
echo "Dispatcher cases: $CASES"
for c in $CASES; do
  grep -q "$c" career-os/docs/prd.md \
    || echo "PRD_MISSING: dispatcher case '$c' not in prd.md"
  grep -q "$c" career-os/docs/flow.md \
    || echo "FLOW_MISSING: dispatcher case '$c' not in flow.md"
done
```

#### 자동화-5. Prohibited terms

```bash
# 금지 용어: § 기호 / 옛 subprocess 지시문 / 매트릭스
for f in career-os/docs/*.md ai-nodes/docs/*.md \
         career-os/.claude/skills/*/SKILL.md .claude/skills/*/SKILL.md; do
  [ -f "$f" ] || continue
  grep -n "§" "$f" && echo "PROHIBITED: § in $f"
  # 옛 subprocess 지시문: common-pitfalls/harness/6-7-references-audit.md
  # 문자열 변수 분리로 grep 자기 오탐 방지
  P1="Output only valid JS""ON"; P2="Do not output mark""down"; P3="claude --json-sche""ma"
  grep -n "$P1\|$P2\|$P3" "$f" \
    && echo "PROHIBITED: 옛 subprocess 지시문 in $f"
  grep -n "매트릭스\|matrix" "$f" \
    && echo "PROHIBITED: 매트릭스 용어 in $f"
done
echo "prohibited terms 검사 완료"
```

### 2. 5축 수동 감사

자동화 검사 결과를 바탕으로 각 문서를 5축으로 판정:

#### A. Decay (Code ↔ Docs Drift)

ai-nodes 도메인 특화 검사:
- ADR 본문의 skill 이름 ↔ 실제 `.claude/skills/*/SKILL.md` 존재 여부
- ADR 본문의 dispatcher case 이름 ↔ `run_now.sh` 실제 case 존재 여부
- ADR 본문의 config 파일 경로 ↔ `career-os/config/` 실제 파일 존재 여부
- Status=Accepted인 ADR의 결정이 코드에 미반영된 경우 → drift 의심
- Quick Index Status ↔ ADR 본문 Status 라인 불일치

#### B. Bloat (Over-specification)

- ADR 본문 30줄 초과 → 결정/맥락/대안 기각 외 기능 명세 의심
- ADR 안에 코드 블록 10줄 초과 → 본문이 아닌 코드 책임
- ADR 안에 파일 path 3개 이상 나열 → code-architecture.md 책임
- 변경 이력 / 작업 내역 목록 → git log 책임
- SKILL.md 안에 사고 사례 2개 이상 나열 → 하나로 응축

#### C. Clarity (Decision Rationale)

- "결정"만 있고 "맥락" / "왜"가 없는 ADR
- 대안 기각 없거나 근거 없이 "기각"만 명시
- 맥락이 "요구사항 추가" 같은 순환 설명
- SKILL.md: "왜 이 가드가 필요한지" 1줄 단서 없음

#### D. Duplication (Single Source of Truth)

5문서 단일 출처 원칙:
- config 스키마 정의 → `data-schema.md`만 (adr.md에 스키마 중복 금지)
- 데이터 흐름 → `flow.md`만 (prd.md에 흐름 중복 금지)
- 디렉터리 구조 → `code-architecture.md`만
- 기술 결정 근거 → `adr.md`만
- SKILL.md 간 동일 가드 반복 → `_shared/` 추출 후보

#### E. Self-Evidence (ADR Necessity Filter)

ADR 폐기 후보 유형 (ai-nodes 변형):
| 유형 | 예시 | 근거 |
|---|---|---|
| 패키지 선택 기록만 | "Bun 사용" | package.json으로 자명 |
| 디렉터리 구조 변경 | "scripts/ 분리" | 실제 트리로 자명 |
| 단순 마이그 기록 | "run_now.sh 이름 변경" | git log로 자명 |
| Dispatcher case 추가 | "smoke 명령 추가" | run_now.sh로 자명 |

유지 기준 (하나 이상 해당 시 보존):
1. 라이브러리 고유 함정 / 직관에 반하는 API 특성
2. A/B 실험 결과가 있는 결정
3. 대안 기각 근거 — 미래 재논의 가능성
4. 팀 합의 정책·규율
5. 비용/성능 트레이드오프 수치

### 3. 리포트 작성

발견 항목 포맷:

```markdown
#### [축] 파일명 ADR-XXX — 한 줄 요약
- **위치**: line N~M
- **문제**: 구체 내용 (예: 15줄 코드 블록 — Bloat)
- **근거**: 자동화 검사 결과 또는 5축 판정 기준
- **제안**: "결정/맥락/대안 기각으로 압축, 스니펫 제거"
- **대안**: 유지 근거가 있다면 명시
```

요약:

```markdown
## docs-check 결과 — YYYY-MM-DD

### Summary
- 검사 파일: N개 / ADR: N개
- 자동화 검사: Index sync X건 / Bloat Y건 / Schema Z건 / Dispatcher W건 / Prohibited V건
- 5축 발견: Decay A / Bloat B / Clarity C / Duplication D / Self-Evidence E

### Critical (즉시 수정 권장)
{축별 목록}

### Warning (수동 판단)
{축별 목록}

### Safe (개선 권장, 블로킹 아님)
{축별 목록}

### 다음 단계 제안
- (A) 이번 세션에서 즉시 정리
- (B) plan{N}으로 task화하여 실행
```

### 4. 사용자 승인 후 정리

**절대 사용자 승인 없이 docs를 수정하지 않는다.** Critical부터 순차 수정. 각 수정은 최소 diff — 결정 의도는 보존하되 표현/구조만 슬림화.

## Error handling

| 상황 | 처리 |
|---|---|
| adr.md 파일 없음 (그 외 워크스페이스) | stderr warn + 해당 scope 건너뜀 |
| career-os/docs/adr/INDEX.md 없음 | INDEX_MISSING 출력 + 개별 파일 Bloat 검사만 진행 |
| dispatcher 파일 없음 | 자동화-4 skip, 수동 감사만 진행 |
| config/ 없음 | 자동화-3 skip |
| Quick Index 없음 (미작성) | Index sync 검사 → MISSING 전수 보고 |
| scope 인식 불가 | "career-os / ai-nodes / all 중 하나로 재호출 요청" |

## 의도적으로 안 하는 것

- **docs 수정·삭제**: 발견 전용 — 수정은 사용자 승인 후 별도 세션.
- **코드 변경**: docs 감사 전용. 코드 문제는 해당 task로 처리.
- **ADR 자동 삭제**: Self-Evidence 후보를 직접 삭제하지 않는다 — 목록 제출 후 사용자 결정.
- **scope 외 파일 감사**: 지정 scope 밖 파일은 건너뜀.

## Why this design

ADR-003 (ai-nodes/docs/adr.md): 현재 28 ADR 중 drift 5+개 — AI 에이전트가 어떤 결정이 살아있는지 추론 불가. fos-blog 5축 구조를 차용하되 ai-nodes 도메인 (Drizzle→config json / page.tsx→dispatcher case / SKILL.md trigger pattern)으로 변형. 발견 전용 + 사용자 승인 후 수정 분리로 의도하지 않은 docs 파괴 방지.
