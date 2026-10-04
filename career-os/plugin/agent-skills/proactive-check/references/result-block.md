# 결과 블록

6단계에서 읽는다. 칸 이름과 상한은 fos-assistant 의 결과 계약(`version: 1`)을 따른다.
Control Plane 이 이 블록을 검사해 다시 그린다. 블록 밖의 글은 버려진다.

## 모양

답 끝에 아래 블록 하나를 둔다. 블록 안은 JSON 하나다. 주석을 넣지 않는다.

```text
<fos-check-result>
{"version": 1, "outcome": "NOTHING_NEW", "findings": []}
</fos-check-result>
```

| 칸 | 값 | 상한 |
| --- | --- | --- |
| `version` | `1` | |
| `outcome` | `FINDINGS` 나 `NOTHING_NEW` | |
| `summary` | 한두 문장. 선택 | 300자 |
| `findings` | 아래 발견. `NOTHING_NEW` 면 빈 배열 | 5개 |
| `questions` | 사용자에게 묻고 싶은 것 | 3개, 각 300자 |
| `followUpCandidates` | 할 일 후보 문장 | 3개, 각 200자 |
| `sourceFailures` | 읽지 못한 출처와 까닭 | 5개, 각 200자 |

발견 하나의 칸이다.

| 칸 | 값 | 상한 |
| --- | --- | --- |
| `area` | `study`, `position`, `trend` | |
| `topicKey` | 아래 「주제 키」 | 120자 |
| `title` | 무엇인가 | 120자 |
| `sourceUrl` | 이번에 연 원문의 `https` 주소 | 2000자 |
| `checkedAt` | 이번에 연 원문에만 입력의 `지금 시각` 을 그대로 쓴다. 시각을 지어내지 않는다 | |
| `publishedAt` | 원문이 나온 날짜나 시각. 모르면 뺀다 | |
| `freshness` | 아래 「신선도」 | |
| `whyItMatters` | 이 사용자에게 왜 중요한지. 맥락 문서나 점검 대화의 사실로 적는다 | 600자 |
| `facts` | 원문에서 확인한 사실. 하나 이상 | 6개, 각 300자 |
| `inferences` | 원문과 맥락으로 한 추정 | 6개, 각 300자 |
| `unknowns` | 아직 모르는 조건 | 6개, 각 300자 |
| `next` | `{"type": "ACTION", "text": "..."}` 이나 `{"type": "QUESTION", "text": "..."}` | 300자 |
| `changeSinceLast` | 같은 주제를 다시 알릴 때만. 새 근거, 마감 임박, 적합성 변화 | 300자 |

`title`, `whyItMatters`, `facts` 하나 이상, `next` 는 모든 발견에 반드시 있어야 한다.

`outcome` 이 `NOTHING_NEW` 면 `findings` 를 비운다.
발견이 없어도 `questions` 나 `sourceFailures` 로 사용자에게 알릴 것이 있으면 `outcome` 을 `FINDINGS` 로 두고 `findings` 를 비운다.

## 주제 키

`<area>:<개념>` 모양이다. `<개념>` 은 소문자와 숫자를 `-` 로 이은 80자 이하의 kebab-case 다.

| 영역 | `<개념>` | 예 |
| --- | --- | --- |
| `study` | 공부할 개념. `recentStudyTopicKeys` 에 같은 개념이 있으면 `study:` 뒤에 그 키를 붙인다 | `study:kafka-exactly-once` |
| `position` | 회사와 역할. 회사는 제외 기준 답의 `companyKey` 를 쓰고, 선호 목록에 없는 회사는 채용 페이지 주소의 호스트를 kebab-case 로 쓴다 | `position:example-pay-backend-senior` |
| `trend` | 바뀐 기술이나 분야 | `trend:jdk-virtual-threads` |

`recentStudyTopicKeys` 와 견줄 때는 `study:` 를 떼고 견준다.
날짜나 원문 주소를 개념에 넣지 않는다. 같은 개념이면 원문이 달라도 같은 키를 쓴다.
같은 개념의 키를 바꿔 되풀이 판정을 피하지 않는다.

