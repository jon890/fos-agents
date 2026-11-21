# 포지션 추천 실패 처리

실패 항목에는 아래 코드만 넣고 외부 오류 원문이나 모델 응답 전문을 복사하지 않는다.

| 코드 | 적용 대상 | 처리 |
| --- | --- | --- |
| `posting_body_missing` | 공고 분석 | 역할과 요건을 판단할 본문이 없으면 분석 실패로 남긴다. 회사 판정에는 쓰지 않는다. |
| `research_unavailable` | 회사 판정 | 조사 자체를 수행할 수 없을 때 회사 평가 실패로 남긴다. 공개 근거가 없다는 이유만으로 쓰지 않는다. |
| `model_unavailable` | 둘 다 | 모델 호출을 완료하지 못한 항목만 실패로 남기고 다음 실행에서 다시 판단한다. |
| `contract_rejected` | 둘 다 | 결과 형식이나 값이 계약을 벗어나면 원문을 저장하지 않고 형식을 고쳐 다시 판단한다. |
| `internal_error` | 둘 다 | 다른 코드로 설명할 수 없는 내부 처리 실패만 남기고 성공한 항목은 보존한다. |

근거 출처 하나가 실패했지만 다른 근거로 일부 축을 판정할 수 있으면 회사 평가 실패가 아니다.
근거가 하나도 없을 때도 세 축이 모두 `unknown`인 정상 결과로 저장한다.

## 저장소와 설정

실행기가 아래 code 로 끝나면 판정을 이어 가지 않는다. 표준 오류 첫 줄을 최종 답변 첫 줄에 적는다.

| 실행기 출력 | 뜻 | 처리 |
| --- | --- | --- |
| `CAREER_STORE_BUSY` | 다른 실행이 데이터 파일을 쓰고 있다 | 다시 시도하지 않고 끝낸다. 다음 실행이 이어 간다 |
| `CAREER_STORE_CORRUPT` | 데이터 파일을 읽을 수 없다. 실행기는 덮어쓰지 않았다 | 사용자에게 알린다. 작업 폴더의 `state/career.sqlite` 와 같은 이름의 `-wal`, `-shm` 파일을 지우면 빈 상태로 다시 쌓인다. 지우는 것은 사용자가 정한다 |
| `POLICY_NOT_CONFIGURED` | 분석 정책이 없다. 새 저장소에는 기본값이 없다 | 값을 지어내지 않는다. 사용자에게 정책 값을 받아 JSON 파일로 쓰고 `<CAREER_LOCAL> position configure-policy --input <파일>` 로 넣는다 |

사람이 정하는 설정은 아래 명령으로 읽고 바꾼다. 바꾸기 전에 바꿀 내용을 사용자에게 보여 주고 확인받는다.

```bash
<CAREER_LOCAL> position configure-policy --input <분석 정책 JSON>
<CAREER_LOCAL> position configure-companies --input <회사 선호 JSON>
<CAREER_LOCAL> position exclusions get
<CAREER_LOCAL> position exclusions put --input <제외 규칙 JSON>
```

`exclusions put` 은 규칙 목록 전체를 바꾼다. 규칙 하나를 더할 때도 `exclusions get` 의 출력에 더해 전체를 다시 넣는다.
공고 제외 규칙은 이 명령으로만 바꾼다. 커넥터의 공고 제외 도구는 이 저장소를 읽지 않는다.

반영 결과가 `partial`이면 실패한 항목만 다시 판단한다.
같은 항목을 결과와 실패 양쪽에 넣지 않으며, 큐에 남은 항목을 빠뜨리지 않는다.
