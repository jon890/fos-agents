# 면접 질문 후보 수집

기술 블로그, YouTube 발표와 GitHub 면접 가이드는 질문 범위와 실무 사례를 찾는 자료다.
이 자료를 답변의 정답으로 바로 사용하지 않는다.
최종 질문의 `answerSignals`는 공식 문서, 표준 또는 프로젝트 문서로 다시 검증한다.

## 출처의 역할

| 역할 | 출처 | 사용 방식 |
| --- | --- | --- |
| 정답 근거 | 공식 문서, 표준, 프로젝트 문서 | 기술 사실과 운영 지표를 검증한다. |
| 사례 발견 | 회사 기술 블로그, 공개 콘퍼런스 영상 | 실제 제약, 장애, 대안과 운영 영향을 질문으로 바꾼다. |
| 범위 확인 | 공개 GitHub 면접 가이드 | 빠진 CS·설계 영역을 찾되 질문과 답안을 복사하지 않는다. |

등록 출처는 `config/interview-question-sources.ts`에서 관리한다.
오픈소스 가이드에 라이선스가 있어도 원문 질문과 답안을 그대로 옮기지 않는다.
YouTube 영상은 제목과 설명만 보고 기술 사실을 확정하지 않고, 공개 자막이나 발표 자료와 원문을 확인한다.

## 후보 수집

실행별 후보와 cache는 저장소가 아니라 시스템 임시 디렉터리에 만든다.

```bash
mktemp -d "${TMPDIR:-/tmp}/interview-question-sources.XXXXXX"
```

반환 경로를 `<RUN_DIR>`로 사용한다.

```bash
bun "$(git rev-parse --show-toplevel)/career-os/scripts/interview-question-sources/cli.ts" validate
bun "$(git rev-parse --show-toplevel)/career-os/scripts/interview-question-sources/cli.ts" collect \
  --output <RUN_DIR>/interview-source-candidates.json \
  --cache-dir <RUN_DIR>/cache
bun "$(git rev-parse --show-toplevel)/career-os/scripts/question-bank-collector/validate.ts"
```

일부 출처가 실패해도 다른 출처의 후보가 있으면 계속한다.
수집 결과가 모두 비었을 때만 웹 검색으로 등록 출처의 공개 상태를 확인한다.
비활성화나 URL 변경은 원문에서 확인한 경우에만 설정에 반영한다.

검토를 마치면 `<RUN_DIR>`의 파일과 빈 디렉터리를 각각 제거한다.
경로가 `interview-question-sources.`로 시작하는 시스템 임시 디렉터리인지 먼저 확인한다.

```bash
find <RUN_DIR> -type f -exec unlink {} \;
find <RUN_DIR> -depth -type d -exec rmdir {} \;
```

## 공백과 목표 수준 연결

1. 공개 질문 은행의 카테고리, tag, 난도와 `bar` 분포를 확인한다.
2. 현재 지원 공고가 요구하지만 공개·개인·포지션 질문에 없는 영역을 찾는다.
3. private brain에서 현재 직장, 경력 깊이와 직접 경험 경계를 읽는다.
4. 회사 이름으로 수준을 고정하지 않고 공고의 문제 규모와 책임으로 목표 `bar`를 정한다.
5. 후보 원문에서 현재 공백에 맞는 제약, 실패 사례와 판단 지점을 고른다.
6. 기술 사실은 `answer-authority` 출처에서 다시 확인한다.

`bar`는 공개 가능한 능력 기준이다.

| bar | 확인할 수준 |
| --- | --- |
| `production` | 한 서비스의 정확성, 장애 복구, 테스트와 운영 지표를 소유한다. |
| `large-scale` | 대규모 제품과 여러 팀에서 재사용하는 계약, 용량, 비용과 변경 안전성을 판단한다. |
| `global-scale` | 모호한 문제를 정의하고 다중 리전·조직 공통 기반의 실패 격리, 보안과 장기 trade-off를 주도한다. |

현재 회사는 시작 수준을 추정하는 입력일 뿐 질문을 낮추거나 높이는 고정 서열이 아니다.
현재보다 높은 목표를 준비할 때는 현재 근거를 방어하는 질문, 목표 역할 질문과 한 단계 높은 확장 질문을 함께 둔다.
목표가 `large-scale`이면 `production` 질문은 기본 세션에서 제외하고, `large-scale`과 `global-scale` 질문만 선별한다.
단, 이전 연습에서 확인한 기본기 공백은 별도 복습 항목으로 다룬다.

## 질문 승격 기준

- 단순 용어 정의가 아니라 선택 기준, 제약, 실패, 운영 영향과 검증 중 둘 이상을 묻는다.
- 현재 경험을 확인하는 질문과 아직 해보지 않은 설계 질문을 구분한다.
- 질문마다 `bar`, 답변 신호와 대표 꼬리질문 후보를 둔다.
- 꼬리질문은 같은 말을 다시 묻지 않고 판단, 반례, 운영과 근거 경계로 깊어진다.
- 포지션 전용 질문은 해당 지원 디렉터리에 두고 공개 질문 은행으로 승격하지 않는다.
- 추가한 공개 질문은 출처 레지스트리와 전체 질문 은행 검증을 통과해야 한다.

## 중단 조건

- 원문이나 공식 근거를 열 수 없으면 질문을 승격하지 않는다.
- 유료 자료, 비공개 후기와 저작권이 불명확한 답안을 복사하지 않는다.
- 현재 경력과 회사 정보는 후보 선별에만 쓰고 공개 질문 파일에 기록하지 않는다.
- 질문 수를 채우려고 이미 충분한 카테고리를 반복 보강하지 않는다.
