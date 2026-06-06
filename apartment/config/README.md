# apartment config

작업에 재사용되는 구조화 설정과 메타데이터를 둔다.

## 주요 파일

- `focus-unit.json`: 포커스 평형 메타데이터.
- `guri-buy-complexes.json`: Guri 광역 탐색 후보 단지.
- `interior-reference-digest.json`: 인테리어 레퍼런스 추천/수집 설정.
- `lucky-24-floorplan.json`: 구리 럭키아파트 24평 참고 평면도 메타데이터.

## 평면도 보관 규칙

- 평면도 이미지 원본은 `data/interior/floorplans/lucky-24/`에 보관한다.
- config에는 원본 이미지의 경로, 출처 URL, 해시, 보이는 치수, 해석만 둔다.
- 공식 도면이 아닌 외부 블로그/매물 기반 평면도는 `confidence: reference-not-official`로 표시하고, 현장 실측 검증 필요성을 명시한다.
