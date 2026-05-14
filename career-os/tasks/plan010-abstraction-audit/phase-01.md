# Phase 1 — 11 skill 추상화·config 의존 점검 + docs/learn 산출물

## 목표

career-os의 11 skill에 대해:
1. runner들의 공통 패턴이 어디서 반복되는지(추상화 미흡 지점).
2. 하드코딩된 단어(회사명·날짜·URL·고정 경로)가 코드에 남아있는지.
3. 각 runner가 어떤 config 파일에 의존하는지 매트릭스.

세 축의 결과를 `career-os/docs/learn/2026-05-14-abstraction-audit.md`에 작성. 본 phase는 *audit*만 — 발견한 추상화·config 강화 작업은 본 plan에서 적용하지 않고 별도 plan으로 미룬다.

## 의존성 / 가정

- working tree clean(main). plan008 / plan009 phase는 백그라운드에서 실행 중일 수 있으나, 본 phase는 read-only audit + 단일 마크다운 작성이라 충돌 위험 낮음.
- 본 phase는 ADR-018의 docs/learn 정책에 따라 산출물 1개를 추가. 결정·근거가 굳어지면 후속 사이클에서 ADR로 흡수 후 learn 파일 삭제.

## 작업

### 1. 정적 분석

세 영역의 메트릭을 명시적 명령으로 수집(추측 금지, grep/find/wc로 실측):

**1-1. runner 공통 패턴 카운트**

각 패턴이 몇 개 runner에서 등장하는지:

```bash
for pattern in 'invoke_claude_skills' 'extract_claude_result' 'claude_persist_usage' \
               'notify_discord' 'format_cost_summary' 'update_artifacts' \
               'git -C.*fos-study.*commit' 'git -C.*fos-study.*push' \
               'data/runtime/locks' 'TRACK_TASK_CLAUDE_USAGE_FILE' \
               'mkdir -p .*data/'; do
  count=$(grep -lE "$pattern" career-os/scripts/*/run_*.sh 2>/dev/null | wc -l)
  printf '%-50s %d runner\n' "$pattern" "$count"
done
```

**1-2. 하드코딩 단어 grep**

코드에 남아 있을 수 있는 하드코딩 후보:

```bash
# 회사명·면접일·URL·고정 경로 후보
for term in 'cj-foodville' 'cj-oliveyoung' 'CJ푸드빌' 'CJ오니브영' 'foodville' \
            'bifos' '2026-05-' 'kakao' 'naver\.com' 'wanted\.co\.kr' \
            '/home/bifos' '/Users/' 'localhost'; do
  hits=$(grep -rln "$term" career-os/scripts career-os/skills _shared 2>/dev/null \
         | grep -v __pycache__ | wc -l)
  [ "$hits" -gt 0 ] && printf '%-30s %d 파일\n' "$term" "$hits"
done
```

각 발견 단어가 *의도된 도메인 한정*(예: cj-foodville-coffeechat-prep skill 안에서 사명 사용)인지 *드리프트*(다른 위치 잔재)인지 분류.

**1-3. config 의존 매트릭스**

각 runner가 어떤 `config/<file>.json` / `config/<file>.md`를 참조하는지:

```bash
for runner in career-os/scripts/*/run_*.sh; do
  name=$(basename "$runner")
  skill=$(basename "$(dirname "$runner")")
  configs=$(grep -oE 'config/[A-Za-z0-9_.-]+\.(json|md|txt)' "$runner" | sort -u | tr '\n' ',' | sed 's/,$//')
  printf '%-30s %-30s %s\n' "$skill" "$name" "$configs"
done
```

config를 직접 hard-pathing하지 않고 env 변수로 받는 경우도 같이 확인(`TASK_ROOT` / `TOPIC_CONFIG_OVERRIDE` 등).

### 2. 산출물 작성

`career-os/docs/learn/2026-05-14-abstraction-audit.md`에 다음 5개 섹션:

