---
name: agent-browser
description: 로컬 설치 agent-browser CLI로 브라우저를 직접 제어한다. 페이지 탐색·클릭·입력·동적 콘텐츠 대기·화면 텍스트 추출·스크린샷·웹 UI 자동화에 사용. Naver Land처럼 JavaScript 렌더링(hydration)이 필요한 사이트에서는 정적 웹 페치보다 이 skill을 우선. 아파트 매물 수집·탐색 QA·화면 증거 수집의 기본 브라우저 레이어. 트리거 키워드: "브라우저 자동화", "페이지 클릭", "Naver Land 수집", "스크린샷 찍어줘", "동적 페이지 크롤", "agent-browser".
---

# agent-browser

로컬 설치 `agent-browser` CLI를 브라우저 자동화의 기본 레이어로 사용한다.

## 설치 상태

로컬 전역 설치 순서:

- `npm i -g agent-browser`
- `agent-browser install`

Linux에서 Chrome 실행 실패(공유 라이브러리 누락)가 발생하면:

- `agent-browser install --with-deps`

## 시작 전 확인

명령 실행 전에 설치된 버전과 일치하는 최신 CLI 가이드를 로드한다:

```bash
agent-browser skills get core
agent-browser skills get core --full
```

특화 skill 목록이 필요하면:

```bash
agent-browser skills list
```

현재 주요 특화 skill:

- `electron`
- `slack`
- `dogfood`
- `vercel-sandbox`
- `agentcore`

## 핵심 작업 흐름

snapshot/ref 루프를 기본으로 사용한다:

```bash
agent-browser open <url>
agent-browser snapshot -i
agent-browser click @eN
agent-browser snapshot -i
```

규칙:

- 페이지 상태가 바뀌는 동작 후에는 반드시 재스냅샷.
- raw HTML 스크래핑보다 `snapshot -i` 우선.
- DOM 구조 추측보다 화면에 보이는 증거 우선.
- 막연한 sleep 대신 `wait --load networkidle`, `wait --text`, `wait --url` 사용.

## 아파트 / Naver Land 수집

Naver Land가 JavaScript 렌더링을 요구할 때 `agent-browser`를 기본 동적 수집 경로로 사용한다.

추출 순서:

1. 대상 URL 열기
2. 인터랙티브 요소 스냅샷
3. 매물/단지 뷰로 이동
4. 화면에 명확히 보이는 항목만 추출:
   - 단지명
   - 대상 면적 라벨 (예: 59A / 전용 59㎡)
   - 매물 수
   - 보이는 가격 텍스트
   - 짧은 화면 발췌
5. 후속 정규화기가 처리할 수 있도록 구조화 JSON으로 반환

불완전한 페이지 상태 뒤에 숨은 값을 임의로 만들지 않는다.

## 아키텍처 역할

`~/ai-nodes` 안에서 이 skill은 재사용 가능한 브라우저 기능 레이어다.
`apartment/` 같은 태스크 한정 워크플로는 이 skill을 호출하거나 동일한 명령 계약을 따르되, 자체 오케스트레이션은 최소화한다.