## 신선도

| 영역 | `CURRENT` | `CLOSED` | `STALE` | `UNKNOWN` |
| --- | --- | --- | --- | --- |
| `study` | 원문이 지금 열린다. 버전을 다루면 그 버전이 지금도 지원된다 | | 원문이 다루는 버전이 이미 지원이 끝났다 | 원문이 다루는 버전의 지원 여부를 판단하지 못했다 |
| `position` | 원문이 지금 지원을 받는다 | 마감했거나 공고가 내려갔다 | | 지원을 받는지 원문에서 확인하지 못했다 |
| `trend` | 원문이 90일 안에 나왔다 | | 원문이 90일보다 오래됐다 | 발행일을 찾지 못했다 |

`CURRENT` 가 아닌 발견은 Control Plane 이 참고로 내린다. 알릴 이유가 없으면 처음부터 내지 않는다.

Control Plane 은 아래 순서로 검사해 처음 걸린 까닭으로 발견을 참고로 내린다. 쓰기 전에 같은 순서로 확인한다.

1. `sourceUrl` 이 `http` 나 `https` 의 절대 주소다
2. `checkedAt` 이 이번 살펴보기 시작 무렵부터 지금 사이다
3. `freshness` 가 `CLOSED` 도 `STALE` 도 아니고 `CURRENT` 다
4. 반드시 있어야 하는 네 칸이 있다
5. 최근에 알린 발견과 주제 키와 원문 주소가 함께 같지 않거나, `changeSinceLast` 가 있다

## 영역별로 더 적는 것

| 영역 | 적는 것 |
| --- | --- |
| `study` | 왜 지금 이 사용자에게 필요한지를 Memory 와 맥락 문서의 사실로 `whyItMatters` 에 적는다 |
| `position` | 원문의 마감일과 명시된 요구 조건을 `facts` 에, 원문에 없는 적합 조건을 `unknowns` 에 적는다 |
| `trend` | 실제로 달라진 점을 `facts` 에, 사용자의 일과 학습에 미칠 영향을 `whyItMatters` 와 `inferences` 에 적는다 |

## 맥락을 읽지 못했을 때

3단계에서 커리어 맥락을 읽지 못하면 영역을 고르지 않고 조사하지 않는다.
`outcome` 을 `FINDINGS` 로 두고 `findings` 를 비운 뒤, `sourceFailures` 에 읽지 못한 도구와 오류 코드를 적는다.
`NOTHING_NEW` 로 끝내면 화면에 「새로 알릴 것이 없어요」 만 남아 사용자가 연결 문제를 알 수 없다.
같은 출처 실패가 직전 살펴보기에도 있었고 그 뒤 사용자 메시지가 `0개` 면, 같은 까닭을 다시 적되 `questions` 는 비운다.

## 예

```text
<fos-check-result>
{
  "version": 1,
  "outcome": "FINDINGS",
  "summary": "다음 달 맡을 이벤트 파이프라인에 필요한 Kafka 트랜잭션 자료를 찾았어요.",
  "findings": [
    {
      "area": "study",
      "topicKey": "study:kafka-exactly-once",
      "title": "Kafka 트랜잭션과 exactly-once 처리 설명서",
      "sourceUrl": "https://docs.example.org/kafka/transactions",
      "checkedAt": "2026-10-05T00:00:00Z",
      "publishedAt": "2026-08-20",
      "freshness": "CURRENT",
      "whyItMatters": "learning-interests 가 이번 주에 Kafka 정확히 한 번 처리를 우선 주제로 올렸다.",
      "facts": ["transactional.id 를 설정한 producer 만 트랜잭션을 연다고 설명한다"],
      "inferences": ["consumer 쪽 isolation.level 설정도 함께 봐야 할 것으로 보인다"],
      "unknowns": ["맡을 업무가 쓰는 Kafka 버전"],
      "next": {"type": "ACTION", "text": "설명서의 트랜잭션 절을 읽고 outbox 방식과 비교해 본다"}
    }
  ],
  "questions": [],
  "followUpCandidates": [],
  "sourceFailures": []
}
</fos-check-result>
```