1. **요약** — 11 skill 대상. 본 audit의 결론 한 문단.
2. **runner 공통 패턴 표** — 1-1 결과. 패턴 + 등장 runner 수 + 추상화 후보 여부(✓/✗) + 추출 시 위치(예: `_shared/lib/` 또는 도메인 skill).
3. **하드코딩 단어 표** — 1-2 결과. 단어 + 파일 수 + 분류(의도된 도메인 / 드리프트 / 새 config로 추출 권장).
4. **config 의존 매트릭스** — 1-3 결과. (skill, runner) 행 / config 파일 열. config 미사용 또는 hard-pathing이 드러나는 셀 표시.
5. **추상화·config 강화 후보 우선순위** — 5-10개 액션 아이템. 각각 (제목, 영향 runner 수, 예상 작업량 S/M/L, 후속 plan 후보 번호).

표는 마크다운 형식. 코드 블록 ❌(audit 결과 자체가 자료라 코드 인용은 불필요). 추측 ❌, 모든 수치 옆에 위 grep 명령 또는 측정 방법 1줄.

### 3. 자명한 결정·근거가 적힌 후속 plan 후보 목록 (별도 섹션)

audit 결과로 명백히 떠오르는 후속 plan 후보들을 마지막 섹션에 한 줄씩 적는다(상세 plan 명세는 본 plan 범위 외):

- `planNNN-<slug>` — 한 줄 의도 + 추정 phase 수 + 의존성.

## 검증 명령

```bash
# 1. 산출물 존재 + 줄 수 (너무 짧으면 audit 부실)
test -f career-os/docs/learn/2026-05-14-abstraction-audit.md
LINES=$(wc -l < career-os/docs/learn/2026-05-14-abstraction-audit.md)
[ "$LINES" -ge 50 ] || { echo "PHASE_FAILED: audit 산출물 줄 수 $LINES < 50"; exit 1; }

# 2. 5개 섹션 헤더 존재
for h in '^## 요약' '^## runner 공통 패턴' '^## 하드코딩 단어' '^## config 의존 매트릭스' '^## 추상화·config 강화 후보 우선순위'; do
  grep -qE "$h" career-os/docs/learn/2026-05-14-abstraction-audit.md \
    || { echo "PHASE_FAILED: 섹션 누락 $h"; exit 1; }
done

# 3. 후속 plan 후보 섹션 존재
grep -qE '^## .*후속 plan' career-os/docs/learn/2026-05-14-abstraction-audit.md \
  || { echo "PHASE_FAILED: 후속 plan 후보 섹션 누락"; exit 1; }

# 4. 본 phase가 코드를 만지지 않았는지 (audit만)
[ -z "$(git status --porcelain career-os/scripts/ career-os/skills/ _shared/)" ] \
  || { echo "PHASE_FAILED: 본 phase가 코드를 변경함 (audit-only 위반)"; git status --porcelain career-os/scripts/ career-os/skills/ _shared/; exit 1; }

# 5. § 기호 사용 금지
[ "$(grep -c '§' career-os/docs/learn/2026-05-14-abstraction-audit.md)" = "0" ] \
  || { echo "PHASE_FAILED: § 기호 잔재"; exit 1; }
```

검증 실패 시 `echo 'PHASE_FAILED: <식>' && exit 1`.

## 커밋 + 푸시

```
docs(career-os): plan010 abstraction audit — runner 공통 패턴 / 하드코딩 / config 의존 매트릭스

career-os/docs/learn/2026-05-14-abstraction-audit.md 신설.
11 skill runner의 추상화 미흡 지점·드리프트 단어·config 의존을 정량 측정.
후속 plan 후보 5-10개 식별.
```

`git push origin main`.

## 범위 외

- audit 결과로 발견한 추상화·config 강화 자체 적용 (별도 plan).
- 본 phase 산출물의 ADR 흡수 (결정이 굳어지면 후속 사이클에서, ADR-018).
- 다른 워크스페이스(apartment) audit (워크스페이스 격리).
