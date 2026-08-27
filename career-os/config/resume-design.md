# 이력서 디자인 계약

이 파일은 이력서와 경력기술서를 HTML과 PDF로 바꿀 때 쓰는 기본 디자인이다.
공고별 디렉터리에 `design.md`가 있으면 해당 파일을 우선 사용한다.

## 독자와 목적

채용 담당자는 첫 페이지에서 지원 직무, 핵심 강점과 대표 근거를 빠르게 찾을 수 있어야 한다.
기술 면접관은 후속 페이지에서 경력 순서, 운영 깊이와 기술 범위를 검증할 수 있어야 한다.

문서는 장식보다 정보 위계를 우선한다.
선택 가능한 텍스트, 논리적인 읽기 순서와 흑백 인쇄 대비를 유지한다.

## 시각 방향

- 첫 페이지는 이름, 역할, 프로필과 대표 프로젝트를 설명하는 서사 영역이다.
- 후속 페이지는 경력, 공개 활동과 기술을 확인하는 근거 영역이다.
- 짙은 청회색 본문과 녹색 강조색을 사용하되 강조색은 제목, 목록 표지와 얇은 선에만 쓴다.
- 이름과 역할을 묶는 왼쪽 세로선을 이 문서의 유일한 시각적 특징으로 사용한다.
- 근무 기간과 기술 묶음은 본문보다 작고 차분하게 표시해 빠른 탐색을 돕는다.
- 아이콘, 사진, 차트, 숙련도 막대와 외부 글꼴은 사용하지 않는다.

## 페이지 구성

A4 단일 열을 사용한다.
제출처가 분량을 제한하면 그 기준을 따르고, 제한이 없으면 근거의 양, 중복과 읽기 편의성으로 필요한 페이지 수를 정한다.
기본 렌더러는 경력 섹션 앞에서 나누지만, 내용에 맞게 `resume-preparer`의 명시적 페이지 구분을 여러 번 사용할 수 있다.
페이지 균형을 맞추려고 본문을 읽기 어려울 정도로 줄이지 않는다.

## CSS

```css
:root {
  color-scheme: light;
  --ink: #17202d;
  --muted: #5d6675;
  --line: #cfd6df;
  --accent: #0b6b53;
  --paper: #ffffff;
}

@page {
  size: A4;
  margin: 13.5mm;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 24px 20px;
  background: #eef1f4;
  color: var(--ink);
  font-family: "Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 10.35pt;
  line-height: 1.42;
  word-break: keep-all;
  overflow-wrap: anywhere;
  font-feature-settings: "kern" 1, "tnum" 1;
}

.resume-page {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(100%, 183mm);
  min-height: 267mm;
  margin: 0 auto;
  background: var(--paper);
}

.resume-page + .resume-page {
  margin-top: 28px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}

.resume-page::after {
  display: block;
  align-self: flex-end;
  margin-top: auto;
  padding-top: 6mm;
  content: attr(data-page);
  color: #8a93a1;
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.resume-header {
  flex-shrink: 0;
  margin: 0 0 17px;
  padding: 0 0 13px 15px;
  border-left: 3px solid var(--accent);
  border-bottom: 1px solid var(--line);
}

h1 {
  margin: 0 0 7px;
  font-size: 27pt;
  font-weight: 800;
  line-height: 1.08;
  letter-spacing: -0.04em;
}

.headline {
  max-width: 170mm;
  margin: 0 0 8px;
  color: #2b3544;
  font-size: 11.2pt;
  font-weight: 620;
  line-height: 1.4;
  letter-spacing: -0.015em;
}

.contact-line {
  margin: 0;
  color: var(--muted);
  font-size: 9.2pt;
  font-weight: 600;
}

section {
  flex-shrink: 0;
  margin: 0 0 14px;
}

h2,
.section-continuation::before {
  display: block;
  margin: 15px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--line);
  color: var(--accent);
  font-size: 11.8pt;
  font-weight: 800;
  line-height: 1.25;
  letter-spacing: -0.02em;
}

.section-continuation::before {
  margin-top: 0;
  content: attr(data-continuation-label);
}

h3 {
  margin: 10px 0 4px;
  color: #202938;
  font-size: 10.75pt;
  font-weight: 760;
  line-height: 1.35;
  break-after: avoid;
  page-break-after: avoid;
}

p {
  margin: 0 0 6px;
}

.period {
  margin: -1px 0 6px;
  color: var(--muted);
  font-size: 8.8pt;
  font-weight: 650;
  letter-spacing: 0.015em;
}

.stack {
  margin: 6px 0 10px;
  color: var(--muted);
  font-size: 8.9pt;
  font-weight: 600;
  line-height: 1.38;
}

ul,
ol {
  margin: 4px 0 9px 18px;
  padding: 0;
}

li {
  margin: 2.5px 0;
  padding-left: 2px;
}

li::marker {
  color: var(--accent);
}

a {
  color: inherit;
  text-decoration: none;
}

code {
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 0.94em;
}

strong {
  font-weight: 760;
}

p,
li {
  orphans: 2;
  widows: 2;
}

@media print {
  body {
    padding: 0;
    background: var(--paper);
  }

  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .resume-page {
    width: 100%;
    min-height: 267mm;
    break-after: page;
    page-break-after: always;
  }

  .resume-page:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  .resume-page + .resume-page {
    margin-top: 0;
    padding-top: 0;
    border-top: 0;
  }
}
```
