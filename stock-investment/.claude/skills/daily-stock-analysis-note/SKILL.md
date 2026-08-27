---
name: daily-stock-analysis-note
description: 미국·한국 AI와 기술주 한 종목의 사실, 투자 가설, 반증 조건과 위험을 한국어 분석 노트 초안으로 만든다. 일일 종목 분석이나 블로그 초안 준비 요청에 사용한다. 외부 저장소 발행과 매수·매도 조언은 하지 않는다.
---

# 일일 종목 분석 노트

## 실행

1. `config/daily-stock-universe.json`, 기존 선택 이력과 종목별 가설 자료를 읽는다.
2. 사용자가 티커를 지정하면 후보군에 있는지 확인하고, 없으면 수집기가 고른 미작성 후보를 사용한다.

```bash
report_date=$(TZ=Asia/Seoul date +%F)
out_dir="stock-investment/data/daily-notes/$report_date"
mkdir -p "$out_dir"
python3 stock-investment/scripts/daily-stock-analysis-note/collect_daily_note_inputs.py \
  stock-investment/config/daily-stock-universe.json \
  "$out_dir/selected.json" "$out_dir/raw-inputs.json" \
  "${TICKER:--}" stock-investment/data/daily-notes/history.json
```

3. 선택 근거와 원문 데이터를 확인해 `$out_dir/report.md`를 작성한다.
4. 공개 초안이 필요하면 민감 정보와 Markdown 호환성을 검사한 뒤 `stock-investment/data/publish/`에 복사한다.
5. 로컬 산출물 경로와 한 줄 결론을 반환한다.

## 작성 계약

- 제목에 초안임을 표시한다.
- 종목을 고른 이유, 사업의 핵심 가설, 최근 실적과 시장 반응, 성장 조건, 반론과 위험을 연결한다.
- 가설을 지지하는 근거와 가설을 깨는 조건을 함께 적고, 기존 가설이 있으면 강화·약화·중립으로 평가한다.
- 낯선 지표가 핵심 판단에 쓰이면 처음 등장할 때 의미와 한계를 짧게 설명한다.
- 수집된 사실, 회사·언론의 주장과 작성자의 해석을 구분한다.
- 고정 목차를 채우는 것보다 독자가 판단을 재현하는 데 필요한 근거와 불확실성을 우선한다.

## 발행 경계

- 쓰기 범위는 `stock-investment/` 내부다.
- `career-os/sources/fos-study`와 다른 저장소를 수정하거나 commit·push하지 않는다.
- `data/publish/`는 발행 전 초안이며 외부 반영은 별도 승인된 단계가 맡는다.
- 같은 종목의 기존 공개 글이 있으면 새 글을 자동 생성하지 않고 갱신 또는 후속 분석 후보로 보고한다.
- 투자 권유, 가격 보장과 자동 주문을 하지 않는다.

## 검증

- `selected.json`과 `raw-inputs.json`의 종목, 시각과 출처가 본문과 일치한다.
- 수집 실패와 근거가 약한 구간을 숨기지 않았다.
- 공개 초안에는 비밀 값, 로컬 절대 경로와 다른 워크스페이스 경로가 없다.
- Markdown 원본은 저장소 표현·가독성 검사를 통과한다.
