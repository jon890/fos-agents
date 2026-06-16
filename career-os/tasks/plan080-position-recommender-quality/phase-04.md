# Phase 04 — ② JD detail fetch 보강 (toss / coupang-careers / kakaomobility) + 즉시 1회 수집 검증

**Model**: sonnet
**Status**: pending

---

## 목표

position-recommender 실제 호출 평가에서, 카카오페이(greetinghr)만 `requirements`가 완비됐고
토스·카카오모빌리티는 `requirements`가 빈칸, 쿠팡은 "sitemap title 기반 추정"이었다.
세 adapter가 개별 공고 detail에서 `requirements`/`preferred`/`mainTasks`를 충분히 못 채운다.

세 adapter는 이미 detail을 일부 fetch한다(toss `parseTossJobDetail`, coupang `enrichPostings`/`enrichWithDetail`, kakaomobility `collect`의 `postingFromDetail`).
이 phase는 **기존 detail fetch 경로를 보강**해 `requirements`(가능하면 `preferred`/`mainTasks`도)가 실제로 채워지게 한다.
detail 파싱 셀렉터·정규식을 개선하거나, list-only로 끝나는 경로가 detail을 거치도록 연결한다.

**변경 즉시 bun으로 1회 수집을 실행해, 해당 source 공고에 `requirements`가 채워지는지 검증한다.**
career-os는 shadow 관찰 기간을 두지 않으므로(AGENTS.md) 2-3일 관찰 같은 제약은 넣지 않는다 — 변경 즉시 검증한다.

**범위 외**:
- SKILL.md/prompt.md 문서(phase-01)·서버 필터(phase-02)·태그(phase-03)는 건드리지 않는다.
- 새 source adapter 추가는 하지 않는다. 기존 toss/coupang/kakaomobility detail fetch 보강만.
- daily cron 자체를 깨뜨리지 않는다 — 기존 호출 인터페이스(adapter export 시그니처, `collect()` 반환 형태)는 보존한다.

---

## 사전 cwd 설정

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes 저장소 루트
```

Edit 도구는 절대경로/루트 기준 경로라 cwd와 무관하다. cwd 고정은 grep/bun/수집 실행용이다.

---

## 관련 docs

실행 전 반드시 Read한다:
- `career-os/scripts/position-recommender/collect_live_postings.ts` — 수집 진입점, adapter 호출 방식, 산출 snapshot 경로.
- `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` — `postingFromTossApiJob`(현재 `requirements: ""` 하드코딩), `parseTossJobDetail`(detail HTML에서 requirements/preferred 추출 시도).
- `career-os/scripts/position-recommender/live-postings/adapters/coupang-careers.ts` — `postingFromSitemapUrl`(현재 `requirements: "공식 상세 페이지 확인 필요..."`), `enrichPostings`/`enrichWithDetail`(detail HTML 보강).
- `career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts` — `collect`의 `postingFromDetail`(detail HTML에서 정규식으로 requirements 추출).
- 비교 기준: 카카오페이(greetinghr) adapter — `requirements`가 완비되는 정상 케이스의 파싱 패턴을 참고한다. (`adapters/kakaopay.ts`)

---

## 작업 항목 (5)

**반드시 Edit 도구를 직접 호출한다. prose 응답으로 "보강했다"고 끝내면 PHASE_FAILED다.**

### 1. toss detail 연결

`toss.ts`에서 `postingFromTossApiJob`이 `requirements: ""`로 비워 두는 부분을, 개별 job-detail에서 얻은 requirements/preferred로 채우도록 연결한다. `parseTossJobDetail`이 이미 detail HTML을 파싱하면 그 결과를 posting에 반영하고, API content만으로 requirements를 분리할 수 있으면 `cleanDetail`로 채운다. detail fetch가 실패하면 빈칸 대신 기존 동작(빈칸 또는 mainTasks 유지)을 보존한다.

### 2. coupang detail 보강

`coupang-careers.ts`의 `enrichWithDetail`이 detail HTML에서 requirements/preferred를 더 정확히 추출하도록 셀렉터·정규식을 보강한다. detail fetch 성공 시 `postingFromSitemapUrl`의 "sitemap title 기반 추정" placeholder를 실제 detail 값으로 덮어쓴다. fetch 실패 시 기존 placeholder를 그대로 두되, fetch가 실제로 시도됐는지 확인한다.

### 3. kakaomobility detail 파싱 보강

`kakaomobility.ts`의 `postingFromDetail` 정규식이 requirements를 빈칸으로 남기는 케이스를 줄인다. 실제 detail HTML 구조에 맞춰 "지원자격/자격요건/이런 분을 찾습니다" 섹션 매칭을 보강한다(섹션 구분 변형 대응).

### 4. 호출 인터페이스 보존

각 adapter의 export 시그니처와 `collect()` 반환 형태(postings/errors/failedCount 등)를 바꾸지 않는다. detail fetch 추가로 호출 횟수가 늘어 rate limit·차단이 걱정되면, 기존 fetch 헬퍼(`fetchText`/`fetchHtml`)를 재사용하고 동시 호출 폭증을 만들지 않는다. daily cron이 호출하는 진입점(`collect_live_postings.ts`)이 깨지지 않게 한다.

### 5. bun으로 1회 수집 즉시 실행 + requirements 채움 확인

변경 직후 즉시 1회 수집을 실행한다(shadow 관찰 없음). 네트워크/차단으로 일부 source가 실패할 수 있으므로, *적어도 한 source*에서 detail fetch가 성공해 requirements가 채워지면 보강이 동작한 것으로 본다.

```bash
cd "$(git rev-parse --show-toplevel)"
bun career-os/scripts/position-recommender/collect_live_postings.ts 2>&1 | tail -40 || true
```

수집 산출 snapshot(JSON) 경로는 `collect_live_postings.ts`를 읽고 확인한다(예: `career-os/data/runtime/...` 또는 stdout). 검증 섹션에서 snapshot의 toss/coupang/kakaomobility 항목 중 requirements가 비지 않은 건수를 센다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/live-postings/adapters/toss.ts` | detail requirements/preferred 채움 연결 |
| `career-os/scripts/position-recommender/live-postings/adapters/coupang-careers.ts` | `enrichWithDetail` 파싱 보강, placeholder 덮어쓰기 |
| `career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts` | `postingFromDetail` requirements 정규식 보강 |

