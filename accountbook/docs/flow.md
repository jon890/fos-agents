# Flow: accountbook

## 후보 생성

```text
사용자가 스크린샷 경로로 skill 호출
  -> source image 해시와 생성 시각 확인
  -> vision 지원 여부 확인
  -> 화면 전체에서 월, 날짜 제목과 일별 요약 추출
  -> 거래 행에서 종류, 금액, 설명과 결제 수단 추출
  -> private extracted JSON 생성
  -> 결정적 validator 실행
  -> 일별 상세 합계와 화면 요약 비교
  -> validated JSON과 후보 미리보기 생성
```

vision 입력을 지원하지 않으면 `OCR_UNAVAILABLE`로 종료한다.
토스 소비 화면이 아니면 `UNSUPPORTED_SCREEN`으로 종료한다.

## 날짜와 화면 경계

- 화면에 표시된 월과 날짜 제목을 사용한다.
- 연도가 보이지 않으면 이미지 생성 시각과 가장 가까운 과거 연도로 추정하고 확인 사유를 남긴다.
- 다음 날짜 제목만 보이고 거래 행이 잘렸으면 해당 날짜를 선택하지 않는다.
- 거래 시각이 보이지 않으면 날짜 정밀도로 유지하며 임의 시각을 후보 사실로 표시하지 않는다.

## 검토와 승인

```text
validated JSON
  -> 선택된 날짜별 수입·지출 합계와 후보 표시
  -> 차단 이유와 추론 필드 표시
  -> 사용자 수정 또는 승인
  -> approved JSON 생성
```

합계가 일치하지 않거나 필수 필드 신뢰도가 `low`이면 승인할 수 없다.
사용자가 등록을 명시하지 않으면 preview 상태에서 끝난다.

## API 등록

```text
approved JSON
  -> batch lock 획득
  -> refresh token으로 access token 발급
  -> 카테고리 조회와 UUID 해석
  -> 해당 날짜 기존 수입·지출 조회
  -> 동일 거래 후보가 있으면 needs_review
  -> 후보 상태를 submitting으로 기록
  -> 날짜 정밀도 값을 정오 시각으로 변환
  -> 기존 expense 또는 income POST 호출
  -> remote UUID와 submitted 상태 기록
  -> batch 완료
```

일부 후보만 성공하면 batch는 `partial`이다.
재실행은 `submitted` 후보를 건너뛰고 `submitting` 후보를 기존 거래 조회로 복구한다.
API 결과를 확정할 수 없으면 자동 재전송하지 않는다.
이전 상태가 `submitting`이면 재조회 결과가 0건이거나 여러 건이어도 `needs_review`로 멈춘다.
화면에 거래 시각이 없으므로 API의 `LocalDateTime`에는 해당 날짜 정오를 넣는다.
정오는 실제 거래 시각이 아니라 날짜가 timezone 변환으로 바뀌지 않게 하는 저장용 값이다.

## 빈 상태와 충돌

- 선택된 완전한 날짜가 없으면 `no_complete_day_selected`로 종료한다.
- 카테고리 이름이 없으면 설정된 기본 카테고리를 사용한다.
- 기본 카테고리를 찾지 못하면 등록을 시작하지 않는다.
- 같은 batch lock이 있으면 `IMPORT_LOCKED`로 종료한다.
- 기존 동일 거래가 있으면 중복 여부를 사용자가 판단하도록 `needs_review`로 종료한다.
