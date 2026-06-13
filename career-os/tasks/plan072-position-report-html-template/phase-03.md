# Phase 03 — 시각 스타일과 HTML 검증

**Model**: sonnet
**Status**: pending

---

## 목표

템플릿 기반 HTML 리포트를 아침에 읽기 좋은 SaaS/dashboard형 화면으로 다듬고, 모바일과 데스크톱에서 깨지지 않는지 검증한다.

**범위 외**: collector/source adapter 변경, 추천 알고리즘 변경, 새로운 dashboard 제품 구현, 외부 Discord 전송, docs/ADR 수정.

---

## 사전 cwd 설정

run-phases.py는 cwd=workspace로 phase를 실행한다.
본 phase는 ai-nodes 루트 기준 path를 사용하므로 첫 bash에서 cwd=ai-nodes 루트로 변경한다.

```bash
cd "$(git rev-parse --show-toplevel)"
pwd  # 기대: ai-nodes repo root
```

---

## 관련 docs

실행 전 반드시 읽는다.

- `career-os/docs/adr.md`의 ADR-080
- `career-os/docs/flow.md`의 `/position-recommender` Discord 알림과 HTML 첨부 흐름
- `career-os/docs/code-architecture.md`의 `render_report_html.ts`와 template 책임
- `career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md`
- `career-os/tasks/plan072-position-report-html-template/phase-02.md`

---

## 작업 항목

### 1. template 시각 스타일 개선

`career-os/scripts/position-recommender/templates/report.html`을 다듬는다.
방향은 다음과 같다.

- 조용한 SaaS/dashboard형 레이아웃.
- 첫 화면은 리포트 제목, 날짜, 간단한 상태 요약, 본문 시작이 보이게 한다.
- landing page hero, 과한 장식, 큰 marketing copy는 넣지 않는다.
- 카드 radius는 8px 이하로 둔다.
- 단색 계열에 치우치지 않도록 배경, border, accent를 절제해서 섞는다.

### 2. Markdown 구조별 HTML class 보강

필요하면 `render_report_html.ts`의 Markdown 변환 결과에 class를 붙인다.
목표는 다음 구조를 읽기 쉽게 만드는 것이다.

- 강력 추천, 도전 추천, 보류 또는 주의 티어.
- 회사, 직무, 링크.
- 이유, 확인할 점, 다음 액션.
- source diagnostics 또는 수집 진단.

정규식 기반 구조화가 불안정하면 과하게 파싱하지 말고 일반 HTML typography와 list styling을 우선한다.

### 3. Discord 본문 짧은 경계 확인

`run_daily_with_claude.ts`의 Discord 메시지가 상세 본문을 길게 복제하지 않는지 확인한다.
필요하면 문구만 작게 조정한다.
실제 Discord 전송은 하지 않는다.

### 4. 모바일/데스크톱 smoke 검증

샘플 report로 HTML을 생성한 뒤 다음을 확인한다.

- 긴 URL이 컨테이너를 깨지 않는다.
- 긴 회사명과 직무명이 카드 너비를 깨지 않는다.
- 미치환 placeholder가 없다.
- source diagnostics는 접힘 영역 또는 낮은 우선순위 영역으로 들어간다.

Playwright가 repo 의존성으로 이미 설치되어 있으면 screenshot smoke를 해도 된다.
새 의존성 설치는 하지 않는다.

### 5. phase commit

검증이 끝나면 의도한 변경만 stage한다.
commit 메시지는 `style(career-os): position HTML 리포트 가독성 개선`을 사용한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/templates/report.html` | 최종 표시 스타일 |
| `career-os/scripts/position-recommender/render_report_html.ts` | 필요 시 class와 diagnostics 분리 보강 |
| `career-os/scripts/position-recommender/run_daily_with_claude.ts` | 필요 시 Discord 짧은 문구 보정 |
| `career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md` | 검증 결과와 남은 결정 기록 |

---

## 검증

보고 직전 반드시 아래 bash 블록을 실행하고 raw 값을 출력한다.

```bash
cd "$(git rev-parse --show-toplevel)"