수집 진입점(`collect_live_postings.ts`)·공유 policy.ts는 수정하지 않는다(인터페이스 보존).

## 검증

보고 직전 반드시 아래 bash 블록을 Bash 도구로 직접 실행하고 출력 값을 그대로 echo한다.
**검증 명령을 실행하지 않고 "통과"로 추정 보고하면 안 된다.**

```bash
cd "$(git rev-parse --show-toplevel)"

# 1. 세 adapter 모듈 로드(타입체크 대체)
for A in toss coupang-careers kakaomobility; do
  bun -e "import('./career-os/scripts/position-recommender/live-postings/adapters/$A.ts').then(()=>console.log('[모듈 로드 $A] OK')).catch(e=>{console.error('FAIL $A',e);process.exit(1)})"
done

# 2. 1회 수집 실행 (네트워크 의존 — 실패 source는 허용, snapshot 생성 자체는 성공해야)
echo "[수집 실행]"
bun career-os/scripts/position-recommender/collect_live_postings.ts > /tmp/plan080_collect.log 2>&1 || echo "(수집 종료 코드 비0 — 일부 source 실패 가능, snapshot으로 판정)"
tail -20 /tmp/plan080_collect.log

# 3. snapshot에서 toss/coupang/kakaomobility 중 requirements 채워진 건수
#    snapshot 경로는 collect 로그/스크립트에서 확인. 아래는 흔한 후보를 탐색한다.
SNAP=$(ls -t career-os/data/runtime/live-postings*.json career-os/data/runtime/position-recommendation/*.json 2>/dev/null | head -1)
if [ -z "$SNAP" ]; then SNAP=$(grep -oE "career-os/data[^ ]+\.json" /tmp/plan080_collect.log | head -1); fi
echo "[snapshot 경로] $SNAP"
if [ -n "$SNAP" ] && [ -f "$SNAP" ]; then
  FILLED=$(bun -e '
const fs=require("fs");
const raw=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
const arr=Array.isArray(raw)?raw:(raw.postings||raw.items||[]);
const tgt=arr.filter(p=>["toss-careers","coupang-careers","kakaomobility"].includes(p.source));
const filled=tgt.filter(p=>(p.requirements||"").trim().length>20 && !/상세 페이지 확인 필요|추정/.test(p.requirements||""));
console.log("TARGET="+tgt.length+" FILLED="+filled.length);
' "$SNAP")
  echo "[detail requirements 채움] $FILLED"
  # 네트워크 변동이 있으므로, 대상이 0이면 차단으로 보고 보강 흔적(코드)만으로 통과 처리
  CNT=$(echo "$FILLED" | grep -oE "FILLED=[0-9]+" | cut -d= -f2)
  TGT=$(echo "$FILLED" | grep -oE "TARGET=[0-9]+" | cut -d= -f2)
  if [ "${TGT:-0}" -gt 0 ] && [ "${CNT:-0}" -eq 0 ]; then
    echo "WARN: 대상 source는 수집됐으나 requirements 채움 0 — 보강 파싱 재확인 필요"
    echo "FAIL: detail requirements 채움 0건"; exit 1
  fi
else
  echo "WARN: snapshot 미발견 — 네트워크 차단 가능. 코드 보강 흔적으로만 판정"
fi

# 4. placeholder 'sitemap title 기반' 표현이 코드에서 실제 detail로 덮이도록 보강됐는지(흔적)
ENRICH=$(grep -lE "enrichWithDetail|requirements *=|requirements:" career-os/scripts/position-recommender/live-postings/adapters/coupang-careers.ts | wc -l | tr -d ' ')
echo "[coupang enrich 보강 흔적] $ENRICH"

echo "✅ Phase 04 검증 명령 실행 완료"
```

