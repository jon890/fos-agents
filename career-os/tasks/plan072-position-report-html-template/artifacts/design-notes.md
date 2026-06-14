# plan072 디자인 메모

Phase 01 감사 결과 및 phase 02, 03 구현 기준.

## 1. 현재 흐름 요약

### 1-1. HTML 생성 경로

```
run_daily_with_claude.ts
  ├─ bun collect_live_postings.ts          → data/runtime/live-position-postings.md
  ├─ claude -p "/position-recommender ..." → data/reports/daily/YYYY-MM-DD/position-recommendation/report.md
  │                                          data/runtime/position-recommendation.md (mirror)
  ├─ bun render_report_html.ts             → data/reports/daily/YYYY-MM-DD/position-recommendation/report.html
  ├─ bun render_report_html.ts             → data/runtime/position-recommendation.html
  ├─ bun frontdoor_queue_builder.ts        (frontdoor queue 갱신)
  ├─ bun priority_recommendation.ts        (priority snapshot 갱신)
  └─ bun notify_discord.ts --media reportHtml (dated report.html 첨부)
```

### 1-2. Discord 첨부 확인

실측 명령:

```bash
grep -n "media\|htmlReport\|notifyPosition\|notify_discord" \
  career-os/scripts/position-recommender/run_daily_with_claude.ts
```

결과 (run_daily_with_claude.ts:355):

```
spawnSync("bun", [...notifyScript, "--media", args.htmlReport, message])
```

- `args.htmlReport`는 `data/reports/daily/YYYY-MM-DD/position-recommendation/report.html`이다.
- `data/runtime/position-recommendation.html`은 Discord에 첨부하지 않는다.
- Discord 본문은 강력 추천 최대 3개 + 도전 추천 최대 2개의 triage 카드다 (line 301-326).

### 1-3. HTML 생성 실패 전파

실측 명령:

```bash
grep -n "function run\|process.exit\|status" \
  career-os/scripts/position-recommender/run_daily_with_claude.ts | head -20
```

결과 (line 63-71):

```ts
function run(cmd, args, cwd) {
  const result = spawnSync(...)
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
```

`render_report_html.ts` 호출이 `run()` 경유 → 실패 시 `process.exit()` → runner 전체 실패로 전파된다. (ADR-080 조건 충족)

### 1-4. 현재 renderer 책임

`scripts/position-recommender/render_report_html.ts` 분석:

- `escapeHtml()` — XSS 방어용 HTML escape.
- `inlineMarkdown()` — link, backtick code, bold, raw URL을 inline HTML로.
- `renderMarkdown()` — heading, ol, ul, p, pre/code block 변환.
- `renderHtml()` — HTML shell(doctype, head, CSS) + `renderMarkdown()` 결합. **CSS가 코드에 하드코딩됨.**
- CLI: `--input <path>` + `--output <path>`. 이 계약은 변경하지 않는다.

현재 CSS 현황 (hd coded in renderHtml):

- CSS variables: `--bg`, `--panel`, `--text`, `--muted`, `--line`, `--accent`.
- `@media (max-width: 640px)` 반응형 breakpoint 1개.
- `a { word-break: break-all; }` — 긴 URL 방어.

---

## 2. Markdown 구조 샘플 감사

### 2-1. 실측 탐색 결과

```bash
find career-os/data/reports/daily -path '*/position-recommendation/report.md' -print | sort | tail -5
# 결과: (출력 없음) — worktree에 daily report 파일 없음
```

worktree `plan072-position-report-html-template`은 구현 전용이므로 실제 daily report가 없다.
Markdown 구조는 `career-os/.claude/skills/position-recommender/SKILL.md` Workflow 섹션 3에서 실측했다.

### 2-2. Markdown 필수 구조 (SKILL.md 실측)

```
# YYYY-MM-DD 포지션 추천 리포트                 ← 첫 줄 단일 H1 (날짜 고정)

오늘의 결론 (첫 10줄 안)                        ← 짧은 triage 판단

## 추천 배경 요약                               ← H2 섹션 (2-3문장)

## 강력 추천                                   ← H2 섹션 (최대 3개)

1. 회사명 — 포지션명
   - 공고 링크: https://...
   - 탐색 링크: -
   - 링크 근거 수준: 개별 공고 active 확인
   - 왜 맞는가: ...
   - 확인해야 할 모호점: ...
   - 준비 액션: ...

## 도전 추천                                   ← H2 섹션 (최대 2개)
(같은 구조)

## 보류·주의                                   ← H2 섹션 (최대 3개)
(사유만)

## 최근 반복 점검                               ← H2 섹션
```

총 30-70줄 권장. 섹션 제목은 한국어 우선.

### 2-3. Source diagnostics 섹션 (Phase 03 fixture 기준)

```
## Source diagnostics

- wanted: ok
- coupang: detail fetch blocked, risk flag only
```

이 섹션은 수집 진단 정보로, 추천 판단과 별개다.
Phase 03에서 접힘 영역(`<details>`)으로 분리하는 것이 권장된다.

---

## 3. template placeholder 후보

ADR-080 결정 + index.json `recommended_defaults` 기준:

