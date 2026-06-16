# Phase 06 — toss/kakaomobility JD detail requirements 채움 보강

**Model**: sonnet
**Status**: pending

---

## 목표

phase-04에서 detail fetch를 보강했으나 toss(7/58)·kakaomobility(0/6)의 requirements 채움이 낮았다.
근본 원인: requirements 추출 regex가 헤딩 miss 시 빈칸을 반환(fallback 없음)하고 헤딩 변형을 놓친다.
kakaopay는 같은 GreetingHR ATS인데 requirements가 채워진다 — 그 검증된 패턴을 따른다.

**범위 외**: coupang(9/9 이미 완성)·policy.ts·SKILL.md·다른 phase 산출물은 건드리지 않는다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: worktree 루트
```

---

## 작업 항목 (2)

**반드시 Edit 도구를 호출한다. prose 응답만으로 끝내면 PHASE_FAILED다.**

### 1. toss.ts `parseTossJDSections` requirements 보강

`career-os/scripts/position-recommender/live-postings/adapters/toss.ts`:
- requirements 헤딩 정규식에 변형을 union으로 추가: `지원자격`, `지원 자격`, `필수 요건`, `자격`, 영문 `Requirements`, `What we look for` (기존 `자격 요건`/`필요 역량`/`이런 분이 필요해요`/`Qualifications`에 더한다).
- requirements가 헤딩 miss로 빈칸이면 fallback을 둔다 — mainTasks가 이미 전체 content fallback을 쓰는 것과 동일하게, requirements도 최소한 content 본문을 채운다(완전 빈칸 금지).
- preferred도 같은 방식으로 헤딩 변형 보강(`우대사항`/`선호 역량` 등).

### 2. kakaomobility.ts detail requirements/preferred 보강 (kakaopay 패턴 채택)

`career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts`의 detail 파싱을 kakaopay.ts 검증 패턴에 맞춘다:
- requirements: `(필요 역량\/경험|지원자격|자격요건)([\s\S]*?)(선호 역량|우대사항|지원 안내)` 계열.
- preferred: `(선호 역량\/경험|우대사항)([\s\S]*?)(지원 안내|전형 절차|유의사항)` 계열.
- mainTasks: `업무내용([\s\S]*?)(필요 역량|지원자격|자격요건|선호 역량|우대사항)` + 전체 텍스트 fallback.
- kakaomobility 고유 헤딩이 있으면 union으로 보존하고, requirements에도 fallback을 추가해 헤딩 miss 시 빈칸을 막는다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` | requirements 헤딩 변형 + fallback |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts` | kakaopay 패턴 채택 + fallback |

## 검증

보고 직전 반드시 아래를 Bash 도구로 직접 실행하고 출력 값을 echo한다. career-os는 shadow 관찰 기간을 두지 않으므로(AGENTS.md) 변경 즉시 1회 수집으로 검증한다.

```bash
cd "$(git rev-parse --show-toplevel)"
# 타입체크
bun build career-os/scripts/position-recommender/live-postings/adapters/toss.ts --target=bun > /dev/null 2>&1 && echo "toss.ts 타입 OK" || echo "toss.ts 타입 경고(런타임 의존 가능)"
# 1회 수집 (네트워크 의존 — 차단 시 정적 판정)
bun career-os/scripts/position-recommender/collect_live_postings.ts 2>&1 | tail -3
SNAP=career-os/data/runtime/live-position-postings.md
python3 - <<'PY'
import re
txt=open("career-os/data/runtime/live-position-postings.md").read()
blocks=re.split(r'\n(?=- \[)', txt)
def f(b,k):
    m=re.search(rf'^\s*- {k}:\s*(.+)$',b,re.M); return m.group(1).strip() if m else ''
stat={}
for b in blocks:
    if not b.startswith('- ['): continue
    s=f(b,'source'); r=f(b,'requirements')
    if s in ('toss-careers','kakaomobility'):
        stat.setdefault(s,[0,0]); stat[s][0]+=1
        if r: stat[s][1]+=1
for s,(t,r) in stat.items(): print(f"  {s}: {r}/{t} requirements 채움 (phase-04: toss 7/58, kakaomobility 0/6)")
PY
echo "✅ Phase 06 검증 명령 실행 완료"
```

목표: toss 채움률이 7/58보다 의미 있게 개선(절반 이상), kakaomobility가 0/6에서 대부분 채움. 네트워크 차단으로 수집 실패 시 코드 결함과 구분해 정적(타입체크) 판정한다.

## index.json status 마킹 (마지막 phase)

```bash
cd "$(git rev-parse --show-toplevel)"
python3 - <<'PY'
import json, subprocess
p="career-os/tasks/plan080-position-recommender-quality/index.json"
ts=subprocess.check_output(["bash","-lc","TZ=Asia/Seoul date +%FT%T%z"]).decode().strip()
ts=ts[:-2]+":"+ts[-2:]
d=json.load(open(p)); d["status"]="completed"; d["current_phase"]=6; d["updated_at"]=ts
for ph in d["phases"]: ph["status"]="completed"
open(p,"w").write(json.dumps(d,ensure_ascii=False,indent=2)+"\n")
print("index.json status=completed 마킹")
PY
```

## commit (마지막 phase)

worktree+branch 실행이므로 commit만 한다. push/PR은 메인 세션이 review 후 처리한다.

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/live-postings/adapters/toss.ts \
        career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts \
        career-os/tasks/plan080-position-recommender-quality/index.json
git diff --cached --name-only
git commit -q -m "$(cat <<'MSG'
fix(career-os): toss/kakaomobility JD detail requirements 채움 보강

- toss parseTossJDSections requirements 헤딩 변형 + miss 시 fallback
- kakaomobility detail을 kakaopay 검증 패턴(자격요건/우대사항)으로 정렬 + fallback
- phase-04 미달(toss 7/58, kakaomobility 0/6) 보강

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
MSG
)"
git log --oneline -1
```

## Blocked 조건

- 수집이 네트워크로 실패하면 타입체크만으로 판정하고, detail fetch 코드가 정상이면 통과로 본다. 코드 결함으로 여전히 채움이 0이면 `PHASE_FAILED: detail requirements 미채움` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다.
