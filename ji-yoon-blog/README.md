# ji-yoon-blog

지융로그 네이버 블로그 운영을 위한 워크스페이스다.
페르소나, 카테고리별 스타일, 미리보기 자동화 경계를 관리한다.

작업 경계와 보안 규칙은 `AGENTS.md`가 소유한다.
문서별 책임과 읽는 순서도 그 파일에 있다.

## 페르소나 갱신

한 달에 한 번 공개 글을 수집한다.
이전 보고서 뒤에 새 글이 10개 이상이면 최근 30개와 전체 글을 비교한 HTML 보고서를 만든다.
실행 순서와 문서 수정 조건은 [지융로그 페르소나 갱신 스킬](.claude/skills/ji-yoon-persona-refresh/SKILL.md)을 따른다.

```bash
python3 scripts/collect_naver_posts.py --out data/posts --refresh-index
python3 scripts/enrich_naver_posts.py --out data/posts
python3 scripts/analyze_persona.py --posts data/posts --out data/persona-stats.json
python3 scripts/build_persona_report.py --posts data/posts --stats data/persona-stats.json
```

`collect_naver_posts.py`는 글 목록을 다시 받고 이미 받은 본문은 재사용한다.
사람이 보고서를 읽고 확인한 뒤에만 페르소나와 카테고리 스타일 문서를 고친다.

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
