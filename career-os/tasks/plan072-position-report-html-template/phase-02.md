# Phase 02 — template 파일 도입과 renderer 분리

**Model**: sonnet
**Status**: pending

---

## 목표

`render_report_html.ts` 안에 섞여 있는 HTML shell과 CSS를 `scripts/position-recommender/templates/report.html`로 분리한다.
renderer는 Markdown 파싱, 안전한 escaping, template placeholder 주입만 맡게 한다.

**범위 외**: collector/source adapter 변경, 추천 알고리즘 변경, Discord 메시지 포맷 대폭 변경, visual polish 최종화, docs/ADR 수정.

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
- `career-os/docs/flow.md`의 `/position-recommender` post-process 흐름
- `career-os/docs/code-architecture.md`의 `scripts/position-recommender/` 구조
- `career-os/docs/data-schema.md`의 `position-recommendation.html`
- `career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md`

---

## 작업 항목

### 1. template 경로와 placeholder 계약 추가

`career-os/scripts/position-recommender/templates/report.html`을 새로 만든다.
초기 template은 다음 placeholder만 사용한다.

- `{{title}}`
- `{{generatedAt}}`
- `{{reportHtml}}`
- `{{sourceDiagnosticsHtml}}`

placeholder 이름을 바꿔야 하면 design notes에 이유를 남긴다.
남은 placeholder가 output HTML에 그대로 남으면 실패해야 한다.

### 2. renderer 책임 분리

`career-os/scripts/position-recommender/render_report_html.ts`를 수정한다.
기존 Markdown inline escaping 동작은 유지한다.
새 책임은 다음과 같다.

- Markdown을 safe HTML fragment로 변환.
- report title과 생성 시각 계산.
- source diagnostics 후보 섹션이 있으면 접힘 영역 HTML로 분리.
- template 파일을 읽어 placeholder를 치환.
- 기본 template 경로를 `scripts/position-recommender/templates/report.html`로 잡는다.

필요하면 `--template <path>` 옵션을 추가한다.
기본 호출 인자는 기존 `--input`, `--output`과 호환되어야 한다.

### 3. runner 호환 확인

`career-os/scripts/position-recommender/run_daily_with_claude.ts`의 기존 renderer 호출이 수정 없이 통과하는지 확인한다.
runner 호출 변경이 꼭 필요하면 최소 수정만 한다.
Discord 전송 자체는 실행하지 않는다.

### 4. HTML smoke 생성

최근 report 샘플 또는 작은 fixture를 입력으로 `/tmp` 아래 HTML을 생성한다.
output HTML에 doctype, 한국어 lang, viewport, title, report body가 있는지 검사한다.

### 5. phase commit

검증이 끝나면 의도한 변경만 stage한다.
commit 메시지는 `feat(career-os): position 리포트 HTML template 분리`를 사용한다.

---

## Critical Files

| 파일 | 변경 |
|---|---|
| `career-os/scripts/position-recommender/templates/report.html` | 신규 template |
| `career-os/scripts/position-recommender/render_report_html.ts` | template 주입 renderer로 분리 |
| `career-os/scripts/position-recommender/run_daily_with_claude.ts` | 필요 시 renderer 호출 호환 보정 |
| `career-os/tasks/plan072-position-report-html-template/artifacts/design-notes.md` | placeholder 변경 사유가 있을 때만 갱신 |

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
  printf '# 2026-06-14 Position Recommendation\n\n## 강력 추천\n\n1. [Example](https://example.com/jobs/1) - 이유: active direct posting\n' > "$FIXTURE"
  REPORT="$FIXTURE"
fi

OUT=$(mktemp /tmp/position-report.XXXXXX.html)
bun career-os/scripts/position-recommender/render_report_html.ts \
  --input "$REPORT" \
  --output "$OUT"
echo "[html path] $OUT"
test -s "$OUT"
rg -n '<!doctype html>|<html lang="ko"|<meta name="viewport"|Position|강력 추천' "$OUT"
! rg -n '\{\{title\}\}|\{\{generatedAt\}\}|\{\{reportHtml\}\}|\{\{sourceDiagnosticsHtml\}\}' "$OUT"

git -C career-os diff --check
git -C career-os status --short
```

---

## 성공 기준

- template 파일이 `scripts/position-recommender/templates/report.html`에 생긴다.
- 기존 `--input`, `--output` CLI 계약이 유지된다.
- HTML shell과 CSS는 template로 이동하고, renderer는 template 치환을 맡는다.
- output HTML에 placeholder 잔재가 없다.
- runner의 기존 renderer 호출이 깨지지 않는다.
- docs/ADR/정책 문서는 수정하지 않는다.

---

## PHASE_BLOCKED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_BLOCKED: ...' && exit 2`를 실행한다.

- Markdown 구조가 너무 불안정해 template placeholder 계약을 정할 수 없다.
- default template path가 docs의 ADR-080 결정과 충돌한다.
- runner 호출을 크게 바꿔야 해서 daily 알림 계약 재결정이 필요하다.

## PHASE_FAILED

다음 경우에는 반드시 Bash 도구로 직접 `echo 'PHASE_FAILED: ...' && exit 1`를 실행한다.

- 기존 `--input`, `--output` 호출이 깨진다.
- output HTML에 미치환 placeholder가 남는다.
- HTML escaping이 약해져 원본 Markdown의 raw tag가 실행 가능한 HTML로 들어간다.
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
