---
name: ji-yoon-persona-refresh
description: >
  지융로그의 공개 글을 다시 수집하고 최근 글과 전체 글을 비교한 페르소나 갱신 보고서를 만든다.
  "지융로그 페르소나 갱신", "블로그 문체 다시 분석", "최근 글 스타일 비교"처럼
  이미 발행한 글을 근거로 문체와 글 구조를 점검해 달라는 요청에 사용한다.
  새 글 초안 작성과 네이버 임시저장은 naver-blog-draft가 담당한다.
---

# 지융로그 페르소나 갱신

**목표: 새 공개 글이 10개 이상 쌓였을 때 최근 30개와 전체 글의 차이를 HTML 보고서로 보여준다.**

한 달에 한 번 요청받아 실행한다. 별도 스케줄러는 만들지 않는다.
수집 원본과 통계는 추적하지 않는 `data/`에 두고, 보고서는 `reports/`에 둔다.
사람이 보고서를 검토하기 전에는 `references/ji-yung-persona.md`와
`references/category-style-map.md`를 고치지 않는다.

## 워크플로우 개요

| 단계 | 이름 | 통과 조건 | reference |
| --- | --- | --- | --- |
| 1 | 공개 글 수집 | `data/posts`에 본문 JSON이 있고 수집 명령이 종료 코드 0이다 | |
| 2 | 카테고리와 태그 보강 | 조회 실패 수가 출력되고 명령이 종료 코드 0이다 | |
| 3 | 통계와 보고서 생성 | `data/persona-stats.json`이 생기고 새 글 10개 이상이면 HTML 보고서가 생긴다 | |
| 4 | 사람의 검토 | 보고서와 최근 글 표본을 읽고 문서 수정 여부를 결정했다 | 워크스페이스 `references/ji-yung-persona.md`, `references/category-style-map.md` |

명령은 `ji-yoon-blog/`에서 실행한다.

## 1. 공개 글 수집

```bash
python3 scripts/collect_naver_posts.py --out data/posts --refresh-index
```

`--refresh-index`가 공개 글 목록을 다시 받아 새 글을 찾는다.
이미 받은 본문 JSON은 재사용한다. 공개 글 수집이 막히면 이전 자료로 새 보고서를 만들지 않는다.

## 2. 카테고리와 태그 보강

```bash
python3 scripts/enrich_naver_posts.py --out data/posts
```

카테고리 이름을 채우고, 태그 조회가 아직 성공하지 않은 글만 조회한다.
`tagsFetched`가 거짓인 글은 태그가 없는 글로 해석하지 않는다.

## 3. 통계와 보고서 생성

```bash
python3 scripts/analyze_persona.py --posts data/posts --out data/persona-stats.json
python3 scripts/build_persona_report.py --posts data/posts --stats data/persona-stats.json
```

통계는 문단과 사진 길이, 표현과 문체, 스티커와 지도 블록, 협찬 표기, 지역, 태그를 집계한다.
보고서는 최근 30개와 전체 글을 비교한다.
이전 보고서 이후 새로 분석된 글이 10개 미만이면 보고서를 만들지 않는다.
첫 실행에서는 분석된 글 전체를 새 글로 센다.
보고서를 만든 경우에만 `data/persona-report-state.json`에 비교 기준을 기록한다.
기본 보고서 경로는 `reports/persona-refresh-YYYY-MM-DD.html`이다.

## 4. 사람의 검토

생성한 HTML을 열어 표와 최근 글의 원문을 함께 읽는다.
자동 집계는 협찬 표현의 존재와 문장 끝맺음의 빈도만 보여준다.
실제 협찬 여부와 문장의 뉘앙스는 사람이 판단한다.

보고서 경로와 눈에 띄는 차이를 보여주고 문서에 반영할 내용을 확인받는다.
확인받은 내용만 `references/ji-yung-persona.md`와
`references/category-style-map.md`에 적고, 문서 검사기를 실행한다.
보고서와 수집 원본은 외부에 게시하지 않는다.
