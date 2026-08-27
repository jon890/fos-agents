# apartment 실행 흐름

이 문서는 apartment의 현재 실행 흐름만 설명한다.
외부 스케줄러와 전달 채널은 저장소 밖에서 정한다.

## 일일 시세 리포트

```text
/apartment-daily-report
  -> load_target_meta.ts
  -> collect_sources.ts
  -> normalize_results.ts
  -> data/YYYY-MM-DD/report.md
  -> 요약과 산출물 경로 반환
```

세부 흐름:

1. 실행 환경이 `apartment/.env`의 필요한 값을 로드한다.
2. skill이 `config/focus-unit.json`에서 타깃 메타데이터를 읽는다.
3. `collect_sources.ts`가 Naver Land, Hogangnono, KB Land 수집 결과를 `raw-search.json`으로 쓴다.
4. `normalize_results.ts`가 `summary.json`을 만든다.
5. skill이 `summary.json`을 읽고 `report.md`를 작성한다.
6. 요약과 산출물 경로를 반환한다.

수집 결과에 없는 가격과 매물 수는 채우지 않는다.
소스 실패는 report와 raw 데이터에 남긴다.

## 수집 smoke test

```text
run_smoke_test.sh
  -> collect_sources.ts
  -> normalize_results.ts
  -> JSON shape 확인
  -> stdout에 smoke 결과 출력
```

에이전트 합성을 거치지 않고 수집기와 정규화기만 확인한다.
일일 리포트 수집 계층을 바꿨을 때 가장 먼저 실행한다.

## 인테리어 레퍼런스 디제스트

```text
/apartment-interior-reference-digest
  -> config/interior-reference-digest.json
  -> docs/interior/*.md
  -> 웹 검색과 후보 평가
  -> data/interior-reference-digest/YYYY-MM-DD/report.md
  -> 필요 시 decision-view.html
  -> 요약과 산출물 경로 반환
```

의사결정 원본은 계속 `docs/interior/*.md`다.
HTML은 사용자가 빠르게 보기 위한 표시용 산출물이다.
새 결정이 생기면 Markdown 원본을 먼저 갱신하고 HTML을 다시 만든다.

## 외부 게시

사용자가 공유 URL 생성을 명시하면 루트 `report-publisher`를 사용한다.
게시 대상은 공개 가능한 HTML 파일이나 디렉터리로 제한한다.
민감 정보가 있으면 게시하지 않는다.