| placeholder | 채우는 값 | 출처 |
|---|---|---|
| `{{title}}` | Markdown 첫 H1 텍스트 | `renderHtml()`의 현재 `title` 추출 로직 재활용 |
| `{{generatedAt}}` | HTML 생성 시각 (KST) | `new Date()` 또는 `kstDate()` 패턴 |
| `{{reportHtml}}` | `renderMarkdown()` 전체 출력 | 현재 `renderHtml()` 내부 호출 분리 |
| `{{sourceDiagnosticsHtml}}` | Source diagnostics 섹션 HTML (접힘) | Phase 03에서 구현; Phase 02에서는 빈 문자열 허용 |

placeholder 이름을 바꿔야 하면 design-notes를 갱신하고 이유를 남긴다.

---

## 4. 추천 티어 카드 표시 필드

강력 추천/도전 추천 각 항목에서 HTML로 강조할 필드:

- **회사명 — 포지션명** (H3 또는 카드 헤더)
- **공고 링크** (`<a href>`, 개별 공고 URL)
- **공고 기간** (`opened_at` / `closes_at` / `urgency`)
- **왜 맞는가** (한 문장 요약)
- **확인해야 할 모호점** (한 줄)
- **준비 액션** (한 줄)

Markdown `- 공고 링크: https://...` 패턴은 `inlineMarkdown()`으로 이미 링크로 변환된다.
Phase 02에서 Markdown 그대로 list로 출력해도 동작하며, Phase 03에서 class 붙여 스타일 강화.

---

## 5. source diagnostics 처리 방향

- Phase 02: `{{sourceDiagnosticsHtml}}`을 빈 문자열로 치환 (섹션 분리 없이 `{{reportHtml}}`에 포함).
- Phase 03: `renderMarkdown()` 결과에서 `## Source diagnostics` 섹션을 분리해 `<details><summary>` 접힘으로 이동.
- 분리 기준: `## Source diagnostics` 또는 `## source diagnostics` H2 헤더로 시작하는 마지막 섹션.

---

## 6. 모바일/데스크톱 깨짐 위험 요소

### 이미 방어된 항목

- `a { word-break: break-all; }` — 긴 URL 처리.
- `@media (max-width: 640px)` — 모바일 padding, font-size 축소.
- `max-width: 920px` — 데스크톱 너비 제한.

### Phase 02-03에서 추가 검증 필요한 항목

- 긴 회사명 + 직무명 (`word-break` 또는 `overflow-wrap: anywhere`).
- `<li>` 안의 여러 필드가 세로로 나열되는지 (링크, 이유, 확인, 액션).
- `<pre>` 코드 블록의 `overflow-x: auto` 작동 확인.
- source diagnostics 접힘 영역이 모바일에서 tap 가능한지.

---

## 7. phase 02 구현 범위 (template + renderer 분리)

**신규 파일**: `career-os/scripts/position-recommender/templates/report.html`

```html
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{title}}</title>
  <style>
    /* CSS 전체 */
  </style>
</head>
<body>
  <main>
    <header>
      <h1>{{title}}</h1>
      <p class="meta">{{generatedAt}}</p>
    </header>
    <article>
      {{reportHtml}}
    </article>
    {{sourceDiagnosticsHtml}}
  </main>
</body>
</html>
```

**수정 파일**: `career-os/scripts/position-recommender/render_report_html.ts`

- `renderHtml()` 내부 HTML string 제거 → template 파일 읽기 + placeholder 치환으로 변경.
- `--template <path>` 옵션 추가 (선택). 기본값은 `scripts/position-recommender/templates/report.html`.
- `--input`, `--output` CLI 계약 유지 필수.
- `{{sourceDiagnosticsHtml}}`은 Phase 02에서 빈 문자열로 치환.

**확인 대상**: `run_daily_with_claude.ts`의 기존 `run("bun", [...render_report_html.ts, "--input", report, "--output", reportHtml])` 호출이 수정 없이 통과해야 한다.

---

## 8. phase 03 구현 범위 (시각 스타일과 검증)

- template CSS를 SaaS/dashboard형으로 조용하게 다듬는다.
  - landing page hero, 큰 marketing copy, 과한 장식 금지.
  - card radius 8px 이하.
  - 배경, border, accent 절제.
- 강력 추천/도전 추천 항목에 class 부여 (가능하면): `tier-strong`, `tier-stretch`, `tier-hold`.
- source diagnostics 섹션 `<details><summary>` 접힘 처리.
- 모바일 smoke: 긴 URL, 긴 직무명 layout 깨짐 없음 확인.
- Discord 본문 triage 역할 유지 확인 (실제 전송 불필요).
- Playwright 미설치 환경 기준 — screenshot smoke는 선택.

---

## 9. docs freeze 확인

- ADR-080이 template 경로, placeholder 계약, Discord 첨부 흐름, HTML 정본 경계를 모두 결정했다.
- `docs/data-schema.md`도 `data/runtime/position-recommendation.html`과 template 경로를 기록하고 있다.
- `docs/flow.md`도 renderer → html 경로를 기록하고 있다.
- **결론: phase 02, 03 구현 중 docs/ADR 수정 불필요. docs freeze 충족.**
