# Data Schema — cooking

cooking 워크스페이스의 설정과 산출물 구조.

## 1. config

`config/defaults.json`은 조사 기본값을 담는다.

- `servings`: 기본 인원수
- `criteria`: 재료 비교 기준
- `videoLanguages`: 우선 수집 언어
- `privacyDefault`: 개인 맥락 기본 분류

## 2. data

메뉴별 산출물은 `data/<menu-slug>/`에 둔다.

- `ingredients.md`: 핵심 재료, 대체재, 구매처 후보
- `comparison.md`: 재료별 비교와 추천 조합
- `recipe.md`: 첫 시도용 레시피
- `videos.md`: 영상과 레시피 링크
- `shopping-list.md`: 인원별 장보기 목록

## 3. logs

자동 수집이나 장기 실행이 생기면 `logs/`에 실행 로그를 둔다.
현재 MVP는 수동 조사 중심이라 필수 로그는 없다.

## 4. .env

현재 필수 비밀값은 없다.
추후 Discord 알림이나 유료 API를 붙일 때 `.env.example`에 키를 먼저 추가한다.

