# 지윤블로그 워크스페이스

지융로그 네이버 블로그 운영을 위한 독립 워크스페이스다.

## 목적

- 지융로그 페르소나 유지.
- 네이버 블로그 글쓰기 스킬 자료 관리.
- 카테고리별 글쓰기 스타일 확장.
- 내부/외부 트렌드 분석으로 글감 추천.
- 미리보기/임시저장 자동화 준비.

## 현재 데이터

- `data/naver-blog/ji_yung_posts.json`: 네이버 블로그 글 목록 기반 수집 데이터.
- `data/naver-blog/ji_yung_samples.json`: 대표 글 본문 샘플 데이터.
- `references/ji-yung-persona.md`: 지융로그 페르소나.
- `references/category-style-map.md`: 카테고리별 글쓰기 모듈.
- `references/preview-automation.md`: 네이버 미리보기 자동화 지침.

## 관련 Hermes 스킬

- `naver-blog-writing`: 지융로그 글쓰기와 미리보기 패키지 생성.
- `naver-blog-trend-research`: 내부/외부 트렌드 분석과 글감 추천.
- `humanizer`: AI 티가 나는 문장 제거.

## 운영 메모

네이버 계정 정보, 쿠키, 세션, 인증번호는 이 워크스페이스에 저장하지 않는다.
로그인이 필요한 작업은 QR 로그인 또는 사용자의 직접 브라우저 로그인을 사용한다.
