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

## 주간 자동 실행

외부 scheduler는 매주 한 번 다음 의도로 agent skill을 호출한다.

```text
/accountbook-weekly-import --inbox accountbook/private/inbox/new --mode auto-safe
```

저장소는 특정 scheduler에 의존하지 않는다.
권장 실행 시각은 매주 월요일 04:00 `Asia/Seoul`이다.

```text
inbox/new의 PNG와 sidecar manifest 탐색
  -> run ID로 24시간 lease lock 획득
  -> 이전 실행의 디렉터리와 weekly state 불일치 복구
  -> 이미지 SHA-256 기준 처리 이력 확인
  -> 처리 대상을 inbox/processing으로 원자 이동
  -> 모든 이미지에 기존 화면 추출 계약 적용
  -> 모든 이미지의 결정적 validator 실행
  -> validated 경로와 manifest 경로를 weekly run plan에 기록
  -> 결정적 주간 실행기가 모든 선택 날짜의 이미지 간 충돌 검사
  -> 결정적 주간 실행기가 weekly-safe-v1 평가와 주간 승인 출처 강제
  -> 통과: policy 승인 파일 생성 후 weekly 모드로 기존 submit 실행
  -> 차단: needs-review로 이미지와 manifest 이동
  -> 확정 실패: failed로 이동
  -> 성공: processed로 이동하고 주간 요약 출력
  -> 같은 run ID로 lease lock 해제
```

신규 이미지가 없으면 `no_new_images`를 출력하고 성공 종료한다.
같은 SHA-256이 처리 이력에 있으면 다시 추출하거나 등록하지 않는다.
동일한 주간 실행이 겹치면 batch lock을 얻은 실행만 진행한다.
실행이 중단돼 `processing`에 남은 항목은 상태 파일과 batch 기록을 기준으로 복구하며 무조건 다시 POST하지 않는다.
한 실행의 모든 이미지에서 추출과 검증을 먼저 끝낸 뒤에만 정책 승인과 POST 단계로 넘어간다.

run lock은 명령 프로세스가 끝나도 파일로 유지하며 skill 전체 수명을 보호한다.
같은 run ID는 중단된 실행을 이어갈 수 있고, 다른 run ID는 lock 생성 후 24시간 안에는 시작할 수 없다.
24시간이 지난 lock은 stale로 간주한다.
새 실행은 lock을 원자적으로 인계한 뒤 디렉터리와 상태를 수렴시키며, 복구를 마치기 전에는 POST하지 않는다.

재시작 reconciliation은 다음 순서로 수행한다.

- `new`와 `processing`에 PNG와 manifest가 갈라졌으면 두 파일을 `processing`에 모은다.
- `processing`에 완전한 pair가 있지만 state가 없으면 SHA-256으로 `processing` 상태를 복원한다.
- state가 terminal인데 pair가 `processing`에 있으면 state가 가리키는 terminal 디렉터리로 이동을 끝낸다.
- pair가 terminal 디렉터리에 있고 state가 `processing`이면 디렉터리 상태로 state를 보정한다.

reconciliation은 accountbook POST를 호출하지 않는다.
복구 뒤에도 pair와 state를 결정할 수 없으면 자동 등록하지 않고 `failed`로 격리한다.

`weekly-safe-v1`은 다음 조건을 모두 요구한다.

- 선택된 날짜의 상세 수입·지출 합계가 화면 일별 합계와 정확히 일치한다.
- 선택된 모든 거래의 금액과 설명 신뢰도가 `high`다.
- `dateEvidence`의 월·일이 화면에서 읽은 값이고 정규화된 날짜와 일치한다.
- 연도만 sidecar의 원본 생성 시각으로 보완한다.
- 화면 연도 근거가 있으면 날짜 `high`를 허용하고, `upload-metadata` 연도 근거가 있으면 날짜만 `medium`을 허용한다.
- 금액·설명의 `medium`과 모든 `low`는 허용하지 않는다.
- 원본 생성 시각은 실행 시각보다 미래가 아니고 14일보다 오래되지 않는다.
- 화면에서 잘린 날짜는 선택하지 않는다.

한 이미지 안의 완전한 날짜는 잘린 다른 날짜와 별개로 자동 등록할 수 있다.
여러 이미지에 선택된 같은 날짜가 있으면 관련 이미지를 모두 `needs-review`로 보내고 POST하지 않는다.
기존 동일 거래와 불명확한 POST 복구는 대화형 실행과 같은 규칙으로 멈춘다.
거래 생성 POST의 5xx와 네트워크 오류는 결과가 불명확하므로 `submitting`을 유지한다.
재실행은 기존 거래 조회로만 복구하며 새 POST를 보내지 않는다.
