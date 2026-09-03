# ji-yoon-blog

지융로그 네이버 블로그 운영을 위한 워크스페이스다.
페르소나, 카테고리별 스타일, 미리보기 자동화 경계를 관리한다.

작업 경계와 보안 규칙은 `AGENTS.md`가 소유한다.
문서별 책임과 읽는 순서도 그 파일에 있다.

## 페르소나 갱신

페르소나는 블로그 전체 글을 수집해 통계로 만든다.
글이 쌓이면 다시 돌려 `references/ji-yung-persona.md`를 갱신한다.

```bash
python3 scripts/collect_naver_posts.py --out data/posts
python3 scripts/enrich_naver_posts.py --out data/posts
python3 scripts/analyze_persona.py --posts data/posts --out data/persona-stats.json
```

`collect_naver_posts.py`는 이미 받은 글을 건너뛰므로 새 글만 추가로 받는다.
전체를 다시 받으려면 `data/posts`와 `data/post-index.json`을 지운다.

수집은 로그인이 필요 없다.
요청이 빠르면 네이버가 429로 거절하므로 스크립트가 간격을 늘려가며 다시 요청한다.

## 글쓰기 요청을 받으면

1. 글 주제와 카테고리
2. 지융로그 페르소나
3. 카테고리별 스타일
4. 필요한 실제 경험과 사진 흐름
5. 미리보기 또는 임시저장 여부

## 발행 전 확인

- 사용자가 최종 발행을 명시했는지
- 제목, 본문, 태그, 사진 위치가 요청과 맞는지
- 출처가 필요한 사실에 날짜와 근거가 있는지