주: 네트워크 차단으로 수집이 실패할 수 있다. 이때는 `requirements` 채움 0이 *코드 결함이 아니라 차단* 때문일 수 있으므로, snapshot에 대상 source 자체가 0건이면(TARGET=0) 차단으로 보고 코드 보강 흔적만으로 통과 처리한다. 대상 source가 수집됐는데 채움이 0이면(TARGET>0, FILLED=0) 파싱 보강이 실패한 것이므로 PHASE_FAILED다.

## commit

```bash
cd "$(git rev-parse --show-toplevel)"
git add career-os/scripts/position-recommender/live-postings/adapters/toss.ts \
        career-os/scripts/position-recommender/live-postings/adapters/coupang-careers.ts \
        career-os/scripts/position-recommender/live-postings/adapters/kakaomobility.ts
git diff --cached --name-only
git commit -q -m "$(cat <<'EOF'
fix(career-os): position-recommender toss/coupang/kakaomobility JD detail fetch 보강

- toss postingFromTossApiJob이 detail requirements/preferred를 채우도록 연결
- coupang enrichWithDetail 파싱 보강, sitemap title 추정 placeholder를 detail 값으로 덮어씀
- kakaomobility postingFromDetail requirements 정규식 보강
- collect 진입점·adapter 호출 인터페이스는 보존(daily cron 호환)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
COMMITS=$(git rev-list HEAD ^HEAD~1 --count)
echo "[이 phase commit 수] $COMMITS"
[ "$COMMITS" -ge 1 ] || { echo "FAIL: commit 미생성 — Edit이 실제 실행 안 됨"; exit 1; }
git log --oneline -1
# 임시 로그 정리
rm -f /tmp/plan080_collect.log
```

## 의도 메모 (왜)

- 세 adapter는 이미 detail을 일부 fetch하지만 requirements를 못 채운다. 새 fetch 경로를 만드는 대신 *기존 경로를 보강*해야 호출 인터페이스와 daily cron을 깨지 않는다.
- 카카오페이(greetinghr)가 정상 케이스이므로 그 파싱 패턴을 비교 기준으로 삼는다.
- 즉시 1회 수집으로 검증하는 이유 — career-os는 shadow 관찰 기간을 두지 않는다(AGENTS.md). 변경하면 바로 돌려 requirements가 실제로 채워지는지 본다. 네트워크 차단은 코드 결함과 구분해 판정한다.

## Blocked 조건

- detail HTML 구조가 셀렉터로 안정적으로 파싱되지 않거나, 대상 사이트가 detail fetch를 일관되게 차단해 어떤 source도 requirements를 채우지 못하면(코드 보강은 했으나 실측 불가), `PHASE_BLOCKED: detail fetch 차단/구조 변경으로 requirements 실측 불가 — 브라우저 수집 등 별도 plan 필요` 출력 후 `exit 2`. 반드시 Bash 도구로 직접 실행한다. 코드 보강 commit은 남기되 status는 blocked로 둔다.
- 대상 source가 수집됐는데(TARGET>0) requirements 채움이 0건이면(FILLED=0) `PHASE_FAILED: detail 파싱 보강 실패` 출력 후 `exit 1`. 반드시 Bash 도구로 직접 실행한다. prose만 출력하면 success로 잘못 처리된다.