bun --check career-os/scripts/position-recommender/render_report_html.ts
bun --check career-os/scripts/position-recommender/run_daily_with_claude.ts
test -f career-os/scripts/position-recommender/templates/report.html

REPORT=$(find career-os/data/reports/daily -path '*/position-recommendation/report.md' -print | sort | tail -1)
if [ -z "$REPORT" ]; then
  FIXTURE=$(mktemp /tmp/position-report.XXXXXX.md)
  cat > "$FIXTURE" <<'EOF'
# 2026-06-14 Position Recommendation

## 강력 추천

1. [Very Long Company Name Backend Platform Engineer](https://example.com/jobs/backend-platform-engineer-with-a-very-long-url-that-should-wrap)
   - 이유: active direct posting이고 후보자 backend 경험과 맞는다.
   - 확인할 점: 온콜, 레거시 비율, AI 전환 실무 범위.
   - 다음 액션: JD를 저장하고 지원 패키지 초안을 만든다.

## Source diagnostics

- wanted: ok
- coupang: detail fetch blocked, risk flag only
EOF
  REPORT="$FIXTURE"
fi

OUT=$(mktemp /tmp/position-report.XXXXXX.html)
bun career-os/scripts/position-recommender/render_report_html.ts \
  --input "$REPORT" \
  --output "$OUT"
echo "[html path] $OUT"
test -s "$OUT"
rg -n '<!doctype html>|<html lang="ko"|<meta name="viewport"|강력 추천|Source diagnostics' "$OUT"
rg -n 'word-break|overflow-wrap|@media|details|summary' "$OUT"
! rg -n '\{\{title\}\}|\{\{generatedAt\}\}|\{\{reportHtml\}\}|\{\{sourceDiagnosticsHtml\}\}' "$OUT"

if command -v npx >/dev/null 2>&1 && [ -d node_modules ]; then
  echo "[playwright optional] repo has node_modules; screenshot smoke may be run if playwright is installed"
fi

git -C career-os diff --check
git -C career-os status --short
```

---

## 성공 기준

- HTML 리포트가 SaaS/dashboard형으로 조용하고 읽기 쉬운 스타일을 갖는다.
- 모바일에서 긴 링크, 긴 회사명, 긴 직무명이 layout을 깨지 않도록 CSS 방어가 있다.
- 추천 티어와 source diagnostics가 스캔 가능한 구조로 보인다.
- Discord 본문은 짧은 triage 역할을 유지한다.
- output HTML에 placeholder 잔재가 없다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- Markdown report 구조가 실제로 여러 형태라 카드 구조화가 내용을 손상할 위험이 있다.
- HTML 검증을 위해 새 브라우저 의존성을 설치해야만 하는 상태다.
- Discord 본문을 얼마나 줄일지 사용자 결정이 필요하다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- output HTML에 미치환 placeholder가 남는다.
- 긴 URL 또는 긴 제목에 대한 CSS 방어가 없다.
- docs/ADR/정책 문서를 수정한 경우.
- 검증 명령을 실행하지 못한 경우.

---

## common-pitfalls self-check

- [ ] 수치가 있으면 실측 명령을 함께 적었다.
- [ ] 성공 기준은 `bun --check`, `test`, `rg`로 판정 가능하다.
- [ ] phase 단독 실행에 필요한 경로와 docs를 모두 적었다.
- [ ] 다른 워크스페이스 파일을 참조하지 않았다.
- [ ] docs/ADR 수정은 범위 밖으로 유지했다.
- [ ] 첫 bash 블록에서 ai-nodes 루트로 이동한다.
- [ ] `--no-verify`, `--force`, `--no-edit`를 쓰지 않는다.
