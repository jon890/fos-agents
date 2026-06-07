# Resume Design

이 파일은 `resume-draft.md`를 HTML/PDF 이력서로 바꿀 때 쓰는 기본 디자인 계약이다.
공고별 디렉터리에 `design.md`가 있으면 그 파일을 우선 사용한다.

## 목표

- 제출용 이력서는 조용하고 읽기 쉬운 문서여야 한다.
- 첫 화면에서 이름, 역할, 핵심 요약, 강점이 바로 보여야 한다.
- 내부 분석 경로, plan 번호, runner 상태, 검토 로그는 HTML/PDF에 넣지 않는다.

## 레이아웃

- A4 단일 컬럼을 기본으로 한다.
- 상단은 이름/역할/연락처 요약 영역으로 둔다.
- 본문 섹션은 요약, 핵심 기술, 주요 경험, 프로젝트, 교육/기타 순서를 권장한다.
- 긴 문단보다 짧은 bullet을 우선한다.
- print margin은 14mm 안팎으로 둔다.

## 타이포그래피

- 한국어와 영어가 함께 읽히는 sans-serif 계열을 쓴다.
- 본문은 10.5pt에서 11pt 사이로 둔다.
- 섹션 제목은 굵게 쓰되 과한 장식은 피한다.
- 줄 간격은 1.45 안팎으로 둔다.

## 색상

- 본문은 거의 검정에 가까운 회색을 쓴다.
- 보조 정보는 중간 회색으로 낮춘다.
- 강조색은 짙은 녹색 계열을 작게 사용한다.

## CSS

```css
:root {
  color-scheme: light;
  --ink: #18181b;
  --muted: #52525b;
  --line: #d4d4d8;
  --accent: #047857;
  --paper: #ffffff;
}

@page {
  size: A4;
  margin: 14mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", sans-serif;
  font-size: 10.75pt;
  line-height: 1.45;
}

main {
  max-width: 760px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 8px;
  font-size: 24pt;
  line-height: 1.15;
}

h2 {
  margin: 18px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
  color: var(--accent);
  font-size: 12pt;
}

h3 {
  margin: 12px 0 6px;
  font-size: 10.75pt;
}

p {
  margin: 0 0 8px;
}

ul,
ol {
  margin: 6px 0 10px 18px;
  padding: 0;
}

li {
  margin: 3px 0;
}

a {
  color: inherit;
  text-decoration: none;
}

code {
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.95em;
}

.resume-meta {
  margin: 0 0 16px;
  color: var(--muted);
  font-size: 9pt;
}

.design-note {
  display: none;
}
```
